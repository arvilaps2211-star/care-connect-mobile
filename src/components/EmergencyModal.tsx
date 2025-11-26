import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, X } from "lucide-react";

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

  useEffect(() => {
    if (open) {
      // Get user's location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          },
          (error) => {
            console.error("Error getting location:", error);
          }
        );
      }
    }
  }, [open]);

  const handleEmergency = () => {
    if (location) {
      onEmergencyConfirmed(location);
    }
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
          <div className="grid grid-cols-2 gap-4 w-full">
            <Button
              onClick={handleEmergency}
              size="lg"
              className="bg-white text-emergency hover:bg-white/90 font-bold h-16 shadow-emergency"
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