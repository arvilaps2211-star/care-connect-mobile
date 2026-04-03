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
  { lat: 37.421998, lng: -122.084 },
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

/** Color class for accuracy badge */
export function getAccuracyColor(grade: AccuracyGrade): string {
  switch (grade) {
    case "excellent": return "text-emerald-400";
    case "good": return "text-green-400";
    case "fair": return "text-yellow-400";
    case "poor": return "text-red-400";
  }
}

/** Background color class for accuracy badge */
export function getAccuracyBgColor(grade: AccuracyGrade): string {
  switch (grade) {
    case "excellent": return "bg-emerald-500/20";
    case "good": return "bg-green-500/20";
    case "fair": return "bg-yellow-500/20";
    case "poor": return "bg-red-500/20";
  }
}

const GPS_RETRY_DELAYS = [2000, 4000, 6000, 8000, 10000];
const MAX_RETRIES = 5;

export function useRealtimeLocation(options?: {
  /** Max accuracy (meters) to accept. Default 100 */
  maxAccuracy?: number;
  /** Enable watching. Default true */
  enabled?: boolean;
  /** Target accuracy in meters. Will retry to achieve this. Default 15 */
  targetAccuracy?: number;
}) {
  const { maxAccuracy = 100, enabled = true, targetAccuracy = 15 } = options ?? {};

  const [location, setLocation] = useState<RealtimeLocationData | null>(null);
  const [history, setHistory] = useState<RealtimeLocationData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRefining, setIsRefining] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const bestFixRef = useRef<RealtimeLocationData | null>(null);

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
        console.log("[RealtimeLocation] Low accuracy rejected:", accuracy, "m (max:", maxAccuracy, ")");
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

      // Keep best fix (lowest accuracy value = most accurate)
      if (!bestFixRef.current || entry.accuracy < bestFixRef.current.accuracy) {
        bestFixRef.current = entry;
        console.log("[RealtimeLocation] New best fix:", entry.accuracy.toFixed(1), "m");
      }

      setLocation(entry);
      setHistory((prev) => [...prev.slice(-29), entry]);
      setError(null);
    },
    [maxAccuracy]
  );

  const startWatching = useCallback(async () => {
    if (!enabled) return;

    try {
      console.log("[RealtimeLocation] Starting GPS watch (high accuracy, maximumAge:0, timeout:15s)");

      if (Capacitor.getPlatform() === "web") {
        if (!navigator.geolocation) {
          setError("Geolocation not supported");
          return;
        }
        const id = navigator.geolocation.watchPosition(
          (pos) => processPosition(pos.coords, pos.timestamp),
          (err) => {
            console.error("[RealtimeLocation] Watch error:", err.message);
            setError(err.message);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
        cleanupRef.current = () => navigator.geolocation.clearWatch(id);
      } else {
        const perm = await Geolocation.checkPermissions();
        console.log("[RealtimeLocation] Permission status:", perm.location);
        if (perm.location !== "granted") {
          const req = await Geolocation.requestPermissions();
          if (req.location !== "granted") {
            setError("Location permission denied");
            return;
          }
        }

        const id = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
          (position, err) => {
            if (err) {
              console.error("[RealtimeLocation] Native watch error:", err.message);
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
      console.error("[RealtimeLocation] Failed to start watch:", e);
      setError(e?.message ?? "Failed to start location watch");
    }
  }, [enabled, processPosition]);

  const stopWatching = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setIsWatching(false);
  }, []);

  /**
   * Progressive retry to refine GPS accuracy.
   * Tries up to MAX_RETRIES times with increasing delays,
   * keeping the best (most accurate) fix.
   */
  const refineAccuracy = useCallback(async () => {
    if (isRefining) return;
    setIsRefining(true);
    setRetryCount(0);
    bestFixRef.current = location;
    console.log("[RealtimeLocation] Starting accuracy refinement...");

    for (let i = 0; i < MAX_RETRIES; i++) {
      // Check if we already have target accuracy
      if (bestFixRef.current && bestFixRef.current.accuracy <= targetAccuracy) {
        console.log("[RealtimeLocation] Target accuracy reached:", bestFixRef.current.accuracy.toFixed(1), "m");
        break;
      }

      const delayMs = GPS_RETRY_DELAYS[i] ?? 10000;
      console.log(`[RealtimeLocation] Retry ${i + 1}/${MAX_RETRIES} in ${delayMs}ms...`);
      await new Promise(r => setTimeout(r, delayMs));
      setRetryCount(i + 1);

      try {
        if (Capacitor.getPlatform() === "web") {
          await new Promise<void>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => { processPosition(pos.coords, pos.timestamp); resolve(); },
              () => resolve(),
              { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
          });
        } else {
          const pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          });
          processPosition(pos.coords as any, pos.timestamp);
        }
      } catch (e) {
        console.warn("[RealtimeLocation] Retry", i + 1, "failed:", e);
      }
    }

    // Apply best fix
    if (bestFixRef.current) {
      setLocation(bestFixRef.current);
      console.log("[RealtimeLocation] Final best accuracy:", bestFixRef.current.accuracy.toFixed(1), "m");
    }

    setIsRefining(false);
  }, [isRefining, location, targetAccuracy, processPosition]);

  const forceRefresh = useCallback(async () => {
    try {
      console.log("[RealtimeLocation] Force refresh requested");
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
    isRefining,
    retryCount,
    forceRefresh,
    refineAccuracy,
    stopWatching,
    startWatching,
  };
}
