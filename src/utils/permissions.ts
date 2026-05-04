import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { PushNotifications } from '@capacitor/push-notifications';

/**
 * Check if we're on a native platform (Android/iOS)
 */
export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Check current location permission status
 */
export const checkLocationPermission = async (): Promise<'granted' | 'denied' | 'prompt'> => {
  if (!Capacitor.isNativePlatform()) {
    // On web, return 'prompt' to indicate we need to request
    return 'prompt';
  }

  try {
    const status = await Geolocation.checkPermissions();
    console.log('[Permissions] Current location status:', status);
    
    if (status.location === 'granted' || status.coarseLocation === 'granted') {
      return 'granted';
    }
    if (status.location === 'denied') {
      return 'denied';
    }
    return 'prompt';
  } catch (error) {
    console.error('[Permissions] Error checking location permission:', error);
    return 'prompt';
  }
};

/**
 * Request location permissions on native platforms
 * Returns true if permission was granted
 */
export const requestLocationPermission = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) {
    // On web, permission is requested when getCurrentPosition is called
    console.log('[Permissions] Web platform - location permission handled by browser');
    return true;
  }

  try {
    // Check current permission status first
    const currentStatus = await Geolocation.checkPermissions();
    console.log('[Permissions] Current location permission:', currentStatus);
    
    // Already granted
    if (currentStatus.location === 'granted' || currentStatus.coarseLocation === 'granted') {
      console.log('[Permissions] Location already granted');
      return true;
    }

    // Previously denied - user needs to enable in settings
    if (currentStatus.location === 'denied') {
      console.log('[Permissions] Location previously denied - needs settings');
      return false;
    }

    // Request permission - this should trigger the Android popup
    console.log('[Permissions] Requesting location permission...');
    const result = await Geolocation.requestPermissions();
    console.log('[Permissions] Request result:', result);
    
    const granted = result.location === 'granted' || result.coarseLocation === 'granted';
    console.log('[Permissions] Location permission granted:', granted);
    
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
    console.log('[Permissions] Current notification status:', status);
    
    if (status.receive === 'granted') {
      console.log('[Permissions] Push notifications already granted');
      return true;
    }

    if (status.receive === 'denied') {
      console.log('[Permissions] Push notifications previously denied');
      return false;
    }

    // Request permission
    console.log('[Permissions] Requesting notification permission...');
    const result = await PushNotifications.requestPermissions();
    const granted = result.receive === 'granted';
    console.log('[Permissions] Notification permission granted:', granted);
    
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
  console.log('[Permissions] Platform:', Capacitor.getPlatform());
  console.log('[Permissions] Is native:', Capacitor.isNativePlatform());
  
  // Request location first, then notifications
  const location = await requestLocationPermission();
  const notifications = await requestNotificationPermission();

  console.log('[Permissions] Final results:', { location, notifications });
  
  return { location, notifications };
};

/**
 * Setup push notification listeners
 */
export const setupPushNotificationListeners = (): void => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  console.log('[Push] Setting up notification listeners...');

  // On registration success — store token in fcm_tokens
  PushNotifications.addListener('registration', async (token) => {
    console.log('[Push] Registration token received');
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) { console.warn('[Push] no user, token not stored'); return; }
      const { error } = await supabase.from('fcm_tokens').upsert({
        user_id: userId,
        token: token.value,
        device_type: Capacitor.getPlatform(),
      }, { onConflict: 'user_id' });
      if (error) console.error('[Push] token store failed', error.message);
      else console.log('[Push] token stored');
    } catch (e) { console.error('[Push] token store error', e); }
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

/**
 * Test location by getting a single position
 * Useful for verifying GPS is working
 */
export const testLocationAccess = async (): Promise<{
  success: boolean;
  coords?: { latitude: number; longitude: number; accuracy?: number };
  error?: string;
}> => {
  if (!Capacitor.isNativePlatform()) {
    // Web test using browser API
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ success: false, error: 'Geolocation not supported' });
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            success: true,
            coords: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            },
          });
        },
        (error) => {
          resolve({ success: false, error: error.message });
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  try {
    // First ensure we have permission
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      return { success: false, error: 'Location permission not granted' };
    }

    // Try to get position
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });

    return {
      success: true,
      coords: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      },
    };
  } catch (error: any) {
    console.error('[Permissions] Test location error:', error);
    return { success: false, error: error?.message || 'Failed to get location' };
  }
};
