package cn.boai.music;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.lang.ref.WeakReference;

@CapacitorPlugin(name = "BoAiMusic")
public class BoAiMusicPlugin extends Plugin {

    private static final String CHANNEL_ID = "boai_music_playback";
    private static final int NOTIFICATION_ID = 2001;
    private static final String ACTION_PREVIOUS = "cn.boai.music.action.PREVIOUS";
    private static final String ACTION_TOGGLE = "cn.boai.music.action.TOGGLE";
    private static final String ACTION_NEXT = "cn.boai.music.action.NEXT";

    private static WeakReference<BoAiMusicPlugin> activeInstance = new WeakReference<>(null);

    private NotificationManagerCompat notificationManager;
    private MediaSessionCompat mediaSession;

    @Override
    public void load() {
        super.load();
        activeInstance = new WeakReference<>(this);
        notificationManager = NotificationManagerCompat.from(getContext());
        mediaSession = new MediaSessionCompat(getContext(), "BoAiMusic");
        mediaSession.setActive(true);
        createNotificationChannel();
    }

    @Override
    protected void handleOnDestroy() {
        clearNowPlayingInternal();
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

        updateNowPlayingInternal(title, artist, isPlaying);
        call.resolve();
    }

    @PluginMethod
    public void clearNowPlaying(PluginCall call) {
        clearNowPlayingInternal();
        call.resolve();
    }

    private void updateNowPlayingInternal(String title, String artist, boolean isPlaying) {
        if (title == null || title.trim().isEmpty()) {
            title = "BoAi Music";
        }

        if (mediaSession != null) {
            int playbackState = isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
            long playbackActions =
                PlaybackStateCompat.ACTION_PLAY |
                PlaybackStateCompat.ACTION_PAUSE |
                PlaybackStateCompat.ACTION_PLAY_PAUSE |
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT;

            mediaSession.setPlaybackState(
                new PlaybackStateCompat.Builder()
                    .setState(playbackState, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1f)
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
            .setContentIntent(buildContentIntent())
            .addAction(android.R.drawable.ic_media_previous, "Previous", buildActionIntent(ACTION_PREVIOUS, 101))
            .addAction(
                isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                isPlaying ? "Pause" : "Play",
                buildActionIntent(ACTION_TOGGLE, 102)
            )
            .addAction(android.R.drawable.ic_media_next, "Next", buildActionIntent(ACTION_NEXT, 103))
            .setStyle(
                new androidx.media.app.NotificationCompat.MediaStyle()
                    .setMediaSession(mediaSession != null ? mediaSession.getSessionToken() : null)
                    .setShowActionsInCompactView(0, 1, 2)
            );

        notificationManager.notify(NOTIFICATION_ID, builder.build());
    }

    private void clearNowPlayingInternal() {
        if (notificationManager != null) {
            notificationManager.cancel(NOTIFICATION_ID);
        }
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
