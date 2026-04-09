package com.careconnect.user;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * BackgroundMonitorPlugin — Capacitor plugin that bridges the native
 * CrashDetectionService / EmergencyPopupActivity to the React/JS layer.
 *
 * JS API:
 *   BackgroundMonitor.startMonitoring()
 *   BackgroundMonitor.stopMonitoring()
 *   BackgroundMonitor.isMonitoring() → { monitoring: boolean }
 *   BackgroundMonitor.simulateCrash() — fires a fake crash event for testing
 *
 * Events emitted to JS:
 *   "crashDetected"       — { level: "accident"|"drop", gForce: number }
 *   "emergencyConfirmed"  — user tapped EMERGENCY on lock screen popup
 *   "userSafe"            — user tapped I'M SAFE
 */
@CapacitorPlugin(name = "BackgroundMonitor")
public class BackgroundMonitorPlugin extends Plugin {

    private static final String TAG = "BackgroundMonitorPlugin";

    private BroadcastReceiver crashReceiver;
    private BroadcastReceiver emergencyReceiver;
    private BroadcastReceiver safeReceiver;

    @Override
    public void load() {
        // Listen for crash detection broadcasts
        crashReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent intent) {
                JSObject data = new JSObject();
                data.put("level", intent.getStringExtra("level"));
                data.put("gForce", intent.getFloatExtra("gForce", 0));
                notifyListeners("crashDetected", data);
            }
        };
        emergencyReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent intent) {
                notifyListeners("emergencyConfirmed", new JSObject());
            }
        };
        safeReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent intent) {
                notifyListeners("userSafe", new JSObject());
            }
        };

        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ctx.registerReceiver(crashReceiver,
                new IntentFilter("com.careconnect.CRASH_DETECTED"),
                Context.RECEIVER_NOT_EXPORTED);
            ctx.registerReceiver(emergencyReceiver,
                new IntentFilter("com.careconnect.EMERGENCY_CONFIRMED"),
                Context.RECEIVER_NOT_EXPORTED);
            ctx.registerReceiver(safeReceiver,
                new IntentFilter("com.careconnect.USER_SAFE"),
                Context.RECEIVER_NOT_EXPORTED);
        } else {
            ctx.registerReceiver(crashReceiver,
                new IntentFilter("com.careconnect.CRASH_DETECTED"));
            ctx.registerReceiver(emergencyReceiver,
                new IntentFilter("com.careconnect.EMERGENCY_CONFIRMED"));
            ctx.registerReceiver(safeReceiver,
                new IntentFilter("com.careconnect.USER_SAFE"));
        }
    }

    @Override
    protected void handleOnDestroy() {
        Context ctx = getContext();
        if (crashReceiver != null) ctx.unregisterReceiver(crashReceiver);
        if (emergencyReceiver != null) ctx.unregisterReceiver(emergencyReceiver);
        if (safeReceiver != null) ctx.unregisterReceiver(safeReceiver);
    }

    /* ── Plugin methods ────────────────────────────────────── */

    @PluginMethod()
    public void startMonitoring(PluginCall call) {
        Context ctx = getContext();
        Intent intent = new Intent(ctx, CrashDetectionService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(intent);
        } else {
            ctx.startService(intent);
        }
        Log.i(TAG, "Crash detection service started");
        call.resolve();
    }

    @PluginMethod()
    public void stopMonitoring(PluginCall call) {
        Context ctx = getContext();
        ctx.stopService(new Intent(ctx, CrashDetectionService.class));
        Log.i(TAG, "Crash detection service stopped");
        call.resolve();
    }

    @PluginMethod()
    public void isMonitoring(PluginCall call) {
        JSObject result = new JSObject();
        result.put("monitoring", CrashDetectionService.isRunning());
        call.resolve(result);
    }

    @PluginMethod()
    public void simulateCrash(PluginCall call) {
        Log.i(TAG, "Simulating crash event");
        Intent broadcast = new Intent("com.careconnect.CRASH_DETECTED");
        broadcast.putExtra("level", "accident");
        broadcast.putExtra("gForce", 5.2f);
        getContext().sendBroadcast(broadcast);

        // Also launch the popup
        Intent popup = new Intent(getContext(), EmergencyPopupActivity.class);
        popup.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        popup.putExtra("level", "accident");
        popup.putExtra("gForce", 5.2f);
        getContext().startActivity(popup);

        call.resolve();
    }
}
