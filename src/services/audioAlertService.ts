/**
 * Audio Alert Service for Ambulance App
 * Uses Web Audio API for reliable emergency sound playback
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioContext();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

/**
 * Play a siren-like emergency alert using Web Audio API oscillators.
 * Duration ~3 seconds with alternating frequency sweep.
 */
export function playEmergencyAlert(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);
    gainNode.gain.setValueAtTime(0.4, now);
    gainNode.gain.linearRampToValueAtTime(0, now + 3);

    // Two oscillators for siren effect
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(600, now + i);
      osc.frequency.linearRampToValueAtTime(1200, now + i + 0.5);
      osc.frequency.linearRampToValueAtTime(600, now + i + 1);
      osc.connect(gainNode);
      osc.start(now + i);
      osc.stop(now + i + 1);
    }

    console.log("[AudioAlert] Emergency siren playing");
  } catch (err) {
    console.warn("[AudioAlert] Failed to play emergency alert:", err);
  }
}

/**
 * Play a short notification beep (~300ms).
 */
export function playNotificationSound(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.3);

    osc.start(now);
    osc.stop(now + 0.3);

    console.log("[AudioAlert] Notification beep played");
  } catch (err) {
    console.warn("[AudioAlert] Failed to play notification:", err);
  }
}

/**
 * Trigger device vibration if available.
 */
export async function vibrateDevice(pattern: number[] = [200, 100, 200, 100, 400]): Promise<void> {
  try {
    // Try Capacitor Haptics first
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Heavy });
    console.log("[AudioAlert] Haptic feedback triggered");
  } catch {
    // Fallback to web vibration API
    if ("vibrate" in navigator) {
      navigator.vibrate(pattern);
      console.log("[AudioAlert] Web vibration triggered");
    }
  }
}

/**
 * Full emergency alert: siren + vibration
 */
export function triggerFullEmergencyAlert(): void {
  playEmergencyAlert();
  vibrateDevice();
}
