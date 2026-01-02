/**
 * Calculate ETA based on distance between two coordinates
 * Uses Haversine formula for distance and average city ambulance speed
 */

interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns Distance in kilometers
 */
export const calculateDistance = (from: Coordinates, to: Coordinates): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (to.latitude - from.latitude) * Math.PI / 180;
  const dLon = (to.longitude - from.longitude) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(from.latitude * Math.PI / 180) * Math.cos(to.latitude * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Calculate ETA based on distance
 * Uses average ambulance speeds for urban areas
 * @returns ETA object with minutes and formatted string
 */
export const calculateETA = (
  fromLocation: Coordinates | null,
  toLocation: Coordinates | null,
  averageSpeedKmh: number = 40 // Average ambulance speed in city (km/h)
): { minutes: number; formatted: string; distance: number } | null => {
  if (!fromLocation || !toLocation) return null;
  
  const distance = calculateDistance(fromLocation, toLocation);
  
  // Calculate time in hours, then convert to minutes
  const timeHours = distance / averageSpeedKmh;
  const timeMinutes = Math.round(timeHours * 60);
  
  // Format the ETA string
  let formatted: string;
  if (timeMinutes < 1) {
    formatted = "< 1 min";
  } else if (timeMinutes < 60) {
    formatted = `${timeMinutes} min`;
  } else {
    const hours = Math.floor(timeMinutes / 60);
    const mins = timeMinutes % 60;
    formatted = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  
  return {
    minutes: timeMinutes,
    formatted,
    distance: Math.round(distance * 10) / 10, // Round to 1 decimal
  };
};

/**
 * Get ETA display with color coding based on urgency
 */
export const getETAStatus = (minutes: number): {
  color: string;
  bgColor: string;
  urgency: "critical" | "moderate" | "normal";
} => {
  if (minutes <= 5) {
    return { color: "text-emerald-400", bgColor: "bg-emerald-500/20", urgency: "normal" };
  } else if (minutes <= 15) {
    return { color: "text-yellow-400", bgColor: "bg-yellow-500/20", urgency: "moderate" };
  } else {
    return { color: "text-red-400", bgColor: "bg-red-500/20", urgency: "critical" };
  }
};
