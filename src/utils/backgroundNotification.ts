import { Capacitor } from '@capacitor/core';
import { LocalNotifications, ScheduleOptions, ActionPerformed } from '@capacitor/local-notifications';
import { notifyDiag, backgroundDiag } from '@/utils/safetyDiagnostics';

export type NotificationAction = 'safe' | 'sos';

interface BackgroundNotificationCallbacks {
  onSafe: () => void;
  onSOS: () => void;
}

let notificationCallbacks: BackgroundNotificationCallbacks | null = null;
let isInitialized = false;

/**
 * Initialize background notification listeners
 * Should be called once on app startup
 */
export const initializeBackgroundNotifications = async (
  callbacks: BackgroundNotificationCallbacks
): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    notifyDiag.webFallback();
    return;
  }

  if (isInitialized) {
    notificationCallbacks = callbacks;
    return;
  }

  notificationCallbacks = callbacks;

  try {
    // Request permission
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display !== 'granted') {
      notifyDiag.permissionDenied();
      return;
    }

    // Create emergency channel first (Android requires this)
    await createEmergencyChannel();

    // Register action types for the notification
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: 'emergency-actions',
          actions: [
            {
              id: 'safe',
              title: "✓ I'm Safe",
              foreground: true, // Bring app to foreground
            },
            {
              id: 'sos',
              title: '🚨 Send SOS',
              foreground: true,
              destructive: true, // Show in red on iOS
            },
          ],
        },
      ],
    });

    // Listen for notification action performed
    await LocalNotifications.addListener(
      'localNotificationActionPerformed',
      (notification: ActionPerformed) => {
        notifyDiag.actionTapped(notification.actionId);
        
        if (!notificationCallbacks) return;

        switch (notification.actionId) {
          case 'safe':
            notificationCallbacks.onSafe();
            break;
          case 'sos':
            notificationCallbacks.onSOS();
            break;
          case 'tap':
            // User tapped the notification body - treat as needing attention
            // App will open, so user can make a choice in the UI
            break;
        }

        // Cancel the notification after action
        LocalNotifications.cancel({ notifications: [{ id: notification.notification.id }] });
      }
    );

    // Listen for notification received while app is in foreground
    await LocalNotifications.addListener(
      'localNotificationReceived',
      (notification) => {
        // Notification shown while app is active - UI will handle it
        console.log('[BackgroundNotification] Notification received in foreground:', notification.id);
      }
    );

    isInitialized = true;
    backgroundDiag.active();
  } catch (error) {
    console.error('[BackgroundNotification] Error initializing:', error);
    notifyDiag.blocked(String(error));
  }
};

/**
 * Show high-priority emergency notification (for background/minimized/lock screen state)
 * Uses full-screen intent for lock screen visibility on Android
 */
export const showEmergencyNotification = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    notifyDiag.webFallback();
    showBrowserNotification();
    return;
  }

  try {
    // Check permission first
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') {
      notifyDiag.blocked('permission not granted');
      return;
    }

    const notificationId = Date.now();

    const options: ScheduleOptions = {
      notifications: [
        {
          id: notificationId,
          title: '🚨 EMERGENCY DETECTED',
          body: 'High impact detected! Are you okay?',
          largeBody: 'A potential accident has been detected. Please confirm if you are safe or if you need emergency assistance immediately.',
          actionTypeId: 'emergency-actions',
          extra: { type: 'accident-detection', timestamp: Date.now() },
          
          // Android-specific settings for lock screen visibility
          ongoing: true,           // Cannot be swiped away
          autoCancel: false,       // Don't dismiss on tap
          channelId: 'emergency-alerts',
          sound: 'default',
          
          // Schedule immediately
          schedule: { at: new Date(Date.now()) },
        },
      ],
    };

    await LocalNotifications.schedule(options);
    notifyDiag.shown();
  } catch (error) {
    console.error('[BackgroundNotification] Error showing notification:', error);
    notifyDiag.blocked(String(error));
  }
};

/**
 * Fallback for web browser notifications
 */
const showBrowserNotification = (): void => {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    const notification = new Notification('🚨 EMERGENCY DETECTED', {
      body: 'High impact detected! Click to respond.',
      icon: '/favicon.ico',
      tag: 'emergency-detection',
      requireInteraction: true,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        showBrowserNotification();
      }
    });
  }
};

/**
 * Cancel all emergency notifications
 */
export const cancelEmergencyNotifications = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const pending = await LocalNotifications.getPending();
    const emergencyNotifications = pending.notifications.filter(
      n => n.extra?.type === 'accident-detection'
    );

    if (emergencyNotifications.length > 0) {
      await LocalNotifications.cancel({ 
        notifications: emergencyNotifications.map(n => ({ id: n.id }))
      });
      console.log('[BackgroundNotification] Cancelled', emergencyNotifications.length, 'notification(s)');
    }
  } catch (error) {
    console.error('[BackgroundNotification] Error canceling notifications:', error);
  }
};

/**
 * Create notification channel for Android (call once on app init)
 * Uses IMPORTANCE_HIGH (4) for heads-up display and lock screen visibility
 */
export const createEmergencyChannel = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  // Check if already on Android (channels are Android-only)
  if (Capacitor.getPlatform() !== 'android') return;

  try {
    await LocalNotifications.createChannel({
      id: 'emergency-alerts',
      name: 'Emergency Alerts',
      description: 'Critical alerts for accident detection. Shows on lock screen.',
      importance: 5,     // IMPORTANCE_HIGH - shows as heads-up, appears on lock screen
      visibility: 1,     // VISIBILITY_PUBLIC - show on lock screen
      sound: 'default',
      vibration: true,
      lights: true,
      lightColor: '#FF0000',
    });
    notifyDiag.channelCreated();
  } catch (error) {
    console.error('[BackgroundNotification] Error creating channel:', error);
  }
};

/**
 * Check if background notifications are properly configured
 */
export const checkNotificationStatus = async (): Promise<{
  permitted: boolean;
  channelExists: boolean;
  isNative: boolean;
}> => {
  const isNative = Capacitor.isNativePlatform();
  
  if (!isNative) {
    return { permitted: true, channelExists: false, isNative: false };
  }

  try {
    const permission = await LocalNotifications.checkPermissions();
    const channels = await LocalNotifications.listChannels();
    const channelExists = channels.channels.some(c => c.id === 'emergency-alerts');

    return {
      permitted: permission.display === 'granted',
      channelExists,
      isNative: true,
    };
  } catch {
    return { permitted: false, channelExists: false, isNative: true };
  }
};
