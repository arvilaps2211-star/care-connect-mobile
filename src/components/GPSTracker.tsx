import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
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

// User location icon
const userLocationIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684809.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
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
  /** GPS horizontal accuracy in meters (if available) */
  accuracy?: number;
}

interface GPSTrackerProps {
  currentLocation?: Location;
  emergencyLocation?: Location;
  showRoute?: boolean;
  height?: string;
  /** Use user icon instead of ambulance icon for currentLocation */
  useUserIcon?: boolean;
}

// Component to recenter map when location changes
function RecenterMap({ location }: { location: Location }) {
  const map = useMap();
  
  useEffect(() => {
    if (location) {
      map.setView([location.latitude, location.longitude], 15);
    }
  }, [location, map]);
  
  return null;
}

const GPSTracker = ({ 
  currentLocation, 
  emergencyLocation, 
  showRoute = false,
  height = "400px",
  useUserIcon = false,
}: GPSTrackerProps) => {
  const [mapCenter, setMapCenter] = useState<[number, number]>([20.5937, 78.9629]); // Default to India center
  
  // Select appropriate icon
  const currentIcon = useUserIcon ? userLocationIcon : ambulanceIcon;

  useEffect(() => {
    if (currentLocation) {
      setMapCenter([currentLocation.latitude, currentLocation.longitude]);
    } else if (emergencyLocation) {
      setMapCenter([emergencyLocation.latitude, emergencyLocation.longitude]);
    }
  }, [currentLocation, emergencyLocation]);

  return (
    <div className="rounded-lg overflow-hidden border border-slate-700" style={{ height }}>
      <MapContainer
        center={mapCenter}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {currentLocation && (
          <RecenterMap location={currentLocation} />
        )}
        
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
              </div>
            </Popup>
          </Marker>
        )}
        
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
