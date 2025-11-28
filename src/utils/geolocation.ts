import { Geolocation } from '@capacitor/geolocation';

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

export const getCurrentPosition = async (): Promise<LocationCoords> => {
  try {
    // Request permission first
    const permission = await Geolocation.checkPermissions();
    
    if (permission.location !== 'granted') {
      const request = await Geolocation.requestPermissions();
      if (request.location !== 'granted') {
        throw new Error('Location permission denied');
      }
    }

    // Get current position using Capacitor
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude
    };
  } catch (error) {
    console.error('Error getting location:', error);
    throw new Error('Unable to get your location. Please enable location services.');
  }
};

export const watchPosition = (callback: (coords: LocationCoords) => void) => {
  return Geolocation.watchPosition(
    {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0
    },
    (position, err) => {
      if (err) {
        console.error('Error watching location:', err);
        return;
      }
      if (position) {
        callback({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      }
    }
  );
};
