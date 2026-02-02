import { AlertTriangle, MapPin } from "lucide-react";

interface FallbackLocationNoticeProps {
  show: boolean;
  className?: string;
}

/**
 * A notice banner that displays when using fallback/default location
 * instead of actual GPS coordinates.
 */
const FallbackLocationNotice = ({ show, className = "" }: FallbackLocationNoticeProps) => {
  if (!show) return null;

  return (
    <div className={`bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 ${className}`}>
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-amber-300 text-sm font-medium">Using Fallback Location</p>
          <p className="text-amber-400/70 text-xs">
            GPS is unavailable. Showing default map center. Enable location access for accurate positioning.
          </p>
        </div>
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
      </div>
    </div>
  );
};

export default FallbackLocationNotice;
