/**
 * External Map Link Utility
 * Opens Google Maps externally on mobile devices
 */

import { Capacitor } from "@capacitor/core";

/**
 * Generate a Google Maps link for coordinates
 */
export function generateGoogleMapsLink(
  latitude: number,
  longitude: number
): string {
  return `https://maps.google.com/?q=${latitude},${longitude}`;
}

/**
 * Generate a navigation link (directions to location)
 */
export function generateDirectionsLink(
  destLat: number,
  destLng: number,
  originLat?: number,
  originLng?: number
): string {
  if (originLat !== undefined && originLng !== undefined) {
    return `https://www.google.com/maps/dir/${originLat},${originLng}/${destLat},${destLng}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`;
}

/**
 * Open location in external maps app
 * Uses native intent on mobile, opens in new tab on web
 */
export function openInMaps(
  latitude: number,
  longitude: number,
  label?: string
): void {
  const platform = Capacitor.getPlatform();

  if (platform === "android") {
    // Android: Use geo URI scheme for native maps app
    const geoUri = label
      ? `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodeURIComponent(label)})`
      : `geo:${latitude},${longitude}?q=${latitude},${longitude}`;
    
    window.open(geoUri, "_system");
  } else if (platform === "ios") {
    // iOS: Use Apple Maps scheme, falls back to Google Maps
    const appleMapsUrl = `http://maps.apple.com/?ll=${latitude},${longitude}&q=${encodeURIComponent(label || "Location")}`;
    window.open(appleMapsUrl, "_system");
  } else {
    // Web: Open Google Maps in new tab
    const googleMapsUrl = generateGoogleMapsLink(latitude, longitude);
    window.open(googleMapsUrl, "_blank", "noopener,noreferrer");
  }
}

/**
 * Open directions in external maps app
 */
export function openDirections(
  destLat: number,
  destLng: number,
  destLabel?: string
): void {
  const platform = Capacitor.getPlatform();

  if (platform === "android") {
    // Android: Navigation intent
    const navUri = `google.navigation:q=${destLat},${destLng}`;
    window.open(navUri, "_system");
  } else if (platform === "ios") {
    // iOS: Apple Maps with directions
    const appleMapsUrl = `http://maps.apple.com/?daddr=${destLat},${destLng}&dirflg=d`;
    window.open(appleMapsUrl, "_system");
  } else {
    // Web: Google Maps directions
    const directionsUrl = generateDirectionsLink(destLat, destLng);
    window.open(directionsUrl, "_blank", "noopener,noreferrer");
  }
}

/**
 * Format coordinates for display (non-sensitive)
 */
export function formatCoordinates(
  latitude: number,
  longitude: number,
  precision: number = 4
): string {
  return `${latitude.toFixed(precision)}, ${longitude.toFixed(precision)}`;
}

/**
 * Check if coordinates are valid
 */
export function isValidCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): boolean {
  if (latitude === null || latitude === undefined) return false;
  if (longitude === null || longitude === undefined) return false;
  if (latitude === 0 && longitude === 0) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  return true;
}
