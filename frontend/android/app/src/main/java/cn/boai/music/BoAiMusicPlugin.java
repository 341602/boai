package cn.boai.music;

import android.Manifest;
import android.app.DownloadManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.core.content.pm.PackageInfoCompat;

import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;

import java.io.File;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(
    name = "BoAiMusic",
    permissions = {
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class BoAiMusicPlugin extends Plugin {

    private static final String CHANNEL_ID = "boai_music_playback";
    private static final int NOTIFICATION_ID = 2001;
    private static final String ACTION_PREVIOUS = "cn.boai.music.action.PREVIOUS";
    private static final String ACTION_TOGGLE = "cn.boai.music.action.TOGGLE";
    private static final String ACTION_NEXT = "cn.boai.music.action.NEXT";

    private static WeakReference<BoAiMusicPlugin> activeInstance = new WeakReference<>(null);

    private NotificationManagerCompat notificationManager;
    private MediaSessionCompat mediaSession;
    private DownloadManager downloadManager;
    private BroadcastReceiver updateReceiver;
    private long activeUpdateDownloadId = -1L;
    private final List<String> activeUpdateUrls = new ArrayList<>();
    private int activeUpdateUrlIndex = 0;
    private String activeUpdateFileName = "boai-music-update.apk";

    @Override
    public void load() {
        super.load();
        activeInstance = new WeakReference<>(this);
        notificationManager = NotificationManagerCompat.from(getContext());
        downloadManager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        mediaSession = new MediaSessionCompat(getContext(), "BoAiMusic");
        mediaSession.setActive(true);
        createNotificationChannel();
        registerUpdateReceiver();
    }

    @Override
    protected void handleOnDestroy() {
        clearNowPlayingInternal();
        unregisterUpdateReceiver();

        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }

        activeInstance.clear();
        super.handleOnDestroy();
    }

    @PluginMethod
    public void updateNowPlaying(PluginCall call) {
        String title = call.getString("title", "BoAi Music");
        String artist = call.getString("artist", "");
        boolean isPlaying = call.getBoolean("isPlaying", false);
        boolean hasPrevious = call.getBoolean("hasPrevious", false);
        boolean hasNext = call.getBoolean("hasNext", false);

        updateNowPlayingInternal(title, artist, isPlaying, hasPrevious, hasNext);
        call.resolve();
    }

    @PluginMethod
    public void ensureNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }

        if (getPermissionState("notifications") == PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }

        requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
    }

    @PluginMethod
    public void clearNowPlaying(PluginCall call) {
        clearNowPlayingInternal();
        call.resolve();
    }

    @PluginMethod
    public void getAppInfo(PluginCall call) {
        JSObject result = new JSObject();

        try {
            PackageManager packageManager = getContext().getPackageManager();
            String packageName = getContext().getPackageName();
            PackageInfo packageInfo = packageManager.getPackageInfo(packageName, 0);
            int flags = getContext().getApplicationInfo().flags;
            boolean debuggable = (flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;

            result.put("packageName", packageName);
            result.put("versionName", packageInfo.versionName != null ? packageInfo.versionName : "0.0.0");
            result.put("versionCode", PackageInfoCompat.getLongVersionCode(packageInfo));
            result.put("debuggable", debuggable);
            result.put("native", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Failed to read app info", error);
        }
    }

    @PluginMethod
    public void ensureInstallPermission(PluginCall call) {
        JSObject result = new JSObject();

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            result.put("granted", true);
            result.put("openedSettings", false);
            call.resolve(result);
            return;
        }

        boolean granted = getContext().getPackageManager().canRequestPackageInstalls();
        result.put("granted", granted);
        result.put("openedSettings", false);

        if (granted) {
            call.resolve(result);
            return;
        }

        Intent intent = new Intent(
            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:" + getContext().getPackageName())
        );
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);

        result.put("openedSettings", true);
        call.resolve(result);
    }

    @PluginMethod
    public void downloadAndInstallUpdate(PluginCall call) {
        List<String> urls = extractUpdateUrls(call);
        String fileName = sanitizeApkFileName(call.getString("fileName", "boai-music-update.apk"));

        if (urls.isEmpty()) {
            call.reject("Update url is required");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !getContext().getPackageManager().canRequestPackageInstalls()) {
            call.reject("Install permission is required");
            return;
        }

        if (downloadManager == null) {
            call.reject("Download manager unavailable");
            return;
        }

        try {
            if (activeUpdateDownloadId != -1L) {
                downloadManager.remove(activeUpdateDownloadId);
                activeUpdateDownloadId = -1L;
            }

            activeUpdateUrls.clear();
            activeUpdateUrls.addAll(urls);
            activeUpdateUrlIndex = 0;
            activeUpdateFileName = fileName;

            if (!startNextUpdateDownload()) {
                call.reject("Failed to start update download");
                return;
            }

            JSObject result = new JSObject();
            result.put("enqueued", true);
            result.put("downloadId", activeUpdateDownloadId);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Failed to start update download", error);
        }
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState("notifications") == PermissionState.GRANTED);

        if (call != null) {
            call.resolve(result);
        }
    }

    private void updateNowPlayingInternal(
        String title,
        String artist,
        boolean isPlaying,
        boolean hasPrevious,
        boolean hasNext
    ) {
        if (title == null || title.trim().isEmpty()) {
            title = "BoAi Music";
        }

        if (mediaSession != null) {
            int playbackState = isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
            long playbackActions =
                PlaybackStateCompat.ACTION_PLAY |
                PlaybackStateCompat.ACTION_PAUSE |
                PlaybackStateCompat.ACTION_PLAY_PAUSE;

            if (hasPrevious) {
                playbackActions |= PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS;
            }

            if (hasNext) {
                playbackActions |= PlaybackStateCompat.ACTION_SKIP_TO_NEXT;
            }

            mediaSession.setPlaybackState(
                new PlaybackStateCompat.Builder()
                    .setState(playbackState, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, isPlaying ? 1f : 0f)
                    .setActions(playbackActions)
                    .build()
            );

            mediaSession.setMetadata(
                new MediaMetadataCompat.Builder()
                    .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
                    .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
                    .build()
            );
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(artist)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(isPlaying)
            .setContentIntent(buildContentIntent());

        int compactActionCount = 0;
        int[] compactActions = new int[3];

        if (hasPrevious) {
            builder.addAction(android.R.drawable.ic_media_previous, "Previous", buildActionIntent(ACTION_PREVIOUS, 101));
            compactActions[compactActionCount++] = 0;
        }

        int toggleActionIndex = compactActionCount;
        builder.addAction(
            isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
            isPlaying ? "Pause" : "Play",
            buildActionIntent(ACTION_TOGGLE, 102)
        );
        compactActions[compactActionCount++] = toggleActionIndex;

        if (hasNext) {
            builder.addAction(android.R.drawable.ic_media_next, "Next", buildActionIntent(ACTION_NEXT, 103));
            compactActions[compactActionCount++] = toggleActionIndex + 1;
        }

        androidx.media.app.NotificationCompat.MediaStyle mediaStyle =
            new androidx.media.app.NotificationCompat.MediaStyle()
                .setMediaSession(mediaSession != null ? mediaSession.getSessionToken() : null);

        if (compactActionCount > 0) {
            int[] compactViewActions = new int[compactActionCount];
            System.arraycopy(compactActions, 0, compactViewActions, 0, compactActionCount);
            mediaStyle.setShowActionsInCompactView(compactViewActions);
        }

        builder.setStyle(mediaStyle);
        notificationManager.notify(NOTIFICATION_ID, builder.build());
    }

    private void clearNowPlayingInternal() {
        if (notificationManager != null) {
            notificationManager.cancel(NOTIFICATION_ID);
        }
    }

    private void registerUpdateReceiver() {
        if (updateReceiver != null) {
            return;
        }

        updateReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null || !DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) {
                    return;
                }

                long downloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
                handleUpdateDownloadComplete(downloadId);
            }
        };

        ContextCompat.registerReceiver(
            getContext(),
            updateReceiver,
            new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
            ContextCompat.RECEIVER_NOT_EXPORTED
        );
    }

    private void unregisterUpdateReceiver() {
        if (updateReceiver == null) {
            return;
        }

        try {
            getContext().unregisterReceiver(updateReceiver);
        } catch (IllegalArgumentException ignored) {
            // Receiver was already removed.
        }

        updateReceiver = null;
    }

    private void handleUpdateDownloadComplete(long downloadId) {
        if (downloadId == -1L || downloadId != activeUpdateDownloadId || downloadManager == null) {
            return;
        }

        DownloadManager.Query query = new DownloadManager.Query().setFilterById(downloadId);

        try (Cursor cursor = downloadManager.query(query)) {
            if (cursor == null || !cursor.moveToFirst()) {
                retryOrFail("未找到更新下载记录");
                return;
            }

            int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));

            if (status != DownloadManager.STATUS_SUCCESSFUL) {
                retryOrFail("更新包下载失败");
                return;
            }

            Uri installUri = resolveInstallUri(cursor, downloadId);

            if (installUri == null) {
                retryOrFail("无法读取更新包文件");
                return;
            }

            notifyUpdateStatus("downloaded", "");
            launchApkInstaller(installUri);
            notifyUpdateStatus("installing", "");
            resetUpdateState();
        } catch (Exception error) {
            retryOrFail(error.getMessage() != null ? error.getMessage() : "更新安装失败");
        } finally {
            activeUpdateDownloadId = -1L;
        }
    }

    private Uri resolveInstallUri(Cursor cursor, long downloadId) {
        String localUri = cursor.getString(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI));

        if (localUri != null && localUri.startsWith("file://")) {
            File file = new File(Uri.parse(localUri).getPath());

            if (file.exists()) {
                return FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    file
                );
            }
        }

        return downloadManager.getUriForDownloadedFile(downloadId);
    }

    private boolean startNextUpdateDownload() {
        if (downloadManager == null) {
            return false;
        }

        while (activeUpdateUrlIndex < activeUpdateUrls.size()) {
            String nextUrl = activeUpdateUrls.get(activeUpdateUrlIndex++);

            try {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(nextUrl));
                request.setTitle("BoAi Music 更新包");
                request.setDescription("下载完成后将自动打开安装界面");
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setAllowedOverMetered(true);
                request.setAllowedOverRoaming(true);
                request.setMimeType("application/vnd.android.package-archive");
                request.setDestinationInExternalFilesDir(
                    getContext(),
                    Environment.DIRECTORY_DOWNLOADS,
                    activeUpdateFileName
                );

                activeUpdateDownloadId = downloadManager.enqueue(request);
                notifyUpdateStatus("downloading", "正在下载更新包");
                return true;
            } catch (Exception ignored) {
                // Try next source.
            }
        }

        resetUpdateState();
        return false;
    }

    private void retryOrFail(String failureMessage) {
        if (startNextUpdateDownload()) {
            return;
        }

        notifyUpdateStatus("failed", failureMessage);
    }

    private List<String> extractUpdateUrls(PluginCall call) {
        List<String> urls = new ArrayList<>();
        JSONArray urlArray = call.getArray("urls");

        if (urlArray != null) {
            for (int index = 0; index < urlArray.length(); index++) {
                String value = urlArray.optString(index, "").trim();
                if (!value.isEmpty()) {
                    urls.add(value);
                }
            }
        }

        String fallbackUrl = call.getString("url", "").trim();
        if (!fallbackUrl.isEmpty()) {
            urls.add(fallbackUrl);
        }

        return urls;
    }

    private void launchApkInstaller(Uri apkUri) {
        Intent installIntent = new Intent(Intent.ACTION_INSTALL_PACKAGE);
        installIntent.setData(apkUri);
        installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        installIntent.putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true);
        installIntent.putExtra(Intent.EXTRA_RETURN_RESULT, true);
        getContext().startActivity(installIntent);
    }

    private void notifyUpdateStatus(String status, String message) {
        JSObject payload = new JSObject();
        payload.put("status", status);
        payload.put("message", message == null ? "" : message);
        notifyListeners("appUpdateStatus", payload, true);
    }

    private void resetUpdateState() {
        activeUpdateUrls.clear();
        activeUpdateUrlIndex = 0;
        activeUpdateFileName = "boai-music-update.apk";
    }

    private String sanitizeApkFileName(String fileName) {
        String safeName = fileName == null ? "boai-music-update.apk" : fileName.trim();

        if (!safeName.endsWith(".apk")) {
            safeName = safeName + ".apk";
        }

        return safeName.replaceAll("[^a-zA-Z0-9._-]", "-");
    }

    private PendingIntent buildContentIntent() {
        Intent intent = new Intent(getContext(), MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        return PendingIntent.getActivity(
            getContext(),
            100,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | pendingIntentImmutableFlag()
        );
    }

    private PendingIntent buildActionIntent(String action, int requestCode) {
        Intent intent = new Intent(getContext(), BoAiMusicActionReceiver.class);
        intent.setAction(action);

        return PendingIntent.getBroadcast(
            getContext(),
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | pendingIntentImmutableFlag()
        );
    }

    private int pendingIntentImmutableFlag() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager manager = getContext().getSystemService(NotificationManager.class);

        if (manager == null) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "BoAi Music Playback",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("BoAi Music player controls");
        manager.createNotificationChannel(channel);
    }

    public static void dispatchNotificationAction(String action) {
        BoAiMusicPlugin plugin = activeInstance.get();

        if (plugin == null) {
            return;
        }

        JSObject payload = new JSObject();
        payload.put("action", normalizeAction(action));
        plugin.notifyListeners("notificationAction", payload, true);
    }

    private static String normalizeAction(String action) {
        if (ACTION_PREVIOUS.equals(action)) {
            return "previous";
        }

        if (ACTION_NEXT.equals(action)) {
            return "next";
        }

        return "toggle";
    }
}
