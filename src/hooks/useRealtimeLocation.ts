import { useState, useEffect, useCallback, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

export interface RealtimeLocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
}

export type AccuracyGrade = "excellent" | "good" | "fair" | "poor";

/**
 * Known bogus coordinates to reject (e.g. Android emulator default)
 */
const BOGUS_COORDS: Array<{ lat: number; lng: number }> = [
  { lat: 37.421998, lng: -122.084 }, // Google HQ / Android emulator default
  { lat: 37.4220936, lng: -122.083922 },
];

function isBogus(lat: number, lng: number): boolean {
  return BOGUS_COORDS.some(
    (c) => Math.abs(lat - c.lat) < 0.001 && Math.abs(lng - c.lng) < 0.001
  );
}

function isValidCoord(lat: number, lng: number): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    lat !== 0 &&
    lng !== 0
  );
}

export function getAccuracyGrade(accuracy: number | null): AccuracyGrade {
  if (accuracy == null) return "poor";
  if (accuracy < 10) return "excellent";
  if (accuracy < 30) return "good";
  if (accuracy < 50) return "fair";
  return "poor";
}

export function useRealtimeLocation(options?: {
  /** Max accuracy (meters) to accept. Default 100 */
  maxAccuracy?: number;
  /** Enable watching. Default true */
  enabled?: boolean;
}) {
  const { maxAccuracy = 100, enabled = true } = options ?? {};

  const [location, setLocation] = useState<RealtimeLocationData | null>(null);
  const [history, setHistory] = useState<RealtimeLocationData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  const processPosition = useCallback(
    (coords: GeolocationCoordinates, timestamp: number) => {
      const { latitude, longitude, accuracy, altitude, speed, heading } = coords;

      if (!isValidCoord(latitude, longitude)) {
        console.warn("[RealtimeLocation] Invalid coordinates rejected:", latitude, longitude);
        return;
      }

      if (isBogus(latitude, longitude)) {
        console.warn("[RealtimeLocation] Bogus (emulator) coordinates rejected:", latitude, longitude);
        return;
      }

      if (accuracy != null && accuracy > maxAccuracy) {
        console.log("[RealtimeLocation] Low accuracy rejected:", accuracy, "m");
        return;
      }

      const entry: RealtimeLocationData = {
        latitude,
        longitude,
        accuracy: accuracy ?? 999,
        altitude: altitude ?? null,
        speed: speed ?? null,
        heading: heading ?? null,
        timestamp,
      };

      setLocation(entry);
      setHistory((prev) => [...prev.slice(-29), entry]);
      setError(null);
    },
    [maxAccuracy]
  );

  const startWatching = useCallback(async () => {
    if (!enabled) return;

    try {
      if (Capacitor.getPlatform() === "web") {
        if (!navigator.geolocation) {
          setError("Geolocation not supported");
          return;
        }
        const id = navigator.geolocation.watchPosition(
          (pos) => processPosition(pos.coords, pos.timestamp),
          (err) => setError(err.message),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
        cleanupRef.current = () => navigator.geolocation.clearWatch(id);
      } else {
        const perm = await Geolocation.checkPermissions();
        if (perm.location !== "granted") {
          const req = await Geolocation.requestPermissions();
          if (req.location !== "granted") {
            setError("Location permission denied");
            return;
          }
        }

        const id = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
          (position, err) => {
            if (err) {
              setError(err.message ?? "Watch error");
              return;
            }
            if (position) {
              processPosition(position.coords as any, position.timestamp);
            }
          }
        );
        cleanupRef.current = () => {
          Geolocation.clearWatch({ id }).catch(() => {});
        };
      }
      setIsWatching(true);
    } catch (e: any) {
      setError(e?.message ?? "Failed to start location watch");
    }
  }, [enabled, processPosition]);

  const stopWatching = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setIsWatching(false);
  }, []);

  const forceRefresh = useCallback(async () => {
    try {
      if (Capacitor.getPlatform() === "web") {
        return new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              processPosition(pos.coords, pos.timestamp);
              resolve();
            },
            (err) => {
              setError(err.message);
              resolve();
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
          );
        });
      }

      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });
      processPosition(pos.coords as any, pos.timestamp);
    } catch (e: any) {
      setError(e?.message ?? "Refresh failed");
    }
  }, [processPosition]);

  useEffect(() => {
    if (enabled) {
      startWatching();
    }
    return () => stopWatching();
  }, [enabled, startWatching, stopWatching]);

  return {
    location,
    history,
    accuracy: location?.accuracy ?? null,
    accuracyGrade: getAccuracyGrade(location?.accuracy ?? null),
    error,
    isWatching,
    forceRefresh,
    stopWatching,
    startWatching,
  };
}
