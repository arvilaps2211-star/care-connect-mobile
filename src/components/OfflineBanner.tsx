import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Shows a banner when navigator.onLine === false.
 * Returns null when online so it takes no layout space.
 */
const OfflineBanner = () => {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground shadow-md">
      <WifiOff className="h-4 w-4" />
      No internet connection — new dispatches and chat are paused.
    </div>
  );
};

export default OfflineBanner;