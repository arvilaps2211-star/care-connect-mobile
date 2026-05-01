import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useOsrmRoute, type OsrmRoute } from "@/hooks/useOsrmRoute";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Navigation, Clock, Route as RouteIcon } from "lucide-react";
import { openGoogleMapsNavigation } from "@/utils/navigation";

// Fix leaflet default icon paths in bundlers
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface RouteMapProps {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  height?: number;
}

function FitBounds({ route }: { route: OsrmRoute | null }) {
  const map = useMap();
  useEffect(() => {
    if (!route?.coordinates.length) return;
    const bounds = L.latLngBounds(route.coordinates as any);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [route, map]);
  return null;
}

const fmtKm = (m: number) => `${(m / 1000).toFixed(1)} km`;
const fmtMin = (s: number) => `${Math.max(1, Math.round(s / 60))} min`;

const RouteMap = ({ from, to, height = 320 }: RouteMapProps) => {
  const { routes, loading, error } = useOsrmRoute({ from, to });
  const [selectedIdx, setSelectedIdx] = useState(0);

  const center = useMemo<[number, number]>(
    () => [(from.lat + to.lat) / 2, (from.lng + to.lng) / 2],
    [from, to]
  );

  const selected = routes[selectedIdx] ?? null;

  return (
    <div className="space-y-2">
      <div
        className="overflow-hidden rounded-lg border"
        style={{ height }}
      >
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[from.lat, from.lng]} />
          <Marker position={[to.lat, to.lng]} />
          {routes.map((r, i) => (
            <Polyline
              key={i}
              positions={r.coordinates}
              pathOptions={{
                color: i === selectedIdx ? "#2563eb" : "#94a3b8",
                weight: i === selectedIdx ? 6 : 4,
                opacity: i === selectedIdx ? 0.9 : 0.6,
              }}
              eventHandlers={{ click: () => setSelectedIdx(i) }}
            />
          ))}
          <FitBounds route={selected} />
        </MapContainer>
      </div>

      {loading && (
        <p className="text-xs text-muted-foreground">Calculating route…</p>
      )}
      {error && (
        <p className="text-xs text-destructive">Route error: {error}</p>
      )}

      {routes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {routes.map((r, i) => (
            <Button
              key={i}
              size="sm"
              variant={i === selectedIdx ? "default" : "outline"}
              onClick={() => setSelectedIdx(i)}
              className="h-8"
            >
              <RouteIcon className="mr-1 h-3 w-3" />
              {r.summary}
              <Badge variant="secondary" className="ml-2">
                {fmtKm(r.distance)} · {fmtMin(r.duration)}
              </Badge>
            </Button>
          ))}
          <Button
            size="sm"
            className="ml-auto bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => openGoogleMapsNavigation(to.lat, to.lng)}
          >
            <Navigation className="mr-1 h-4 w-4" />
            Navigate with Google Maps
          </Button>
        </div>
      )}

      {selected && (
        <div className="flex items-center gap-3 rounded-md bg-muted px-3 py-2 text-sm">
          <Clock className="h-4 w-4 text-blue-600" />
          <span>
            <strong>{fmtMin(selected.duration)}</strong> · {fmtKm(selected.distance)} ·{" "}
            <span className="text-muted-foreground">{selected.summary} route</span>
          </span>
        </div>
      )}
    </div>
  );
};

export default RouteMap;