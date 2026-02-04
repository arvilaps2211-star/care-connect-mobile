import { useCallback, useRef, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { isNativePlatform } from "@/utils/capacitor";

export type ImpactLevel = "normal" | "drop" | "accident";

interface UseAccidentDetectionProps {
  enabled: boolean;
  onDrop: () => void;
  onAccident: () => void;
  cooldownMs?: number;
}

// Updated G-force thresholds per requirements
const THRESHOLDS = {
  DROP: 2.0,      // 2.0G - 3.5G = phone drop (warning only)
  ACCIDENT: 3.8,  // ≥ 3.8G = real accident
};

const GRAVITY = 9.8;
const SMOOTHING_WINDOW = 3; // Moving average of last 3 readings

export const useAccidentDetection = ({
  enabled,
  onDrop,
  onAccident,
  cooldownMs = 15000, // 15 second cooldown (increased from 10)
}: UseAccidentDetectionProps) => {
  const [isActive, setIsActive] = useState(false);
  const [lastGForce, setLastGForce] = useState(0);
  const lastTriggerTime = useRef<number>(0);
  const lastAcceleration = useRef({ x: 0, y: 0, z: 0 });
  const gForceHistory = useRef<number[]>([]); // For moving average smoothing
  const { toast } = useToast();

  // Calculate smoothed G-force using moving average
  const getSmoothedGForce = useCallback((newGForce: number): number => {
    gForceHistory.current.push(newGForce);
    
    // Keep only last N readings
    if (gForceHistory.current.length > SMOOTHING_WINDOW) {
      gForceHistory.current.shift();
    }
    
    // Calculate average
    const sum = gForceHistory.current.reduce((a, b) => a + b, 0);
    return sum / gForceHistory.current.length;
  }, []);

  const classifyImpact = useCallback((gForce: number): ImpactLevel => {
    // Use smoothed value to prevent false positives
    const smoothedGForce = getSmoothedGForce(gForce);
    
    if (smoothedGForce >= THRESHOLDS.ACCIDENT) return "accident";
    if (smoothedGForce >= THRESHOLDS.DROP && smoothedGForce < THRESHOLDS.ACCIDENT) return "drop";
    return "normal";
  }, [getSmoothedGForce]);

  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    const acc = event.accelerationIncludingGravity;
    if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

    // Calculate delta from last reading (to detect sudden changes)
    const deltaX = Math.abs(acc.x - lastAcceleration.current.x);
    const deltaY = Math.abs(acc.y - lastAcceleration.current.y);
    const deltaZ = Math.abs(acc.z - lastAcceleration.current.z);

    // Calculate total acceleration magnitude from deltas
    const totalMagnitude = Math.sqrt(deltaX ** 2 + deltaY ** 2 + deltaZ ** 2);
    
    // Convert to G-force
    const gForce = totalMagnitude / GRAVITY;
    
    // Update last acceleration
    lastAcceleration.current = { x: acc.x, y: acc.y, z: acc.z };

    // Only update state if significant movement detected
    if (gForce > 0.3) {
      setLastGForce(gForce);
    }

    // Skip minor movements entirely (< 2.0G = normal shake)
    if (gForce < THRESHOLDS.DROP) {
      return; // IGNORE normal shakes completely
    }

    const impactLevel = classifyImpact(gForce);
    
    // Check cooldown to prevent repeated triggers
    const now = Date.now();
    if (now - lastTriggerTime.current < cooldownMs) {
      console.log(`[AccidentDetection] In cooldown, ignoring ${gForce.toFixed(2)}G`);
      return;
    }

    if (impactLevel === "accident") {
      console.log(`🚨 REAL ACCIDENT DETECTED: ${gForce.toFixed(2)}G (threshold: ${THRESHOLDS.ACCIDENT}G)`);
      lastTriggerTime.current = now;
      onAccident();
    } else if (impactLevel === "drop") {
      console.log(`⚠️ PHONE DROP DETECTED: ${gForce.toFixed(2)}G (warning only)`);
      lastTriggerTime.current = now;
      onDrop();
    }
    // Normal level = completely ignored (no log spam)
  }, [classifyImpact, cooldownMs, onAccident, onDrop]);

  useEffect(() => {
    // CRITICAL: Block accelerometer on web - only run on native mobile
    if (!isNativePlatform()) {
      console.log("[AccidentDetection] WEB MODE - accelerometer disabled");
      setIsActive(false);
      return;
    }

    if (!enabled) {
      setIsActive(false);
      gForceHistory.current = []; // Reset history when disabled
      return;
    }

    const startListening = () => {
      window.addEventListener("devicemotion", handleMotion);
      setIsActive(true);
      console.log("[AccidentDetection] MOBILE - Started monitoring with thresholds:", THRESHOLDS);
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
      // Non-iOS or older iOS native
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
