/**
 * BackgroundMonitor plugin entry point.
 *
 * On native Android → uses BackgroundMonitorPlugin.java
 * On web → falls back to DeviceMotionEvent (BackgroundMonitorWeb)
 */

import { registerPlugin } from "@capacitor/core";
import type { BackgroundMonitorPlugin } from "./definitions";

const BackgroundMonitor = registerPlugin<BackgroundMonitorPlugin>(
  "BackgroundMonitor",
  {
    web: () =>
      import("./web").then((m) => new m.BackgroundMonitorWeb()),
  }
);

export default BackgroundMonitor;
export type { BackgroundMonitorPlugin } from "./definitions";
