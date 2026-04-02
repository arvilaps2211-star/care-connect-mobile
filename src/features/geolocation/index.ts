/**
 * Geolocation Feature Module
 * Re-exports all geolocation-related hooks, utils, and components
 */

// Hooks
export { useLocation } from "@/hooks/useLocation";
export type { LocationData, LocationStatus, UseLocationOptions, UseLocationResult } from "@/hooks/useLocation";

export { useRealtimeLocation, getAccuracyGrade } from "@/hooks/useRealtimeLocation";
export type { RealtimeLocationData, AccuracyGrade } from "@/hooks/useRealtimeLocation";

// Utils
export { getCurrentPosition, watchPosition } from "@/utils/geolocation";
export type { LocationCoords } from "@/utils/geolocation";

export {
  getEmergencyLocation,
  generateMapsLink,
  formatLocationForSMS,
  isLocationValid,
  isNativeMobile,
} from "@/utils/emergencyGPS";
export type { EmergencyLocation } from "@/utils/emergencyGPS";

// Permissions
export {
  checkLocationPermission,
  requestLocationPermission,
  testLocationAccess,
} from "@/utils/permissions";
