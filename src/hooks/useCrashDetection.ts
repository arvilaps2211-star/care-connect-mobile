/**
 * useCrashDetection — React hook that wraps the BackgroundMonitor
 * Capacitor plugin for background crash detection.
 *
 * On native Android: uses CrashDetectionService (foreground service).
 * On web: uses DeviceMotionEvent fallback via plugin web implementation.
 *
 * Integrates with the existing SOSContext to trigger the emergency
 * modal and the full emergency flow.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import BackgroundMonitor from "@/plugins/background-monitor";
import { useSOSContext } from "@/contexts/SOSContext";
import { useToast } from "@/hooks/use-toast";

interface UseCrashDetectionResult {
  /** Whether the background service / listener is active */
  isMonitoring: boolean;
  /** Toggle monitoring on/off */
  toggleMonitoring: () => Promise<void>;
  /** Start monitoring */
  startMonitoring: () => Promise<void>;
  /** Stop monitoring */
  stopMonitoring: () => Promise<void>;
  /** Simulate a crash for testing */
  simulateCrash: () => Promise<void>;
}

const STORAGE_KEY = "careconnect_monitoring_active";

export function useCrashDetection(): UseCrashDetectionResult {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const { triggerSOS } = useSOSContext();
  const { toast } = useToast();
  const listenersRef = useRef<Array<{ remove: () => Promise<void> }>>([]);

  // Restore state on mount
  useEffect(() => {
    const restore = async () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "true") {
        try {
          const { monitoring } = await BackgroundMonitor.isMonitoring();
          if (!monitoring) {
            await BackgroundMonitor.startMonitoring();
          }
          setIsMonitoring(true);
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    };
    restore();
  }, []);

  // Set up event listeners
  useEffect(() => {
    const setupListeners = async () => {
      // Clean up previous
      for (const l of listenersRef.current) {
        await l.remove();
      }
      listenersRef.current = [];

      // Crash detected → trigger SOS overlay
      const crashListener = await BackgroundMonitor.addListener(
        "crashDetected",
        (data) => {
          console.log("[CrashDetection] Event:", data.level, "G:", data.gForce.toFixed(1));
          if (data.level === "accident") {
            triggerSOS();
          } else if (data.level === "drop") {
            toast({
              title: "📱 Phone Drop Detected",
              description: "A sudden impact was detected. Are you okay?",
            });
          }
        }
      );
      listenersRef.current.push(crashListener);

      // Emergency confirmed from native popup
      const emergencyListener = await BackgroundMonitor.addListener(
        "emergencyConfirmed",
        () => {
          console.log("[CrashDetection] Emergency confirmed from native popup");
          triggerSOS();
        }
      );
      listenersRef.current.push(emergencyListener);

      // User safe from native popup
      const safeListener = await BackgroundMonitor.addListener(
        "userSafe",
        () => {
          console.log("[CrashDetection] User marked safe from native popup");
          toast({
            title: "✅ Glad you're safe!",
            description: "Monitoring will continue in the background.",
          });
        }
      );
      listenersRef.current.push(safeListener);
    };

    setupListeners();

    return () => {
      for (const l of listenersRef.current) {
        l.remove();
      }
      listenersRef.current = [];
    };
  }, [triggerSOS, toast]);

  const startMonitoring = useCallback(async () => {
    try {
      await BackgroundMonitor.startMonitoring();
      setIsMonitoring(true);
      localStorage.setItem(STORAGE_KEY, "true");
      toast({
        title: "🛡️ Monitoring Active",
        description: "Crash detection is running in the background.",
      });
    } catch (err: any) {
      console.error("[CrashDetection] Failed to start:", err);
      toast({
        title: "Error",
        description: err?.message || "Failed to start crash detection",
        variant: "destructive",
      });
    }
  }, [toast]);

  const stopMonitoring = useCallback(async () => {
    try {
      await BackgroundMonitor.stopMonitoring();
      setIsMonitoring(false);
      localStorage.removeItem(STORAGE_KEY);
      toast({
        title: "Monitoring Stopped",
        description: "Crash detection has been turned off.",
      });
    } catch (err: any) {
      console.error("[CrashDetection] Failed to stop:", err);
    }
  }, [toast]);

  const toggleMonitoring = useCallback(async () => {
    if (isMonitoring) {
      await stopMonitoring();
    } else {
      await startMonitoring();
    }
  }, [isMonitoring, startMonitoring, stopMonitoring]);

  const simulateCrash = useCallback(async () => {
    try {
      await BackgroundMonitor.simulateCrash();
    } catch (err: any) {
      console.error("[CrashDetection] Simulate failed:", err);
    }
  }, []);

  return {
    isMonitoring,
    toggleMonitoring,
    startMonitoring,
    stopMonitoring,
    simulateCrash,
  };
}
