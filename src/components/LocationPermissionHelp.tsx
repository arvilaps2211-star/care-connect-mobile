import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Smartphone, Globe, Settings, ChevronRight } from "lucide-react";

interface LocationPermissionHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const LocationPermissionHelp = ({
  open,
  onOpenChange,
}: LocationPermissionHelpProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Enable Location Services
          </DialogTitle>
          <DialogDescription>
            CareConnect needs your location to send help during emergencies.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Android Instructions */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2 text-foreground">
              <Smartphone className="h-4 w-4" />
              Android Phone
            </h3>
            <ol className="space-y-2 text-sm text-muted-foreground pl-6">
              <li className="flex items-start gap-2">
                <span className="font-medium text-foreground">1.</span>
                Open <strong>Settings</strong> on your phone
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium text-foreground">2.</span>
                Tap <strong>Location</strong> (or Privacy → Location)
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium text-foreground">3.</span>
                Toggle <strong>Location</strong> to ON
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium text-foreground">4.</span>
                Find CareConnect in app list → Set to <strong>"Allow all the time"</strong>
              </li>
            </ol>
          </div>

          {/* iOS Instructions */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2 text-foreground">
              <Smartphone className="h-4 w-4" />
              iPhone / iPad
            </h3>
            <ol className="space-y-2 text-sm text-muted-foreground pl-6">
              <li className="flex items-start gap-2">
                <span className="font-medium text-foreground">1.</span>
                Open <strong>Settings</strong> app
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium text-foreground">2.</span>
                Tap <strong>Privacy & Security</strong> → <strong>Location Services</strong>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium text-foreground">3.</span>
                Ensure <strong>Location Services</strong> is ON
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium text-foreground">4.</span>
                Find CareConnect → Select <strong>"While Using"</strong> or <strong>"Always"</strong>
              </li>
            </ol>
          </div>

          {/* Browser Instructions */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2 text-foreground">
              <Globe className="h-4 w-4" />
              Web Browser (Chrome, Safari, Firefox)
            </h3>
            <ol className="space-y-2 text-sm text-muted-foreground pl-6">
              <li className="flex items-start gap-2">
                <span className="font-medium text-foreground">1.</span>
                Click the <strong>lock icon</strong> (🔒) in the address bar
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium text-foreground">2.</span>
                Find <strong>Location</strong> permission
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium text-foreground">3.</span>
                Set it to <strong>Allow</strong>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium text-foreground">4.</span>
                Refresh the page and try again
              </li>
            </ol>
          </div>

          {/* Quick Tips */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h4 className="font-medium flex items-center gap-2 text-foreground">
              <Settings className="h-4 w-4" />
              Quick Tips
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3" />
                Make sure GPS/Location is enabled system-wide
              </li>
              <li className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3" />
                Go outside or near a window for better GPS signal
              </li>
              <li className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3" />
                Disable VPN if location keeps failing
              </li>
            </ul>
          </div>
        </div>

        <Button onClick={() => onOpenChange(false)} className="w-full">
          Got it
        </Button>
      </DialogContent>
    </Dialog>
  );
};
