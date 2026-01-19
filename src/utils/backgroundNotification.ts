import { Capacitor } from '@capacitor/core';
import { LocalNotifications, ScheduleOptions, ActionPerformed } from '@capacitor/local-notifications';

export type NotificationAction = 'safe' | 'sos';

interface BackgroundNotificationCallbacks {
  onSafe: () => void;
  onSOS: () => void;
}

let notificationCallbacks: BackgroundNotificationCallbacks | null = null;

/**
 * Initialize background notification listeners
 */
export const initializeBackgroundNotifications = async (
  callbacks: BackgroundNotificationCallbacks
): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    console.log('[BackgroundNotification] Not on native platform, skipping init');
    return;
  }

  notificationCallbacks = callbacks;

  try {
    // Request permission
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display !== 'granted') {
      console.warn('[BackgroundNotification] Permission not granted');
      return;
    }

    // Register action types for the notification
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: 'emergency-actions',
          actions: [
            {
              id: 'safe',
              title: "I'm Safe",
            },
            {
              id: 'sos',
              title: 'Send SOS',
            },
          ],
        },
      ],
    });

    // Listen for notification action performed
    await LocalNotifications.addListener(
      'localNotificationActionPerformed',
      (notification: ActionPerformed) => {
        console.log('[BackgroundNotification] Action performed:', notification.actionId);
        
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
            break;
        }

        // Cancel the notification after action
        LocalNotifications.cancel({ notifications: [{ id: notification.notification.id }] });
      }
    );

    console.log('[BackgroundNotification] Initialized successfully');
  } catch (error) {
    console.error('[BackgroundNotification] Error initializing:', error);
  }
};

/**
 * Show high-priority emergency notification (for background/minimized state)
 */
export const showEmergencyNotification = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    console.log('[BackgroundNotification] Not on native platform, using browser notification');
    showBrowserNotification();
    return;
  }

  try {
    const options: ScheduleOptions = {
      notifications: [
        {
          id: Date.now(),
          title: '🚨 EMERGENCY DETECTED',
          body: 'High impact detected! Are you okay? Tap to respond.',
          largeBody: 'A potential accident has been detected. Please confirm if you are safe or need emergency assistance.',
          actionTypeId: 'emergency-actions',
          extra: { type: 'accident-detection' },
          ongoing: true,
          autoCancel: false,
          channelId: 'emergency-alerts',
          sound: 'default',
        },
      ],
    };

    await LocalNotifications.schedule(options);
    console.log('[BackgroundNotification] Emergency notification shown');
  } catch (error) {
    console.error('[BackgroundNotification] Error showing notification:', error);
  }
};

/**
 * Fallback for web browser notifications
 */
const showBrowserNotification = (): void => {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    new Notification('🚨 EMERGENCY DETECTED', {
      body: 'High impact detected! Tap to respond.',
      icon: '/favicon.ico',
      tag: 'emergency-detection',
      requireInteraction: true,
    });
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
    }
  } catch (error) {
    console.error('[BackgroundNotification] Error canceling notifications:', error);
  }
};

/**
 * Create notification channel for Android (call once on app init)
 */
export const createEmergencyChannel = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await LocalNotifications.createChannel({
      id: 'emergency-alerts',
      name: 'Emergency Alerts',
      description: 'High-priority alerts for accident detection',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
      lights: true,
      lightColor: '#FF0000',
    });
    console.log('[BackgroundNotification] Emergency channel created');
  } catch (error) {
    console.error('[BackgroundNotification] Error creating channel:', error);
  }
};
