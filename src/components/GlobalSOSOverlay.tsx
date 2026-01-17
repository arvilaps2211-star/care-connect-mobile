import { useEffect, useState } from "react";
import { AlertCircle, X, RefreshCw, HelpCircle, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentPosition } from "@/utils/geolocation";
import { LocationPermissionHelp } from "@/components/LocationPermissionHelp";
import { useSOSAlarm } from "@/hooks/useSOSAlarm";

interface GlobalSOSOverlayProps {
  open: boolean;
  onClose: () => void;
  onEmergencyConfirmed: (location: { latitude: number; longitude: number }) => void;
  onSafe: () => void;
}

const GlobalSOSOverlay = ({
  open,
  onClose,
  onEmergencyConfirmed,
  onSafe,
}: GlobalSOSOverlayProps) => {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showLocationHelp, setShowLocationHelp] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const { isPlaying, startAlarm, stopAlarm } = useSOSAlarm();

  const resolveLocation = async () => {
    setIsLocating(true);
    setLocationError(null);
    try {
      const coords = await getCurrentPosition();
      setLocation(coords);
    } catch (error: any) {
      console.error("Error getting location:", error);
      setLocation(null);
      setLocationError(error?.message || "Unable to get your location. Please enable location services.");
    } finally {
      setIsLocating(false);
    }
  };

  // Start alarm and get location when overlay opens
  useEffect(() => {
    if (open) {
      startAlarm();
      setCountdown(30);
      void resolveLocation();
    } else {
      stopAlarm();
      setLocation(null);
      setLocationError(null);
      setIsLocating(false);
      setCountdown(30);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Countdown timer
  useEffect(() => {
    if (!open) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [open]);

  const handleEmergency = () => {
    if (!location) {
      setLocationError(
        locationError ||
          "Location is required to send an emergency. Please enable GPS/location permission and tap Retry."
      );
      return;
    }

    stopAlarm();
    onEmergencyConfirmed(location);
    onClose();
  };

  const handleSafe = () => {
    stopAlarm();
    onSafe();
    onClose();
  };

  const toggleAlarm = () => {
    if (isPlaying) {
      stopAlarm();
    } else {
      startAlarm();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-red-600 via-red-700 to-orange-600 flex items-center justify-center p-4 animate-pulse-slow">
      {/* Close button */}
      <button
        onClick={handleSafe}
        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors"
        aria-label="Close"
      >
        <X className="w-8 h-8" />
      </button>

      {/* Sound toggle */}
      <button
        onClick={toggleAlarm}
        className="absolute top-4 left-4 p-2 text-white/70 hover:text-white transition-colors"
        aria-label={isPlaying ? "Mute alarm" : "Unmute alarm"}
      >
        {isPlaying ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
      </button>

      <div className="max-w-md w-full flex flex-col items-center justify-center space-y-6 text-white">
        {/* Animated icon */}
        <div className="relative">
          <div className="absolute inset-0 animate-ping bg-white/20 rounded-full" />
          <div className="relative bg-white/10 p-6 rounded-full">
            <AlertCircle className="w-24 h-24 text-white" />
          </div>
        </div>

        {/* Countdown */}
        <div className="text-center">
          <p className="text-6xl font-bold">{countdown}</p>
          <p className="text-lg opacity-90">seconds to respond</p>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-bold text-center">ARE YOU SAFE?</h1>
        <p className="text-center text-white/90 text-lg">
          A high-impact event was detected. If you're in an emergency, press SEND SOS.
        </p>

        {/* Location status */}
        <div className="w-full bg-white/10 rounded-lg p-4 space-y-2">
          {isLocating ? (
            <p className="text-center text-white/90 text-sm flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Getting your location…
            </p>
          ) : location ? (
            <p className="text-center text-green-300 text-sm">
              ✓ Location ready: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
            </p>
          ) : (
            <p className="text-center text-yellow-300 text-sm">
              ⚠️ Location not available{locationError ? `: ${locationError}` : "."}
            </p>
          )}

          {!location && !isLocating && (
            <div className="flex flex-col gap-2">
              <Button
                onClick={resolveLocation}
                variant="secondary"
                className="w-full bg-white/20 text-white hover:bg-white/30"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry GPS
              </Button>
              <Button
                onClick={() => setShowLocationHelp(true)}
                variant="link"
                className="text-white/80 hover:text-white"
              >
                <HelpCircle className="mr-1 h-4 w-4" />
                Need help enabling location?
              </Button>
            </div>
          )}
        </div>

        <LocationPermissionHelp
          open={showLocationHelp}
          onOpenChange={setShowLocationHelp}
        />

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-4 w-full">
          <Button
            onClick={handleEmergency}
            size="lg"
            className="bg-white text-red-600 hover:bg-red-100 font-bold h-20 text-xl shadow-2xl"
            disabled={isLocating}
          >
            🚨 SEND SOS
          </Button>
          <Button
            onClick={handleSafe}
            size="lg"
            className="bg-green-500 text-white hover:bg-green-600 font-bold h-20 text-xl shadow-2xl"
          >
            ✓ I'M SAFE
          </Button>
        </div>

        {/* Help text */}
        <p className="text-center text-white/70 text-sm">
          Your guardians and emergency services will be notified immediately
        </p>
      </div>

      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.95; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default GlobalSOSOverlay;
