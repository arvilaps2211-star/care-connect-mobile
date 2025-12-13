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
}

interface GPSTrackerProps {
  currentLocation?: Location;
  emergencyLocation?: Location;
  showRoute?: boolean;
  height?: string;
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
  height = "400px" 
}: GPSTrackerProps) => {
  const [mapCenter, setMapCenter] = useState<[number, number]>([20.5937, 78.9629]); // Default to India center

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
          <>
            <RecenterMap location={currentLocation} />
            <Marker 
              position={[currentLocation.latitude, currentLocation.longitude]}
              icon={ambulanceIcon}
            >
              <Popup>
                <div className="text-center">
                  <strong>🚑 {currentLocation.label || 'Ambulance Location'}</strong>
                  <br />
                  <small>
                    {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                  </small>
                </div>
              </Popup>
            </Marker>
          </>
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
