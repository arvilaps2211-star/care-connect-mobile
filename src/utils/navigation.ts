/**
 * Navigation utilities for ambulance app
 * Google Maps directions, distance & ETA calculations
 */

import { Capacitor } from "@capacitor/core";

interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Calculate distance between two coordinates using Haversine formula.
 * @returns Distance in kilometers
 */
export function calculateDistanceKm(from: Coordinates, to: Coordinates): number {
  const R = 6371;
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.latitude * Math.PI) / 180) *
      Math.cos((to.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Estimate travel time based on straight-line distance.
 * Uses 40 km/h average ambulance city speed with 1.3x road factor.
 */
export function calculateETAMinutes(distanceKm: number, avgSpeedKmh = 40): number {
  const roadDistance = distanceKm * 1.3;
  return Math.max(1, Math.round((roadDistance / avgSpeedKmh) * 60));
}

/**
 * Format ETA for display
 */
export function formatETA(minutes: number): string {
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Open Google Maps with turn-by-turn navigation to destination.
 * Uses native intent on Android, falls back to URL on web.
 */
export function openGoogleMapsNavigation(
  destLat: number,
  destLng: number,
  originLat?: number,
  originLng?: number
): void {
  const platform = Capacitor.getPlatform();

  if (platform === "android") {
    // Native Android intent
    const url = `google.navigation:q=${destLat},${destLng}&mode=d`;
    window.open(url, "_system");
  } else if (platform === "ios") {
    // Apple Maps with driving directions
    const url = `maps://maps.apple.com/?daddr=${destLat},${destLng}&dirflg=d`;
    window.open(url, "_system");
  } else {
    // Web fallback
    let url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`;
    if (originLat != null && originLng != null) {
      url += `&origin=${originLat},${originLng}`;
    }
    window.open(url, "_blank");
  }
}
