import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  MapPin,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Navigation,
  Gauge,
  Clock,
} from "lucide-react";
import {
  useRealtimeLocation,
  getAccuracyGrade,
} from "@/hooks/useRealtimeLocation";

const gradeConfig: Record<
  string,
  { label: string; color: string; progress: number }
> = {
  excellent: { label: "Excellent", color: "text-emerald-500", progress: 100 },
  good: { label: "Good", color: "text-primary", progress: 75 },
  fair: { label: "Fair", color: "text-amber-500", progress: 50 },
  poor: { label: "Poor", color: "text-destructive", progress: 25 },
};

const LocationDebug = () => {
  const {
    location,
    history,
    accuracy,
    accuracyGrade,
    error,
    isWatching,
    forceRefresh,
  } = useRealtimeLocation();

  const grade = gradeConfig[accuracyGrade] ?? gradeConfig.poor;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          Location Debug Panel
        </CardTitle>
        <div className="flex gap-2">
          <Badge variant={isWatching ? "default" : "outline"}>
            {isWatching ? "Watching" : "Stopped"}
          </Badge>
          {accuracy != null && (
            <Badge variant="outline" className={grade.color}>
              ±{Math.round(accuracy)}m · {grade.label}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Coordinates */}
        {location ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Latitude</p>
                <p className="text-sm font-mono font-medium">
                  {location.latitude.toFixed(6)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Longitude</p>
                <p className="text-sm font-mono font-medium">
                  {location.longitude.toFixed(6)}
                </p>
              </div>
            </div>

            {/* Accuracy bar */}
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span className="flex items-center gap-1">
                  <Gauge className="h-3 w-3" /> Accuracy
                </span>
                <span className={grade.color}>
                  ±{Math.round(location.accuracy)}m
                </span>
              </div>
              <Progress value={grade.progress} className="h-2" />
            </div>

            {/* Extra data */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              {location.altitude != null && (
                <div className="p-2 rounded bg-muted/50 text-center">
                  <p className="text-muted-foreground">Altitude</p>
                  <p className="font-mono">{location.altitude.toFixed(1)}m</p>
                </div>
              )}
              {location.speed != null && location.speed > 0 && (
                <div className="p-2 rounded bg-muted/50 text-center">
                  <p className="text-muted-foreground">Speed</p>
                  <p className="font-mono">
                    {(location.speed * 3.6).toFixed(1)} km/h
                  </p>
                </div>
              )}
              {location.heading != null && (
                <div className="p-2 rounded bg-muted/50 text-center">
                  <p className="text-muted-foreground flex items-center justify-center gap-1">
                    <Navigation className="h-3 w-3" /> Heading
                  </p>
                  <p className="font-mono">{Math.round(location.heading)}°</p>
                </div>
              )}
            </div>

            {/* Last update */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Last update:{" "}
              {new Date(location.timestamp).toLocaleTimeString()}
            </div>

            {/* Accuracy history */}
            {history.length > 1 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Recent accuracy ({history.length} fixes)
                </p>
                <div className="flex gap-1 items-end h-8">
                  {history.slice(-15).map((h, i) => {
                    const g = getAccuracyGrade(h.accuracy);
                    const barH = Math.max(
                      10,
                      Math.min(100, (1 - h.accuracy / 100) * 100)
                    );
                    return (
                      <div
                        key={i}
                        className={`flex-1 rounded-sm ${
                          g === "excellent"
                            ? "bg-emerald-500"
                            : g === "good"
                            ? "bg-primary"
                            : g === "fair"
                            ? "bg-amber-500"
                            : "bg-destructive"
                        }`}
                        style={{ height: `${barH}%` }}
                        title={`±${Math.round(h.accuracy)}m`}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Google Maps link */}
            <a
              href={`https://maps.google.com/?q=${location.latitude},${location.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline"
            >
              Open in Google Maps ↗
            </a>
          </div>
        ) : (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Waiting for GPS fix...
          </div>
        )}

        {/* Force refresh */}
        <Button variant="outline" className="w-full" onClick={forceRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Force Refresh GPS
        </Button>
      </CardContent>
    </Card>
  );
};

export default LocationDebug;
