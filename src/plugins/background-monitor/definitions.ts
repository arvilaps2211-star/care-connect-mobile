/**
 * BackgroundMonitor Capacitor Plugin — TypeScript definitions
 *
 * On native Android this bridges to CrashDetectionService.java via
 * BackgroundMonitorPlugin.java.  On web it falls back to the existing
 * DeviceMotionEvent-based useAccidentDetection hook.
 */

import type { PluginListenerHandle } from "@capacitor/core";

export interface BackgroundMonitorPlugin {
  /** Start the native foreground service for crash detection */
  startMonitoring(): Promise<void>;

  /** Stop the foreground service */
  stopMonitoring(): Promise<void>;

  /** Check if the service is currently running */
  isMonitoring(): Promise<{ monitoring: boolean }>;

  /** Fire a fake crash event for testing */
  simulateCrash(): Promise<void>;

  /** Listen for crash events from the native service */
  addListener(
    eventName: "crashDetected",
    listenerFunc: (data: { level: "accident" | "drop"; gForce: number }) => void
  ): Promise<PluginListenerHandle>;

  /** Listen for user confirming emergency from lock screen popup */
  addListener(
    eventName: "emergencyConfirmed",
    listenerFunc: () => void
  ): Promise<PluginListenerHandle>;

  /** Listen for user marking themselves safe from lock screen popup */
  addListener(
    eventName: "userSafe",
    listenerFunc: () => void
  ): Promise<PluginListenerHandle>;

  removeAllListeners(): Promise<void>;
}
