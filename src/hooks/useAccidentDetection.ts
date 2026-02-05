import { useCallback, useRef, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { isNativePlatform } from "@/utils/capacitor";
import { accelDiag } from "@/utils/safetyDiagnostics";

export type ImpactLevel = "normal" | "drop" | "accident";

interface UseAccidentDetectionProps {
  enabled: boolean;
  onDrop: () => void;
  onAccident: () => void;
  cooldownMs?: number;
}

// Updated G-force thresholds with sustained impact requirement
const THRESHOLDS = {
  DROP: 2.0,      // 2.0G - 3.5G = phone drop (warning only)
  ACCIDENT: 3.8,  // ≥ 3.8G = real accident
};

const GRAVITY = 9.8;
const SMOOTHING_WINDOW = 5;           // Increased for better filtering
const SUSTAINED_THRESHOLD_MS = 50;    // Require spike to last at least 50ms
const STATIONARY_THRESHOLD = 0.15;    // G-force below this = stationary
const MIN_SAMPLES_FOR_TRIGGER = 2;    // Require at least 2 high samples

export const useAccidentDetection = ({
  enabled,
  onDrop,
  onAccident,
  cooldownMs = 15000, // 15 second cooldown
}: UseAccidentDetectionProps) => {
  const [isActive, setIsActive] = useState(false);
  const [lastGForce, setLastGForce] = useState(0);
  const lastTriggerTime = useRef<number>(0);
  const lastAcceleration = useRef({ x: 0, y: 0, z: 0 });
  const gForceHistory = useRef<number[]>([]);
  const highImpactStartTime = useRef<number | null>(null);
  const highImpactSamples = useRef<number>(0);
  const isStationary = useRef(false);
  const stationaryCheckBuffer = useRef<number[]>([]);
  const { toast } = useToast();

  // Check if device is stationary (phone not moving)
  const updateStationaryStatus = useCallback((gForce: number): void => {
    stationaryCheckBuffer.current.push(gForce);
    
    // Keep last 10 samples
    if (stationaryCheckBuffer.current.length > 10) {
      stationaryCheckBuffer.current.shift();
    }
    
    // Device is stationary if all recent samples are below threshold
    if (stationaryCheckBuffer.current.length >= 5) {
      const avgGForce = stationaryCheckBuffer.current.reduce((a, b) => a + b, 0) 
        / stationaryCheckBuffer.current.length;
      isStationary.current = avgGForce < STATIONARY_THRESHOLD;
    }
  }, []);

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

  // Validate if impact is sustained (not just a spike)
  const validateSustainedImpact = useCallback((gForce: number, threshold: number): boolean => {
    const now = Date.now();
    
    if (gForce >= threshold) {
      if (highImpactStartTime.current === null) {
        highImpactStartTime.current = now;
        highImpactSamples.current = 1;
      } else {
        highImpactSamples.current++;
      }
      
      const duration = now - highImpactStartTime.current;
      
      // Require both duration AND sample count
      if (duration >= SUSTAINED_THRESHOLD_MS && highImpactSamples.current >= MIN_SAMPLES_FOR_TRIGGER) {
        return true;
      }
    } else {
      // Reset if impact dropped below threshold
      highImpactStartTime.current = null;
      highImpactSamples.current = 0;
    }
    
    return false;
  }, []);

  const classifyImpact = useCallback((gForce: number): ImpactLevel => {
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

    // Update stationary status
    updateStationaryStatus(gForce);

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
    const timeSinceLastTrigger = now - lastTriggerTime.current;
    
    if (timeSinceLastTrigger < cooldownMs) {
      accelDiag.cooldownActive(cooldownMs - timeSinceLastTrigger);
      return;
    }

    // Ignore if device was stationary before impact (likely just picked up)
    if (isStationary.current && impactLevel === "drop") {
      accelDiag.spikeIgnored("device was stationary (likely picked up)");
      return;
    }

    // Validate sustained impact for accident detection
    if (impactLevel === "accident") {
      const isSustained = validateSustainedImpact(gForce, THRESHOLDS.ACCIDENT);
      
      if (!isSustained) {
        accelDiag.spikeIgnored("single spike - waiting for sustained impact");
        return;
      }
      
      accelDiag.triggerConfirmed("accident");
      lastTriggerTime.current = now;
      highImpactStartTime.current = null;
      highImpactSamples.current = 0;
      onAccident();
    } else if (impactLevel === "drop") {
      // For drops, we're more lenient but still require some validation
      const isSustained = validateSustainedImpact(gForce, THRESHOLDS.DROP);
      
      if (!isSustained) {
        accelDiag.spikeIgnored("brief drop spike");
        return;
      }
      
      accelDiag.triggerConfirmed("drop");
      lastTriggerTime.current = now;
      highImpactStartTime.current = null;
      highImpactSamples.current = 0;
      onDrop();
    }
  }, [classifyImpact, cooldownMs, onAccident, onDrop, updateStationaryStatus, validateSustainedImpact]);

  useEffect(() => {
    // CRITICAL: Block accelerometer on web - only run on native mobile
    if (!isNativePlatform()) {
      accelDiag.webDisabled();
      setIsActive(false);
      return;
    }

    if (!enabled) {
      accelDiag.stopped();
      setIsActive(false);
      gForceHistory.current = [];
      stationaryCheckBuffer.current = [];
      highImpactStartTime.current = null;
      highImpactSamples.current = 0;
      return;
    }

    const startListening = () => {
      window.addEventListener("devicemotion", handleMotion);
      setIsActive(true);
      accelDiag.started({ drop: THRESHOLDS.DROP, accident: THRESHOLDS.ACCIDENT });
    };

    // Request permission for iOS 13+
    if (typeof (DeviceMotionEvent as any).requestPermission === "function") {
      (DeviceMotionEvent as any)
        .requestPermission()
        .then((permissionState: string) => {
          if (permissionState === "granted") {
            startListening();
          } else {
            accelDiag.permissionDenied();
            toast({
              title: "Permission Denied",
              description: "Motion sensor access is required for accident detection.",
              variant: "destructive",
            });
          }
        })
        .catch(() => {
          accelDiag.permissionDenied();
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
