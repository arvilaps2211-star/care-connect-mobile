import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, X, RefreshCw } from "lucide-react";
import { getCurrentPosition } from "@/utils/geolocation";

interface EmergencyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEmergencyConfirmed: (location: { latitude: number; longitude: number }) => void;
  onSafe: () => void;
}

const EmergencyModal = ({
  open,
  onOpenChange,
  onEmergencyConfirmed,
  onSafe,
}: EmergencyModalProps) => {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

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

  useEffect(() => {
    if (open) {
      void resolveLocation();
    } else {
      setLocation(null);
      setLocationError(null);
      setIsLocating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleEmergency = () => {
    // Critical: do NOT close the modal if we don't have a location,
    // otherwise the emergency will never be created.
    if (!location) {
      setLocationError(
        locationError ||
          "Location is required to send an emergency. Please enable GPS/location permission and tap Retry."
      );
      return;
    }

    onEmergencyConfirmed(location);
    onOpenChange(false);
  };

  const handleSafe = () => {
    onSafe();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-4 border-emergency bg-gradient-emergency text-white">
        <DialogTitle className="sr-only">Emergency Alert</DialogTitle>
        <div className="flex flex-col items-center justify-center p-8 space-y-6">
          <div className="animate-pulse">
            <AlertCircle className="w-24 h-24" />
          </div>
          <h2 className="text-3xl font-bold text-center">ARE YOU SAFE?</h2>
          <p className="text-center text-white/90">
            An abnormal movement was detected. If you're in an emergency, press the emergency button below.
          </p>

          <div className="w-full space-y-2">
            {isLocating ? (
              <p className="text-center text-white/90 text-sm">Getting your location…</p>
            ) : location ? (
              <p className="text-center text-white/90 text-sm">
                Location ready: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
              </p>
            ) : (
              <p className="text-center text-white/90 text-sm">
                Location not available{locationError ? `: ${locationError}` : "."}
              </p>
            )}

            {!location && (
              <Button
                onClick={resolveLocation}
                variant="secondary"
                size="lg"
                className="w-full bg-white/15 text-white hover:bg-white/20"
                disabled={isLocating}
              >
                <RefreshCw className="mr-2 h-5 w-5" />
                Retry GPS
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 w-full">
            <Button
              onClick={handleEmergency}
              size="lg"
              className="bg-white text-emergency hover:bg-white/90 font-bold h-16 shadow-emergency"
              disabled={isLocating}
            >
              <AlertCircle className="mr-2 w-5 h-5" />
              EMERGENCY
            </Button>
            <Button
              onClick={handleSafe}
              size="lg"
              className="bg-success text-white hover:bg-success/90 font-bold h-16"
            >
              <CheckCircle className="mr-2 w-5 h-5" />
              I'M SAFE
            </Button>
          </div>
          <Button
            onClick={() => onOpenChange(false)}
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmergencyModal;