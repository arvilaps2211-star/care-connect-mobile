/**
 * BackgroundMonitor — Web fallback implementation
 *
 * On web/browser the native foreground service isn't available, so this
 * implementation uses the DeviceMotionEvent API as a best-effort fallback.
 * It mirrors the same algorithm as CrashDetectionService.java.
 */

import { WebPlugin } from "@capacitor/core";
import type { BackgroundMonitorPlugin } from "./definitions";

const GRAVITY = 9.81;
const DROP_THRESHOLD = 2.0;
const ACCIDENT_THRESHOLD = 3.8;
const SUSTAINED_MS = 50;
const COOLDOWN_MS = 15_000;
const SMOOTHING_WINDOW = 5;

export class BackgroundMonitorWeb extends WebPlugin implements BackgroundMonitorPlugin {
  private listening = false;
  private handler: ((e: DeviceMotionEvent) => void) | null = null;

  // State
  private history: number[] = [];
  private lastAcc = { x: 0, y: 0, z: 0 };
  private hasLast = false;
  private highStart = -1;
  private highSamples = 0;
  private lastTrigger = 0;

  async startMonitoring(): Promise<void> {
    if (this.listening) return;

    // Request permission on iOS 13+
    if (typeof (DeviceMotionEvent as any).requestPermission === "function") {
      const perm = await (DeviceMotionEvent as any).requestPermission();
      if (perm !== "granted") {
        throw new Error("Motion sensor permission denied");
      }
    }

    this.handler = (event: DeviceMotionEvent) => this.onMotion(event);
    window.addEventListener("devicemotion", this.handler);
    this.listening = true;
    console.log("[BackgroundMonitor/web] Started listening to devicemotion");
  }

  async stopMonitoring(): Promise<void> {
    if (this.handler) {
      window.removeEventListener("devicemotion", this.handler);
      this.handler = null;
    }
    this.listening = false;
    this.reset();
    console.log("[BackgroundMonitor/web] Stopped");
  }

  async isMonitoring(): Promise<{ monitoring: boolean }> {
    return { monitoring: this.listening };
  }

  async simulateCrash(): Promise<void> {
    console.log("[BackgroundMonitor/web] Simulating crash");
    this.notifyListeners("crashDetected", { level: "accident", gForce: 5.2 });
  }

  /* ── Internal ─────────────────────────────────────────── */

  private onMotion(event: DeviceMotionEvent) {
    const acc = event.accelerationIncludingGravity;
    if (!acc || acc.x == null || acc.y == null || acc.z == null) return;

    if (!this.hasLast) {
      this.lastAcc = { x: acc.x, y: acc.y, z: acc.z };
      this.hasLast = true;
      return;
    }

    const dx = Math.abs(acc.x - this.lastAcc.x);
    const dy = Math.abs(acc.y - this.lastAcc.y);
    const dz = Math.abs(acc.z - this.lastAcc.z);
    const gForce = Math.sqrt(dx ** 2 + dy ** 2 + dz ** 2) / GRAVITY;
    this.lastAcc = { x: acc.x, y: acc.y, z: acc.z };

    // Smoothing
    this.history.push(gForce);
    if (this.history.length > SMOOTHING_WINDOW) this.history.shift();
    const smoothed = this.history.reduce((a, b) => a + b, 0) / this.history.length;

    if (smoothed < DROP_THRESHOLD) {
      this.highStart = -1;
      this.highSamples = 0;
      return;
    }

    const now = Date.now();
    if (now - this.lastTrigger < COOLDOWN_MS) return;

    if (this.highStart < 0) {
      this.highStart = now;
      this.highSamples = 1;
    } else {
      this.highSamples++;
    }

    const elapsed = now - this.highStart;

    if (smoothed >= ACCIDENT_THRESHOLD && elapsed >= SUSTAINED_MS && this.highSamples >= 2) {
      this.lastTrigger = now;
      this.highStart = -1;
      this.highSamples = 0;
      this.notifyListeners("crashDetected", { level: "accident", gForce: smoothed });
    } else if (smoothed >= DROP_THRESHOLD && elapsed >= SUSTAINED_MS && this.highSamples >= 2) {
      this.lastTrigger = now;
      this.highStart = -1;
      this.highSamples = 0;
      this.notifyListeners("crashDetected", { level: "drop", gForce: smoothed });
    }
  }

  private reset() {
    this.history = [];
    this.lastAcc = { x: 0, y: 0, z: 0 };
    this.hasLast = false;
    this.highStart = -1;
    this.highSamples = 0;
  }
}
