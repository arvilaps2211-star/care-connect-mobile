import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface AccelerometerMonitorProps {
  onAccidentDetected: () => void;
}

const AccelerometerMonitor = ({ onAccidentDetected }: AccelerometerMonitorProps) => {
  const [sensitivity, setSensitivity] = useState(30); // Threshold
  const lastAcceleration = useRef({ x: 0, y: 0, z: 0 });
  const { toast } = useToast();

  useEffect(() => {
    let animationFrame: number;

    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

      const deltaX = Math.abs(acc.x - lastAcceleration.current.x);
      const deltaY = Math.abs(acc.y - lastAcceleration.current.y);
      const deltaZ = Math.abs(acc.z - lastAcceleration.current.z);

      const totalDelta = deltaX + deltaY + deltaZ;

      // Check if movement exceeds threshold
      if (totalDelta > sensitivity) {
        console.log("Abnormal movement detected:", totalDelta);
        onAccidentDetected();
      }

      lastAcceleration.current = { x: acc.x, y: acc.y, z: acc.z };
    };

    // Request permission for iOS 13+
    if (typeof (DeviceMotionEvent as any).requestPermission === "function") {
      (DeviceMotionEvent as any)
        .requestPermission()
        .then((permissionState: string) => {
          if (permissionState === "granted") {
            window.addEventListener("devicemotion", handleMotion);
          } else {
            toast({
              title: "Permission Denied",
              description: "Motion sensor access is required for accident detection.",
              variant: "destructive",
            });
          }
        })
        .catch(() => {
          toast({
            title: "Error",
            description: "Could not access motion sensors.",
            variant: "destructive",
          });
        });
    } else {
      // Non-iOS or older iOS
      window.addEventListener("devicemotion", handleMotion);
    }

    return () => {
      window.removeEventListener("devicemotion", handleMotion);
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [sensitivity, onAccidentDetected, toast]);

  return null; // This is a background monitor
};

export default AccelerometerMonitor;