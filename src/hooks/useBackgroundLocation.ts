import { useState, useEffect, useCallback, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { supabase } from "@/integrations/supabase/client";

interface BackgroundLocationState {
  isTracking: boolean;
  lastUpdate: number | null;
  error: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
}

/**
 * Background location tracking for ambulance drivers.
 * Updates ambulance position in the database every `intervalMs` milliseconds.
 */
export function useBackgroundLocation(options: {
  ambulanceId: string | null;
  enabled?: boolean;
  intervalMs?: number;
}) {
  const { ambulanceId, enabled = false, intervalMs = 30000 } = options;

  const [state, setState] = useState<BackgroundLocationState>({
    isTracking: false,
    lastUpdate: null,
    error: null,
    latitude: null,
    longitude: null,
    accuracy: null,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchIdRef = useRef<string | null>(null);

  const updateLocation = useCallback(async () => {
    if (!ambulanceId) return;

    try {
      let position: { latitude: number; longitude: number; accuracy: number };

      if (Capacitor.getPlatform() === "web") {
        position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) =>
              resolve({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
              }),
            (err) => reject(new Error(err.message)),
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
          );
        });
      } else {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
        position = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
      }

      // Update ambulance location in database
      const { error } = await supabase
        .from("ambulance_services")
        .update({
          latitude: position.latitude,
          longitude: position.longitude,
        })
        .eq("id", ambulanceId);

      if (error) {
        console.warn("[BackgroundLocation] DB update failed:", error.message);
      }

      setState((prev) => ({
        ...prev,
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        lastUpdate: Date.now(),
        error: null,
      }));

      console.log(
        `[BackgroundLocation] Updated: ${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)} ±${Math.round(position.accuracy)}m`
      );
    } catch (err: any) {
      console.error("[BackgroundLocation] Error:", err.message);
      setState((prev) => ({ ...prev, error: err.message }));
    }
  }, [ambulanceId]);

  const startTracking = useCallback(() => {
    if (!ambulanceId || !enabled) return;

    console.log("[BackgroundLocation] Starting tracking, interval:", intervalMs, "ms");
    setState((prev) => ({ ...prev, isTracking: true, error: null }));

    // Initial update
    updateLocation();

    // Periodic updates
    intervalRef.current = setInterval(updateLocation, intervalMs);
  }, [ambulanceId, enabled, intervalMs, updateLocation]);

  const stopTracking = useCallback(() => {
    console.log("[BackgroundLocation] Stopping tracking");
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (watchIdRef.current && Capacitor.getPlatform() !== "web") {
      Geolocation.clearWatch({ id: watchIdRef.current }).catch(() => {});
      watchIdRef.current = null;
    }
    setState((prev) => ({ ...prev, isTracking: false }));
  }, []);

  useEffect(() => {
    if (enabled && ambulanceId) {
      startTracking();
    } else {
      stopTracking();
    }
    return () => stopTracking();
  }, [enabled, ambulanceId, startTracking, stopTracking]);

  return {
    ...state,
    startTracking,
    stopTracking,
    forceUpdate: updateLocation,
  };
}
