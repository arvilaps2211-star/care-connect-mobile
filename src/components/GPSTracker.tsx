import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom ambulance icon
const ambulanceIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/2317/2317966.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

// Blue dot icon for user location
const userDotIcon = new L.DivIcon({
  className: '',
  html: `<div style="
    width:18px;height:18px;border-radius:50%;
    background:hsl(217,91%,60%);
    border:3px solid white;
    box-shadow:0 0 8px rgba(59,130,246,0.6);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// Emergency location icon
const emergencyIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
  iconSize: [35, 35],
  iconAnchor: [17, 35],
  popupAnchor: [0, -35],
});

interface Location {
  latitude: number;
  longitude: number;
  label?: string;
  accuracy?: number;
  heading?: number | null;
}

interface GPSTrackerProps {
  currentLocation?: Location;
  emergencyLocation?: Location;
  showRoute?: boolean;
  height?: string;
  useUserIcon?: boolean;
  /** Show accuracy circle around current location */
  showAccuracyCircle?: boolean;
}

// Component to smoothly recenter map
function RecenterMap({ location }: { location: Location }) {
  const map = useMap();

  useEffect(() => {
    if (location) {
      map.setView([location.latitude, location.longitude], map.getZoom(), {
        animate: true,
        duration: 0.5,
      });
    }
  }, [location.latitude, location.longitude, map]);

  return null;
}

const GPSTracker = ({
  currentLocation,
  emergencyLocation,
  showRoute = false,
  height = "400px",
  useUserIcon = false,
  showAccuracyCircle = true,
}: GPSTrackerProps) => {
  const [mapCenter, setMapCenter] = useState<[number, number]>([20.5937, 78.9629]);

  const currentIcon = useUserIcon ? userDotIcon : ambulanceIcon;

  useEffect(() => {
    if (currentLocation) {
      setMapCenter([currentLocation.latitude, currentLocation.longitude]);
    } else if (emergencyLocation) {
      setMapCenter([emergencyLocation.latitude, emergencyLocation.longitude]);
    }
  }, [currentLocation, emergencyLocation]);

  const accuracyRadius = currentLocation?.accuracy ?? 0;

  return (
    <div className="rounded-lg overflow-hidden border border-border" style={{ height }}>
      <MapContainer
        center={mapCenter}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {currentLocation && <RecenterMap location={currentLocation} />}

        {/* Accuracy circle */}
        {currentLocation && showAccuracyCircle && accuracyRadius > 0 && (
          <Circle
            center={[currentLocation.latitude, currentLocation.longitude]}
            radius={accuracyRadius}
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.1,
              weight: 1,
            }}
          />
        )}

        {/* Current location marker */}
        {currentLocation && (
          <Marker
            position={[currentLocation.latitude, currentLocation.longitude]}
            icon={currentIcon}
          >
            <Popup>
              <div className="text-center">
                <strong>📍 {currentLocation.label || 'Current Location'}</strong>
                <br />
                <small>
                  {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                </small>
                {typeof currentLocation.accuracy === 'number' && (
                  <>
                    <br />
                    <small>Accuracy: ±{Math.round(currentLocation.accuracy)}m</small>
                  </>
                )}
                {currentLocation.heading != null && (
                  <>
                    <br />
                    <small>Heading: {Math.round(currentLocation.heading)}°</small>
                  </>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Emergency location marker */}
        {emergencyLocation && (
          <Marker
            position={[emergencyLocation.latitude, emergencyLocation.longitude]}
            icon={emergencyIcon}
          >
            <Popup>
              <div className="text-center">
                <strong>🆘 {emergencyLocation.label || 'Emergency Location'}</strong>
                <br />
                <small>
                  {emergencyLocation.latitude.toFixed(6)}, {emergencyLocation.longitude.toFixed(6)}
                </small>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
};

export default GPSTracker;
