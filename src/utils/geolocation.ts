import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";

export interface LocationCoords {
  latitude: number;
  longitude: number;
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
        }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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
        throw new Error("Location permission denied");
      }
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  } catch (error) {
    console.error("Error getting location:", error);
    throw new Error("Unable to get your location. Please enable location services.");
  }
};

export const watchPosition = (callback: (coords: LocationCoords) => void) => {
  // Web: use navigator geolocation watch
  if (Capacitor.getPlatform() === "web") {
    if (!navigator.geolocation) return null;

    const id = navigator.geolocation.watchPosition(
      (position) => {
        callback({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (err) => console.error("Error watching location:", err),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(id);
  }

  // Native: use Capacitor plugin watch
  const watchIdPromise = Geolocation.watchPosition(
    {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0,
    },
    (position, err) => {
      if (err) {
        console.error("Error watching location:", err);
        return;
      }
      if (position) {
        callback({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
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
