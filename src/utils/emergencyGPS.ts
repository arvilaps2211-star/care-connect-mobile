/**
 * Emergency GPS Utilities
 * Safe GPS fetching for emergency SMS with timeout and fallback
 * MOBILE-ONLY: This logic is designed for Capacitor/native platforms
 */

import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { gpsDiag } from "@/utils/safetyDiagnostics";

export interface EmergencyLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
  source: "gps" | "fallback" | "unavailable";
  mapsLink: string | null;
  displayText: string;
}

// Default timeout for GPS acquisition during emergency
const EMERGENCY_GPS_TIMEOUT_MS = 8000;

/**
 * Check if we're running on a native mobile platform
 */
export const isNativeMobile = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Generate Google Maps link from coordinates
 */
export const generateMapsLink = (latitude: number, longitude: number): string => {
  return `https://maps.google.com/?q=${latitude},${longitude}`;
};

/**
 * Format location for SMS display
 */
export const formatLocationForSMS = (location: EmergencyLocation): string => {
  if (location.source === "unavailable") {
    return "📍 Location: Unable to fetch GPS at this moment";
  }

  const accuracy = location.accuracy ? ` (±${Math.round(location.accuracy)}m)` : "";
  const sourceLabel = location.source === "fallback" ? " [cached]" : "";
  
  return `📍 Location${sourceLabel}${accuracy}:\n${location.mapsLink}`;
};

/**
 * Safely fetch GPS location for emergency SMS
 * - Uses timeout to prevent blocking
 * - Returns fallback status if GPS unavailable
 * - NEVER crashes or blocks the SOS flow
 * - Runs ONLY on native mobile platforms
 */
export async function getEmergencyLocation(
  fallbackLocation?: { latitude: number; longitude: number } | null,
  timeoutMs: number = EMERGENCY_GPS_TIMEOUT_MS
): Promise<EmergencyLocation> {
  gpsDiag.acquiring();

  // WEB PLATFORM: Return fallback or unavailable immediately
  if (!isNativeMobile()) {
    gpsDiag.webBlocked();
    return getBrowserLocation(fallbackLocation, timeoutMs);
  }

  // NATIVE PLATFORM: Use Capacitor Geolocation
  try {
    // Check permission status first
    const permStatus = await Geolocation.checkPermissions();

    if (permStatus.location === "denied") {
      gpsDiag.denied();
      return createFallbackLocation(fallbackLocation);
    }

    // Request permission if needed
    if (permStatus.location === "prompt" || permStatus.location === "prompt-with-rationale") {
      const request = await Geolocation.requestPermissions();
      if (request.location !== "granted") {
        gpsDiag.denied();
        return createFallbackLocation(fallbackLocation);
      }
    }

    // Fetch position with timeout
    const position = await Promise.race([
      Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 30000, // Accept cached position up to 30s old for emergencies
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("GPS timeout")), timeoutMs)
      ),
    ]);

    gpsDiag.acquired(position.coords.accuracy);

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp,
      source: "gps",
      mapsLink: generateMapsLink(position.coords.latitude, position.coords.longitude),
      displayText: formatLocationForSMS({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        source: "gps",
        mapsLink: generateMapsLink(position.coords.latitude, position.coords.longitude),
        displayText: "",
      }),
    };
  } catch (error: any) {
    const message = error?.message || "Unknown error";
    if (message.includes("timeout")) {
      gpsDiag.timeout();
    } else {
      gpsDiag.unavailable();
    }
    return createFallbackLocation(fallbackLocation);
  }
}

/**
 * Browser-based geolocation for web preview
 */
async function getBrowserLocation(
  fallbackLocation?: { latitude: number; longitude: number } | null,
  timeoutMs: number = EMERGENCY_GPS_TIMEOUT_MS
): Promise<EmergencyLocation> {
  if (!navigator.geolocation) {
    gpsDiag.unavailable();
    return createFallbackLocation(fallbackLocation);
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      gpsDiag.timeout();
      resolve(createFallbackLocation(fallbackLocation));
    }, timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeoutId);
        gpsDiag.acquired(position.coords.accuracy);
        
        const result: EmergencyLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          source: "gps",
          mapsLink: generateMapsLink(position.coords.latitude, position.coords.longitude),
          displayText: "",
        };
        result.displayText = formatLocationForSMS(result);
        resolve(result);
      },
      (error) => {
        clearTimeout(timeoutId);
        if (error.code === error.PERMISSION_DENIED) {
          gpsDiag.denied();
        } else {
          gpsDiag.unavailable();
        }
        resolve(createFallbackLocation(fallbackLocation));
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 30000,
      }
    );
  });
}

/**
 * Create a fallback location response
 */
function createFallbackLocation(
  fallbackCoords?: { latitude: number; longitude: number } | null
): EmergencyLocation {
  if (fallbackCoords && fallbackCoords.latitude && fallbackCoords.longitude) {
    gpsDiag.usingFallback();
    return {
      latitude: fallbackCoords.latitude,
      longitude: fallbackCoords.longitude,
      source: "fallback",
      mapsLink: generateMapsLink(fallbackCoords.latitude, fallbackCoords.longitude),
      displayText: "📍 Location [cached]:\n" + generateMapsLink(fallbackCoords.latitude, fallbackCoords.longitude),
    };
  }

  gpsDiag.unavailable();
  return {
    latitude: 0,
    longitude: 0,
    source: "unavailable",
    mapsLink: null,
    displayText: "📍 Location: Unable to fetch GPS at this moment",
  };
}

/**
 * Validate if location is usable for SMS
 */
export function isLocationValid(location: EmergencyLocation): boolean {
  return location.source !== "unavailable" && location.mapsLink !== null;
}
