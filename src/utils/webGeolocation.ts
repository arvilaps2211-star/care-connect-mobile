/**
 * Web-safe geolocation utilities for desktop dashboards.
 * Provides graceful fallbacks when GPS is unavailable.
 */

export interface WebLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
  isDefault?: boolean;
}

// Default location (India center) when GPS is unavailable
const DEFAULT_LOCATION: WebLocation = {
  latitude: 20.5937,
  longitude: 78.9629,
  accuracy: 100000, // 100km - indicates low accuracy
  isDefault: true,
};

/**
 * Check if geolocation is available in the browser
 */
export const isGeolocationAvailable = (): boolean => {
  const available = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  console.log('[WEB-GEO] Geolocation available:', available);
  return available;
};

/**
 * Get current position with graceful fallback for web.
 * Returns default location if GPS is unavailable or fails.
 */
export const getWebLocation = (): Promise<WebLocation> => {
  return new Promise((resolve) => {
    if (!isGeolocationAvailable()) {
      console.log('[WEB-GEO] Geolocation not available, using default location');
      resolve(DEFAULT_LOCATION);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('[WEB-GEO] Got position:', position.coords.latitude, position.coords.longitude);
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          isDefault: false,
        });
      },
      (error) => {
        console.warn('[WEB-GEO] Geolocation error:', error.code, error.message, '- using default location');
        resolve(DEFAULT_LOCATION);
      },
      {
        enableHighAccuracy: false, // Don't require high accuracy for web
        timeout: 10000,
        maximumAge: 300000, // 5 minutes cache is fine for web
      }
    );
  });
};

/**
 * Watch position with graceful error handling for web.
 * Calls onError instead of throwing when GPS fails.
 */
export const watchWebLocation = (
  onSuccess: (location: WebLocation) => void,
  onError?: (error: GeolocationPositionError | null) => void
): (() => void) => {
  if (!isGeolocationAvailable()) {
    console.log('[WEB-GEO] Geolocation not available, watch skipped');
    onError?.(null);
    // Return no-op cleanup
    return () => {};
  }

  console.log('[WEB-GEO] Starting location watch...');
  
  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      onSuccess({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
        isDefault: false,
      });
    },
    (error) => {
      console.warn('[WEB-GEO] Watch position error:', error.code, error.message);
      onError?.(error);
    },
    {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    }
  );

  // Return cleanup function
  return () => {
    console.log('[WEB-GEO] Stopping location watch');
    navigator.geolocation.clearWatch(watchId);
  };
};

/**
 * Get the default fallback location
 */
export const getDefaultLocation = (): WebLocation => {
  return { ...DEFAULT_LOCATION };
};
