/**
 * Safety Diagnostics Utility
 * Non-sensitive logging for debugging mobile safety features
 * 
 * PRIVACY: Never logs exact coordinates, phone numbers, or personal data
 */

type DiagnosticLevel = "info" | "warn" | "error" | "success";

interface DiagnosticEntry {
  timestamp: string;
  category: string;
  level: DiagnosticLevel;
  message: string;
}

// Keep last 50 diagnostic entries in memory for debugging
const diagnosticBuffer: DiagnosticEntry[] = [];
const MAX_BUFFER_SIZE = 50;

/**
 * Log a diagnostic message with category and level
 */
export function logDiagnostic(
  category: "GPS" | "ACCEL" | "NOTIFY" | "PLATFORM" | "SMS" | "BACKGROUND",
  level: DiagnosticLevel,
  message: string
): void {
  const entry: DiagnosticEntry = {
    timestamp: new Date().toISOString(),
    category,
    level,
    message,
  };

  // Add to buffer
  diagnosticBuffer.push(entry);
  if (diagnosticBuffer.length > MAX_BUFFER_SIZE) {
    diagnosticBuffer.shift();
  }

  // Console output with emoji prefixes
  const prefix = {
    GPS: "📍",
    ACCEL: "📱",
    NOTIFY: "🔔",
    PLATFORM: "🖥️",
    SMS: "💬",
    BACKGROUND: "⚙️",
  }[category];

  const levelIcon = {
    info: "ℹ️",
    warn: "⚠️",
    error: "❌",
    success: "✅",
  }[level];

  console.log(`[${prefix} ${category}] ${levelIcon} ${message}`);
}

/**
 * GPS-specific diagnostics (never logs actual coordinates)
 */
export const gpsDiag = {
  acquiring: () => logDiagnostic("GPS", "info", "Acquiring position..."),
  acquired: (accuracy?: number) => 
    logDiagnostic("GPS", "success", `Position acquired${accuracy ? ` (±${Math.round(accuracy)}m)` : ""}`),
  timeout: () => logDiagnostic("GPS", "warn", "Position timeout - using fallback"),
  denied: () => logDiagnostic("GPS", "error", "Permission denied"),
  unavailable: () => logDiagnostic("GPS", "warn", "Location unavailable"),
  usingFallback: () => logDiagnostic("GPS", "info", "Using cached/fallback location"),
  webBlocked: () => logDiagnostic("GPS", "info", "Web platform - native GPS disabled"),
};

/**
 * Accelerometer diagnostics (never logs raw sensor data)
 */
export const accelDiag = {
  started: (thresholds: { drop: number; accident: number }) => 
    logDiagnostic("ACCEL", "info", `Monitoring started (drop: ${thresholds.drop}G, accident: ${thresholds.accident}G)`),
  stopped: () => logDiagnostic("ACCEL", "info", "Monitoring stopped"),
  spikeDetected: (gForce: number, classification: string) => 
    logDiagnostic("ACCEL", "info", `Spike: ${gForce.toFixed(1)}G → ${classification}`),
  spikeIgnored: (reason: string) => 
    logDiagnostic("ACCEL", "info", `Spike ignored: ${reason}`),
  triggerConfirmed: (type: "drop" | "accident") => 
    logDiagnostic("ACCEL", "warn", `TRIGGER CONFIRMED: ${type.toUpperCase()}`),
  cooldownActive: (remainingMs: number) => 
    logDiagnostic("ACCEL", "info", `Cooldown active (${Math.round(remainingMs / 1000)}s remaining)`),
  webDisabled: () => logDiagnostic("ACCEL", "info", "Web platform - accelerometer disabled"),
  permissionDenied: () => logDiagnostic("ACCEL", "error", "Motion sensor permission denied"),
};

/**
 * Notification diagnostics
 */
export const notifyDiag = {
  channelCreated: () => logDiagnostic("NOTIFY", "success", "Emergency channel created"),
  shown: () => logDiagnostic("NOTIFY", "success", "Emergency notification shown"),
  blocked: (reason: string) => logDiagnostic("NOTIFY", "warn", `Notification blocked: ${reason}`),
  actionTapped: (action: string) => logDiagnostic("NOTIFY", "info", `User action: ${action}`),
  permissionDenied: () => logDiagnostic("NOTIFY", "error", "Notification permission denied"),
  webFallback: () => logDiagnostic("NOTIFY", "info", "Using web notification fallback"),
};

/**
 * Platform diagnostics
 */
export const platformDiag = {
  detected: (platform: string) => logDiagnostic("PLATFORM", "info", `Platform: ${platform}`),
  nativeGuardActive: () => logDiagnostic("PLATFORM", "info", "Native-only guard active"),
  webGuardActive: () => logDiagnostic("PLATFORM", "info", "Web-only guard active"),
};

/**
 * SMS diagnostics (never logs phone numbers)
 */
export const smsDiag = {
  sending: (recipientCount: number) => 
    logDiagnostic("SMS", "info", `Sending to ${recipientCount} recipient(s)...`),
  sent: (successCount: number, totalCount: number) => 
    logDiagnostic("SMS", "success", `Sent ${successCount}/${totalCount}`),
  failed: (reason: string) => logDiagnostic("SMS", "error", `Failed: ${reason}`),
  retrying: (attempt: number) => logDiagnostic("SMS", "info", `Retry attempt ${attempt}`),
  simulated: () => logDiagnostic("SMS", "info", "DEV MODE - simulated"),
  locationIncluded: (hasLocation: boolean) => 
    logDiagnostic("SMS", "info", `Location: ${hasLocation ? "included" : "unavailable"}`),
};

/**
 * Background execution diagnostics
 */
export const backgroundDiag = {
  active: () => logDiagnostic("BACKGROUND", "success", "Background execution active"),
  restricted: () => logDiagnostic("BACKGROUND", "warn", "Background execution restricted by OS"),
  batteryOptimized: () => logDiagnostic("BACKGROUND", "warn", "Battery optimization may limit background work"),
  wakelock: (acquired: boolean) => 
    logDiagnostic("BACKGROUND", "info", `Wake lock: ${acquired ? "acquired" : "released"}`),
};

/**
 * Get recent diagnostics for debugging
 */
export function getRecentDiagnostics(): DiagnosticEntry[] {
  return [...diagnosticBuffer];
}

/**
 * Clear diagnostic buffer
 */
export function clearDiagnostics(): void {
  diagnosticBuffer.length = 0;
}
