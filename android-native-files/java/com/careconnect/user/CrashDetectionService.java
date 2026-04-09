package com.careconnect.user;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/**
 * CrashDetectionService — Android foreground service that monitors
 * accelerometer data for sudden high-G impacts indicative of a vehicle
 * crash or severe fall.
 *
 * Detection algorithm:
 *   1. Compute magnitude of linear acceleration (excluding gravity).
 *   2. Maintain a 5-sample moving average to smooth noise.
 *   3. If smoothed magnitude exceeds ACCIDENT_THRESHOLD (3.8G) for at
 *      least SUSTAINED_MS (50 ms) AND the device was NOT stationary
 *      immediately before, fire a crash event.
 *   4. Lower threshold (2.0–3.5G) fires a "drop" warning event.
 *
 * When a crash is detected the service:
 *   • Launches EmergencyPopupActivity (shows over lock screen).
 *   • Sends a broadcast/intent that the Capacitor plugin relays to JS.
 */
public class CrashDetectionService extends Service implements SensorEventListener {

    private static final String TAG = "CrashDetection";

    // Notification
    public static final String CHANNEL_ID = "crash_detection_channel";
    private static final int NOTIFICATION_ID = 9001;

    // Thresholds (in G, where 1G ≈ 9.81 m/s²)
    private static final float DROP_THRESHOLD   = 2.0f;
    private static final float ACCIDENT_THRESHOLD = 3.8f;
    private static final float GRAVITY = 9.81f;
    private static final long  SUSTAINED_MS = 50;
    private static final int   SMOOTHING_WINDOW = 5;
    private static final float STATIONARY_G = 0.15f;
    private static final long  COOLDOWN_MS = 15_000;

    // State
    private SensorManager sensorManager;
    private Sensor accelerometer;
    private PowerManager.WakeLock wakeLock;

    private final float[] history = new float[SMOOTHING_WINDOW];
    private int historyIndex = 0;
    private int historyCount = 0;

    private float lastX, lastY, lastZ;
    private boolean hasLastReading = false;

    private long highImpactStart = -1;
    private int  highImpactSamples = 0;
    private long lastTriggerTime = 0;

    // Stationary detection (last 10 samples)
    private final float[] stationaryBuf = new float[10];
    private int stationaryIdx = 0;
    private int stationaryCount = 0;

    // Static flag so the Capacitor plugin can query state
    private static boolean sIsRunning = false;
    public static boolean isRunning() { return sIsRunning; }

    /* ── Lifecycle ─────────────────────────────────────────── */

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.i(TAG, "Starting crash detection foreground service");

        // Acquire partial wake lock so CPU stays on
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "CareConnect::CrashDetection");
        wakeLock.acquire();

        // Start foreground with persistent notification
        startForeground(NOTIFICATION_ID, buildNotification());

        // Register accelerometer listener (SENSOR_DELAY_UI ≈ 60 ms)
        if (accelerometer != null) {
            sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_UI);
        } else {
            Log.e(TAG, "No accelerometer sensor available on this device");
        }

        sIsRunning = true;
        return START_STICKY; // Restart if killed
    }

    @Override
    public void onDestroy() {
        Log.i(TAG, "Stopping crash detection service");
        sIsRunning = false;
        if (sensorManager != null) sensorManager.unregisterListener(this);
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    /* ── Sensor callbacks ──────────────────────────────────── */

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() != Sensor.TYPE_ACCELEROMETER) return;

        float ax = event.values[0];
        float ay = event.values[1];
        float az = event.values[2];

        if (!hasLastReading) {
            lastX = ax; lastY = ay; lastZ = az;
            hasLastReading = true;
            return;
        }

        // Delta-based detection (sudden change)
        float dx = Math.abs(ax - lastX);
        float dy = Math.abs(ay - lastY);
        float dz = Math.abs(az - lastZ);
        float magnitude = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
        float gForce = magnitude / GRAVITY;

        lastX = ax; lastY = ay; lastZ = az;

        // Update stationary buffer
        stationaryBuf[stationaryIdx % stationaryBuf.length] = gForce;
        stationaryIdx++;
        if (stationaryCount < stationaryBuf.length) stationaryCount++;

        // Smoothed g-force
        history[historyIndex % SMOOTHING_WINDOW] = gForce;
        historyIndex++;
        if (historyCount < SMOOTHING_WINDOW) historyCount++;
        float smoothed = 0;
        for (int i = 0; i < historyCount; i++) smoothed += history[i];
        smoothed /= historyCount;

        // Skip low activity
        if (smoothed < DROP_THRESHOLD) {
            highImpactStart = -1;
            highImpactSamples = 0;
            return;
        }

        // Cooldown
        long now = System.currentTimeMillis();
        if (now - lastTriggerTime < COOLDOWN_MS) return;

        // Stationary check (ignore if device was sitting still → picked up)
        boolean stationary = isStationary();
        if (stationary && smoothed < ACCIDENT_THRESHOLD) return;

        // Sustained impact validation
        if (highImpactStart < 0) {
            highImpactStart = now;
            highImpactSamples = 1;
        } else {
            highImpactSamples++;
        }

        long elapsed = now - highImpactStart;

        if (smoothed >= ACCIDENT_THRESHOLD && elapsed >= SUSTAINED_MS && highImpactSamples >= 2) {
            Log.w(TAG, "CRASH DETECTED! G=" + smoothed + " duration=" + elapsed + "ms");
            lastTriggerTime = now;
            highImpactStart = -1;
            highImpactSamples = 0;
            onCrashDetected("accident", smoothed);
        } else if (smoothed >= DROP_THRESHOLD && smoothed < ACCIDENT_THRESHOLD
                   && elapsed >= SUSTAINED_MS && highImpactSamples >= 2) {
            Log.i(TAG, "DROP detected. G=" + smoothed);
            lastTriggerTime = now;
            highImpactStart = -1;
            highImpactSamples = 0;
            onCrashDetected("drop", smoothed);
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) { /* unused */ }

    /* ── Crash action ──────────────────────────────────────── */

    private void onCrashDetected(String level, float gForce) {
        // 1. Launch emergency popup over lock screen
        Intent popup = new Intent(this, EmergencyPopupActivity.class);
        popup.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        popup.putExtra("level", level);
        popup.putExtra("gForce", gForce);
        startActivity(popup);

        // 2. Broadcast so Capacitor plugin can relay to JS
        Intent broadcast = new Intent("com.careconnect.CRASH_DETECTED");
        broadcast.putExtra("level", level);
        broadcast.putExtra("gForce", gForce);
        sendBroadcast(broadcast);
    }

    /* ── Helpers ────────────────────────────────────────────── */

    private boolean isStationary() {
        if (stationaryCount < 5) return false;
        float sum = 0;
        for (int i = 0; i < stationaryCount; i++) sum += stationaryBuf[i];
        return (sum / stationaryCount) < STATIONARY_G;
    }

    private Notification buildNotification() {
        Intent tapIntent = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(this, 0, tapIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("CareConnect Monitoring")
                .setContentText("Crash detection is active")
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setOngoing(true)
                .setContentIntent(pi)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Crash Detection",
                    NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Persistent notification while crash monitoring is active");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }
}
