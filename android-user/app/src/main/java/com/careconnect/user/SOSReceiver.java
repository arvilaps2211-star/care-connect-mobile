package com.careconnect.user;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class SOSReceiver extends BroadcastReceiver {
    public static final String ACTION_TRIGGER = "com.careconnect.user.TRIGGER_SOS";

    @Override
    public void onReceive(Context context, Intent intent) {
        Intent launch = new Intent(context, MainActivity.class);
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        launch.putExtra("trigger", "volume");
        context.startActivity(launch);
    }
}