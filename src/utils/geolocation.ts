import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";

export interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

function getCurrentPositionWeb(): Promise<LocationCoords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        }),
      (err) => {
        let message = "Unable to get location";
        switch (err.code) {
          case err.PERMISSION_DENIED:
            message = "Location permission denied. Please enable location access in your browser settings.";
            break;
          case err.POSITION_UNAVAILABLE:
            message = "Location unavailable. Please check if GPS is enabled.";
            break;
          case err.TIMEOUT:
            message = "Location request timed out. Please try again.";
            break;
        }
        reject(new Error(message));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

export const getCurrentPosition = async (): Promise<LocationCoords> => {
  try {
    // On web/preview builds use browser geolocation (Capacitor plugin isn't available).
    if (Capacitor.getPlatform() === "web") {
      const coords = await getCurrentPositionWeb();
      return coords;
    }

    // Native (Android/iOS): Request permission first
    const permission = await Geolocation.checkPermissions();
    if (permission.location !== "granted") {
      const request = await Geolocation.requestPermissions();
      if (request.location !== "granted") {
        throw new Error("Location permission denied. Please enable location access in your device settings.");
      }
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp,
    };
  } catch (error: any) {
    console.error("Error getting location:", error);
    
    // Provide more specific error messages
    const message = error?.message || "Unable to get your location. Please enable location services.";
    throw new Error(message);
  }
};

export const watchPosition = (
  callback: (coords: LocationCoords) => void,
  errorCallback?: (error: Error) => void
) => {
  // Web: use navigator geolocation watch
  if (Capacitor.getPlatform() === "web") {
    if (!navigator.geolocation) {
      errorCallback?.(new Error("Geolocation not supported"));
      return null;
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        callback({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      },
      (err) => {
        console.error("Error watching location:", err);
        errorCallback?.(new Error(err.message));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(id);
  }

  // Native: use Capacitor plugin watch
  const watchIdPromise = Geolocation.watchPosition(
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    },
    (position, err) => {
      if (err) {
        console.error("Error watching location:", err);
        errorCallback?.(new Error(err.message || "Location watch error"));
        return;
      }
      if (position) {
        callback({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      }
    }
  );

  return () => {
    void (async () => {
      const id = await watchIdPromise;
      await Geolocation.clearWatch({ id });
    })();
  };
};
