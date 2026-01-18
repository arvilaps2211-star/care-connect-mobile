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
  timeout: 15000,
  maximumAge: 0,
};

/**
 * Reusable hook for GPS location with Capacitor support
 * Works on both native (Android/iOS) and web platforms
 */
export const useLocation = (options: UseLocationOptions = {}): UseLocationResult => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const [location, setLocation] = useState<LocationData | null>(null);
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const watchIdRef = useRef<string | null>(null);
  const webWatchIdRef = useRef<number | null>(null);

  // Request permissions (native only)
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
      // On web, permission is requested when getting position
      return true;
    }

    try {
      setStatus("requesting");
      const currentPermission = await Geolocation.checkPermissions();
      
      if (currentPermission.location === "granted") {
        setStatus("granted");
        return true;
      }

      if (currentPermission.location === "denied") {
        setStatus("denied");
        setError("Location permission was previously denied. Please enable it in settings.");
        return false;
      }

      // Request permission
      const result = await Geolocation.requestPermissions();
      const granted = result.location === "granted" || result.coarseLocation === "granted";
      
      setStatus(granted ? "granted" : "denied");
      if (!granted) {
        setError("Location permission denied. Please enable location access in your device settings.");
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
    if (opts.watch) {
      startWatching();
    } else {
      getCurrentPosition();
    }

    return () => {
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
