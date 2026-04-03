package cn.boai.music;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class BoAiMusicActionReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) {
            return;
        }

        BoAiMusicPlugin.dispatchNotificationAction(intent.getAction());
    }
}
