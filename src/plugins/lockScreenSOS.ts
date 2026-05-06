import { registerPlugin } from "@capacitor/core";

export interface LockScreenSOSPlugin {
  wakeScreen(): Promise<void>;
  showEmergencyDialog(): Promise<void>;
  startBackgroundMonitoring(): Promise<void>;
  stopBackgroundMonitoring(): Promise<void>;
  requestBatteryOptimizationExemption(): Promise<void>;
  isIgnoringBatteryOptimizations(): Promise<{ ignoring: boolean }>;
}

const noop = async () => {};

const LockScreenSOS = registerPlugin<LockScreenSOSPlugin>("LockScreenSOS", {
  web: () => ({
    wakeScreen: noop,
    showEmergencyDialog: noop,
    startBackgroundMonitoring: noop,
    stopBackgroundMonitoring: noop,
    requestBatteryOptimizationExemption: noop,
    isIgnoringBatteryOptimizations: async () => ({ ignoring: false }),
  }),
});

export default LockScreenSOS;