import { useCallback, useRef, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export type ImpactLevel = "normal" | "drop" | "accident";

interface AccidentDetectionResult {
  impactLevel: ImpactLevel;
  gForce: number;
}

interface UseAccidentDetectionProps {
  enabled: boolean;
  onDrop: () => void;
  onAccident: () => void;
  cooldownMs?: number;
}

// G-force thresholds (1G = 9.8 m/s²)
const THRESHOLDS = {
  DROP: 2.5,      // ~25 m/s² - phone drop or sudden stop
  ACCIDENT: 4.0,  // ~40 m/s² - high impact collision
};

const GRAVITY = 9.8;

export const useAccidentDetection = ({
  enabled,
  onDrop,
  onAccident,
  cooldownMs = 10000, // 10 second cooldown between triggers
}: UseAccidentDetectionProps) => {
  const [isActive, setIsActive] = useState(false);
  const [lastGForce, setLastGForce] = useState(0);
  const lastTriggerTime = useRef<number>(0);
  const lastAcceleration = useRef({ x: 0, y: 0, z: 0 });
  const { toast } = useToast();

  const classifyImpact = useCallback((gForce: number): ImpactLevel => {
    if (gForce >= THRESHOLDS.ACCIDENT) return "accident";
    if (gForce >= THRESHOLDS.DROP) return "drop";
    return "normal";
  }, []);

  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    const acc = event.accelerationIncludingGravity;
    if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

    // Calculate delta from last reading
    const deltaX = Math.abs(acc.x - lastAcceleration.current.x);
    const deltaY = Math.abs(acc.y - lastAcceleration.current.y);
    const deltaZ = Math.abs(acc.z - lastAcceleration.current.z);

    // Calculate total acceleration magnitude
    const totalMagnitude = Math.sqrt(deltaX ** 2 + deltaY ** 2 + deltaZ ** 2);
    
    // Convert to G-force
    const gForce = totalMagnitude / GRAVITY;
    
    // Update last acceleration
    lastAcceleration.current = { x: acc.x, y: acc.y, z: acc.z };

    // Only update state if significant
    if (gForce > 0.5) {
      setLastGForce(gForce);
    }

    const impactLevel = classifyImpact(gForce);
    
    // Check cooldown
    const now = Date.now();
    if (now - lastTriggerTime.current < cooldownMs) {
      return; // Still in cooldown
    }

    if (impactLevel === "accident") {
      console.log(`🚨 HIGH IMPACT DETECTED: ${gForce.toFixed(2)}G`);
      lastTriggerTime.current = now;
      onAccident();
    } else if (impactLevel === "drop") {
      console.log(`⚠️ MEDIUM IMPACT (phone drop): ${gForce.toFixed(2)}G`);
      lastTriggerTime.current = now;
      onDrop();
    }
    // Normal shakes are completely ignored
  }, [classifyImpact, cooldownMs, onAccident, onDrop]);

  useEffect(() => {
    if (!enabled) {
      setIsActive(false);
      return;
    }

    const startListening = () => {
      window.addEventListener("devicemotion", handleMotion);
      setIsActive(true);
    };

    // Request permission for iOS 13+
    if (typeof (DeviceMotionEvent as any).requestPermission === "function") {
      (DeviceMotionEvent as any)
        .requestPermission()
        .then((permissionState: string) => {
          if (permissionState === "granted") {
            startListening();
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
      startListening();
    }

    return () => {
      window.removeEventListener("devicemotion", handleMotion);
      setIsActive(false);
    };
  }, [enabled, handleMotion, toast]);

  return {
    isActive,
    lastGForce,
    thresholds: THRESHOLDS,
  };
};
