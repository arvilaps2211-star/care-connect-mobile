import { MapPin, RefreshCw, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAccuracyGrade, getAccuracyColor, getAccuracyBgColor, type AccuracyGrade } from "@/hooks/useRealtimeLocation";

interface GPSAccuracyIndicatorProps {
  accuracy: number | null;
  isRefining?: boolean;
  retryCount?: number;
  onRefine?: () => void;
  compact?: boolean;
}

const gradeLabels: Record<AccuracyGrade, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

export function GPSAccuracyIndicator({
  accuracy,
  isRefining,
  retryCount = 0,
  onRefine,
  compact = false,
}: GPSAccuracyIndicatorProps) {
  const grade = getAccuracyGrade(accuracy);
  const color = getAccuracyColor(grade);
  const bgColor = getAccuracyBgColor(grade);

  if (compact) {
    return (
      <Badge className={`${bgColor} ${color} border-0 gap-1`}>
        <MapPin className="w-3 h-3" />
        {accuracy != null ? `±${Math.round(accuracy)}m` : "No GPS"}
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge className={`${bgColor} ${color} border-0 gap-1 px-3 py-1`}>
        <MapPin className="w-3 h-3" />
        <span className="font-mono">
          {accuracy != null ? `±${Math.round(accuracy)}m` : "—"}
        </span>
        <span className="text-xs opacity-75">({gradeLabels[grade]})</span>
      </Badge>

      {isRefining && (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Refining ({retryCount}/5)
        </span>
      )}

      {onRefine && !isRefining && grade !== "excellent" && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefine}
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Refine
        </Button>
      )}
    </div>
  );
}

export function GPSAccuracyTips() {
  return (
    <div className="text-xs text-muted-foreground space-y-1 p-3 rounded-lg bg-muted/50">
      <p className="font-medium text-foreground">Tips for better GPS accuracy:</p>
      <ul className="list-disc list-inside space-y-0.5">
        <li>Move outdoors or near a window</li>
        <li>Enable "High accuracy" in device location settings</li>
        <li>Turn on Wi-Fi (helps with positioning)</li>
        <li>Wait 10-30 seconds for GPS lock</li>
      </ul>
    </div>
  );
}
