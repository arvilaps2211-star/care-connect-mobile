import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { PushNotifications } from '@capacitor/push-notifications';

/**
 * Request location permissions on native platforms
 * Returns true if permission was granted
 */
export const requestLocationPermission = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) {
    // On web, we'll request permission when needed
    return true;
  }

  try {
    // Check current permission status
    const status = await Geolocation.checkPermissions();
    
    if (status.location === 'granted' || status.coarseLocation === 'granted') {
      console.log('[Permissions] Location already granted');
      return true;
    }

    if (status.location === 'denied') {
      console.log('[Permissions] Location previously denied');
      return false;
    }

    // Request permission
    const result = await Geolocation.requestPermissions();
    const granted = result.location === 'granted' || result.coarseLocation === 'granted';
    console.log('[Permissions] Location permission result:', granted);
    return granted;
  } catch (error) {
    console.error('[Permissions] Error requesting location permission:', error);
    return false;
  }
};

/**
 * Request push notification permissions on native platforms
 * Returns true if permission was granted
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) {
    // Web doesn't use Capacitor push notifications
    return true;
  }

  try {
    // Check current permission status
    const status = await PushNotifications.checkPermissions();
    
    if (status.receive === 'granted') {
      console.log('[Permissions] Push notifications already granted');
      return true;
    }

    if (status.receive === 'denied') {
      console.log('[Permissions] Push notifications previously denied');
      return false;
    }

    // Request permission
    const result = await PushNotifications.requestPermissions();
    const granted = result.receive === 'granted';
    console.log('[Permissions] Push notification permission result:', granted);
    
    if (granted) {
      // Register for push notifications
      await PushNotifications.register();
      console.log('[Permissions] Registered for push notifications');
    }
    
    return granted;
  } catch (error) {
    console.error('[Permissions] Error requesting notification permission:', error);
    return false;
  }
};

/**
 * Request all required permissions for the app
 * Call this on app startup for native platforms
 */
export const requestAllPermissions = async (): Promise<{
  location: boolean;
  notifications: boolean;
}> => {
  console.log('[Permissions] Requesting all permissions...');
  
  const [location, notifications] = await Promise.all([
    requestLocationPermission(),
    requestNotificationPermission(),
  ]);

  console.log('[Permissions] Results:', { location, notifications });
  
  return { location, notifications };
};

/**
 * Setup push notification listeners
 */
export const setupPushNotificationListeners = (): void => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  // On registration success
  PushNotifications.addListener('registration', (token) => {
    console.log('[Push] Registration token:', token.value);
    // TODO: Send this token to your backend for sending push notifications
  });

  // On registration error
  PushNotifications.addListener('registrationError', (error) => {
    console.error('[Push] Registration error:', error);
  });

  // On push notification received (app in foreground)
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('[Push] Notification received:', notification);
  });

  // On push notification action performed (user tapped notification)
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log('[Push] Action performed:', action);
  });
};
