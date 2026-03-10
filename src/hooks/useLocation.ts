import { useState, useEffect, useCallback, useRef } from "react";
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

export type LocationStatus = "idle" | "requesting" | "granted" | "denied" | "unavailable" | "timeout";

export interface UseLocationOptions {
  /** Enable continuous tracking */
  watch?: boolean;
  /** Enable high accuracy GPS (uses more battery) */
  highAccuracy?: boolean;
  /** Timeout in ms for position requests */
  timeout?: number;
  /** Maximum age of cached position in ms */
  maximumAge?: number;
  /** Update interval in ms when watching (only for periodic refresh) */
  updateInterval?: number;
}

export interface UseLocationResult {
  /** Current location coordinates with accuracy */
  location: LocationData | null;
  /** Current permission/acquisition status */
  status: LocationStatus;
  /** Error message if any */
  error: string | null;
  /** Whether location is being acquired */
  isLoading: boolean;
  /** Manually refresh location */
  refresh: () => Promise<void>;
  /** Request permissions explicitly */
  requestPermission: () => Promise<boolean>;
}

const DEFAULT_OPTIONS: Required<UseLocationOptions> = {
  watch: false,
  highAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
  updateInterval: 10000,
};

/**
 * Check if platform is native (Android/iOS)
 */
const isNative = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Reusable hook for GPS location with Capacitor support
 * Uses Capacitor Geolocation on native, browser API on web
 */
export const useLocation = (options: UseLocationOptions = {}): UseLocationResult => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const [location, setLocation] = useState<LocationData | null>(null);
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const watchIdRef = useRef<string | null>(null);
  const webWatchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Request location permissions (Capacitor on native)
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    // Web platform - permission handled by browser when getting position
    if (!isNative()) {
      console.log('[useLocation] Web platform - permissions handled by browser');
      return true;
    }

    try {
      setStatus("requesting");
      console.log('[useLocation] Checking native permissions...');
      
      // Check current permission status
      const currentPermission = await Geolocation.checkPermissions();
      console.log('[useLocation] Current permission status:', currentPermission);
      
      // Already granted
      if (currentPermission.location === "granted" || currentPermission.coarseLocation === "granted") {
        console.log('[useLocation] Permission already granted');
        setStatus("granted");
        return true;
      }

      // Previously denied - need to go to settings
      if (currentPermission.location === "denied") {
        console.log('[useLocation] Permission was denied - user needs to enable in settings');
        setStatus("denied");
        setError("Location permission denied. Please enable in Settings > Apps > CareConnect > Permissions.");
        return false;
      }

      // Request permission - this triggers the Android permission dialog
      console.log('[useLocation] Requesting permission from system...');
      const result = await Geolocation.requestPermissions();
      console.log('[useLocation] Permission request result:', result);
      
      const granted = result.location === "granted" || result.coarseLocation === "granted";
      
      if (granted) {
        setStatus("granted");
        setError(null);
        console.log('[useLocation] Permission granted!');
      } else {
        setStatus("denied");
        setError("Location permission was not granted. Please enable it in your device settings.");
        console.log('[useLocation] Permission not granted');
      }
      
      return granted;
    } catch (err: any) {
      console.error("[useLocation] Permission request error:", err);
      setStatus("unavailable");
      setError(err?.message || "Failed to request location permission");
      return false;
    }
  }, []);

  // Get current position (one-time)
  const getCurrentPosition = useCallback(async (): Promise<LocationData | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // Check/request permission on native
      if (Capacitor.isNativePlatform()) {
        const hasPermission = await requestPermission();
        if (!hasPermission) {
          setIsLoading(false);
          return null;
        }
      }

      if (Capacitor.getPlatform() === "web") {
        // Web fallback
        return new Promise((resolve) => {
          if (!navigator.geolocation) {
            setStatus("unavailable");
            setError("Geolocation is not supported by this browser");
            setIsLoading(false);
            resolve(null);
            return;
          }

          navigator.geolocation.getCurrentPosition(
            (position) => {
              const loc: LocationData = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp,
              };
              setLocation(loc);
              setStatus("granted");
              setIsLoading(false);
              resolve(loc);
            },
            (err) => {
              console.error("[useLocation] Web geolocation error:", err);
              let errMsg = "Unable to get location";
              let newStatus: LocationStatus = "unavailable";
              
              switch (err.code) {
                case err.PERMISSION_DENIED:
                  errMsg = "Location permission denied. Please allow location access.";
                  newStatus = "denied";
                  break;
                case err.POSITION_UNAVAILABLE:
                  errMsg = "Location unavailable. Please check GPS settings.";
                  newStatus = "unavailable";
                  break;
                case err.TIMEOUT:
                  errMsg = "Location request timed out. Please try again.";
                  newStatus = "timeout";
                  break;
              }
              
              setError(errMsg);
              setStatus(newStatus);
              setIsLoading(false);
              resolve(null);
            },
            {
              enableHighAccuracy: opts.highAccuracy,
              timeout: opts.timeout,
              maximumAge: opts.maximumAge,
            }
          );
        });
      }

      // Native: Use Capacitor Geolocation
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: opts.highAccuracy,
        timeout: opts.timeout,
        maximumAge: opts.maximumAge,
      });

      const loc: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      };

      setLocation(loc);
      setStatus("granted");
      setIsLoading(false);
      return loc;
    } catch (err: any) {
      console.error("[useLocation] getCurrentPosition error:", err);
      
      let errMsg = err?.message || "Unable to get location";
      let newStatus: LocationStatus = "unavailable";
      
      if (errMsg.toLowerCase().includes("timeout")) {
        newStatus = "timeout";
        errMsg = "Location request timed out. Please ensure GPS is enabled.";
      } else if (errMsg.toLowerCase().includes("denied") || errMsg.toLowerCase().includes("permission")) {
        newStatus = "denied";
      }
      
      setError(errMsg);
      setStatus(newStatus);
      setIsLoading(false);
      return null;
    }
  }, [opts.highAccuracy, opts.timeout, opts.maximumAge, requestPermission]);

  // Start watching position
  const startWatching = useCallback(async () => {
    // Check/request permission first
    if (Capacitor.isNativePlatform()) {
      const hasPermission = await requestPermission();
      if (!hasPermission) return;
    }

    if (Capacitor.getPlatform() === "web") {
      // Web watch
      if (!navigator.geolocation) {
        setStatus("unavailable");
        setError("Geolocation is not supported");
        return;
      }

      webWatchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          });
          setStatus("granted");
          setError(null);
        },
        (err) => {
          console.error("[useLocation] Web watch error:", err);
          setError(err.message);
        },
        {
          enableHighAccuracy: opts.highAccuracy,
          timeout: opts.timeout,
          maximumAge: opts.maximumAge,
        }
      );
      return;
    }

    // Native watch using Capacitor
    try {
      const id = await Geolocation.watchPosition(
        {
          enableHighAccuracy: opts.highAccuracy,
          timeout: opts.timeout,
          maximumAge: opts.maximumAge,
        },
        (position, err) => {
          if (err) {
            console.error("[useLocation] Native watch error:", err);
            setError(err.message || "Watch position error");
            return;
          }
          if (position) {
            setLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp,
            });
            setStatus("granted");
            setError(null);
          }
        }
      );
      watchIdRef.current = id;
    } catch (err: any) {
      console.error("[useLocation] Failed to start watching:", err);
      setError(err?.message || "Failed to start location tracking");
    }
  }, [opts.highAccuracy, opts.timeout, opts.maximumAge, requestPermission]);

  // Stop watching
  const stopWatching = useCallback(async () => {
    // Clear interval if using periodic refresh
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (webWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(webWatchIdRef.current);
      webWatchIdRef.current = null;
    }
    
    if (watchIdRef.current !== null) {
      try {
        await Geolocation.clearWatch({ id: watchIdRef.current });
      } catch (e) {
        // Ignore
      }
      watchIdRef.current = null;
    }
  }, []);

  // Refresh location manually
  const refresh = useCallback(async () => {
    await getCurrentPosition();
  }, [getCurrentPosition]);

  // Initialize on mount
  useEffect(() => {
    console.log('[useLocation] Initializing, watch:', opts.watch, 'platform:', Capacitor.getPlatform());
    
    if (opts.watch) {
      startWatching();
      
      // Also set up periodic refresh every updateInterval ms
      if (opts.updateInterval > 0) {
        intervalRef.current = setInterval(() => {
          console.log('[useLocation] Periodic refresh...');
          getCurrentPosition();
        }, opts.updateInterval);
      }
    } else {
      getCurrentPosition();
    }

    return () => {
      console.log('[useLocation] Cleaning up...');
      stopWatching();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.watch]);

  return {
    location,
    status,
    error,
    isLoading,
    refresh,
    requestPermission,
  };
};
