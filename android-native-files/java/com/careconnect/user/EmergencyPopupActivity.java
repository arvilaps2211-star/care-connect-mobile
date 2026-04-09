package com.careconnect.user;

import android.app.Activity;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;

/**
 * EmergencyPopupActivity — Displays an emergency confirmation screen
 * that appears OVER the lock screen when a crash is detected.
 *
 * Uses FLAG_SHOW_WHEN_LOCKED + FLAG_TURN_SCREEN_ON so the user sees
 * this even without unlocking. Two buttons:
 *   • EMERGENCY — sends intent back to the Capacitor app to fire the
 *     existing triggerEmergency() flow.
 *   • I'M SAFE — dismisses the popup and stops the alarm.
 */
public class EmergencyPopupActivity extends Activity {

    private static final String TAG = "EmergencyPopup";
    private ToneGenerator toneGenerator;
    private Vibrator vibrator;
    private boolean alarmPlaying = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Show over lock screen and turn screen on
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            );
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Build UI programmatically (no XML layout needed)
        buildUI();

        // Start alarm
        startAlarm();

        Log.i(TAG, "Emergency popup displayed");
    }

    private void buildUI() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(0xFFDC2626); // red-600
        root.setPadding(dp(24), dp(48), dp(24), dp(48));

        // Title
        TextView title = new TextView(this);
        title.setText("⚠️ CRASH DETECTED");
        title.setTextColor(0xFFFFFFFF);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 28);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, 0, 0, dp(16));
        root.addView(title);

        // Subtitle
        String level = getIntent().getStringExtra("level");
        float gForce = getIntent().getFloatExtra("gForce", 0);
        TextView subtitle = new TextView(this);
        subtitle.setText(
            level != null && level.equals("drop")
                ? "A phone drop was detected.\nAre you okay?"
                : String.format("A severe impact (%.1fG) was detected.\nAre you okay?", gForce)
        );
        subtitle.setTextColor(0xDDFFFFFF);
        subtitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        subtitle.setGravity(Gravity.CENTER);
        subtitle.setPadding(0, 0, 0, dp(32));
        root.addView(subtitle);

        // EMERGENCY button
        Button emergencyBtn = new Button(this);
        emergencyBtn.setText("🚨 EMERGENCY");
        emergencyBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        emergencyBtn.setBackgroundColor(0xFFFFFFFF);
        emergencyBtn.setTextColor(0xFFDC2626);
        emergencyBtn.setPadding(dp(16), dp(16), dp(16), dp(16));
        LinearLayout.LayoutParams btnParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(64));
        btnParams.setMargins(0, 0, 0, dp(16));
        emergencyBtn.setLayoutParams(btnParams);
        emergencyBtn.setOnClickListener(v -> onEmergencyTapped());
        root.addView(emergencyBtn);

        // I'M SAFE button
        Button safeBtn = new Button(this);
        safeBtn.setText("✅ I'M SAFE");
        safeBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        safeBtn.setBackgroundColor(0xFF22C55E); // green-500
        safeBtn.setTextColor(0xFFFFFFFF);
        safeBtn.setPadding(dp(16), dp(16), dp(16), dp(16));
        LinearLayout.LayoutParams safeParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(64));
        safeBtn.setLayoutParams(safeParams);
        safeBtn.setOnClickListener(v -> onSafeTapped());
        root.addView(safeBtn);

        setContentView(root);
    }

    private void onEmergencyTapped() {
        Log.i(TAG, "User confirmed EMERGENCY");
        stopAlarm();

        // Send broadcast to Capacitor plugin → triggers JS emergency flow
        Intent intent = new Intent("com.careconnect.EMERGENCY_CONFIRMED");
        sendBroadcast(intent);

        // Also open the main app so the WebView can handle the emergency
        Intent mainIntent = new Intent(this, MainActivity.class);
        mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        mainIntent.putExtra("triggerEmergency", true);
        startActivity(mainIntent);

        finish();
    }

    private void onSafeTapped() {
        Log.i(TAG, "User marked SAFE");
        stopAlarm();

        Intent intent = new Intent("com.careconnect.USER_SAFE");
        sendBroadcast(intent);

        finish();
    }

    /* ── Alarm ─────────────────────────────────────────────── */

    private void startAlarm() {
        alarmPlaying = true;

        // Vibration pattern: 500ms on, 300ms off, repeat
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) getSystemService(VIBRATOR_MANAGER_SERVICE);
                vibrator = vm.getDefaultVibrator();
            } else {
                vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            }
            if (vibrator != null) {
                long[] pattern = {0, 500, 300, 500, 300, 500};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                } else {
                    vibrator.vibrate(pattern, 0);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Vibration failed", e);
        }

        // Tone (loud beep via STREAM_ALARM so it plays even in silent mode)
        try {
            toneGenerator = new ToneGenerator(AudioManager.STREAM_ALARM, 100);
            // Play repeating tone in a background thread
            new Thread(() -> {
                while (alarmPlaying) {
                    try {
                        toneGenerator.startTone(ToneGenerator.TONE_CDMA_EMERGENCY_RINGBACK, 1000);
                        Thread.sleep(1500);
                    } catch (Exception e) { break; }
                }
            }).start();
        } catch (Exception e) {
            Log.w(TAG, "ToneGenerator failed", e);
        }
    }

    private void stopAlarm() {
        alarmPlaying = false;
        if (vibrator != null) vibrator.cancel();
        if (toneGenerator != null) {
            toneGenerator.stopTone();
            toneGenerator.release();
            toneGenerator = null;
        }
    }

    @Override
    protected void onDestroy() {
        stopAlarm();
        super.onDestroy();
    }

    private int dp(int value) {
        return (int) TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, value,
            getResources().getDisplayMetrics());
    }
}
