/**
 * SMS Queue Manager
 * Prevents duplicate SMS sends and manages send state
 */

type SMSQueueEntry = {
  emergencyId: string;
  type: "emergency" | "hospital_acceptance" | "ambulance_dispatch";
  timestamp: number;
  status: "pending" | "sent" | "failed";
};

// In-memory queue to track sent SMS (resets on page reload)
const smsQueue: Map<string, SMSQueueEntry> = new Map();

// Cooldown period to prevent duplicate sends (5 minutes)
const DUPLICATE_PREVENTION_MS = 5 * 60 * 1000;

/**
 * Generate a unique key for SMS tracking
 */
function generateKey(emergencyId: string, type: SMSQueueEntry["type"]): string {
  return `${emergencyId}-${type}`;
}

/**
 * Check if SMS was recently sent for this emergency/type combination
 */
export function wasSMSSentRecently(
  emergencyId: string,
  type: SMSQueueEntry["type"]
): boolean {
  const key = generateKey(emergencyId, type);
  const entry = smsQueue.get(key);

  if (!entry) return false;

  const timeSinceSent = Date.now() - entry.timestamp;
  
  // If sent successfully within cooldown period, consider it duplicate
  if (entry.status === "sent" && timeSinceSent < DUPLICATE_PREVENTION_MS) {
    console.log(`[SMSQueue] Duplicate prevention: ${type} for ${emergencyId} was sent ${Math.round(timeSinceSent / 1000)}s ago`);
    return true;
  }

  // Allow retry if previous attempt failed
  if (entry.status === "failed") {
    return false;
  }

  // If pending for too long, allow retry
  if (entry.status === "pending" && timeSinceSent > 30000) {
    return false;
  }

  return entry.status === "pending";
}

/**
 * Mark SMS as pending (about to send)
 */
export function markSMSPending(
  emergencyId: string,
  type: SMSQueueEntry["type"]
): void {
  const key = generateKey(emergencyId, type);
  smsQueue.set(key, {
    emergencyId,
    type,
    timestamp: Date.now(),
    status: "pending",
  });
  console.log(`[SMSQueue] Marked pending: ${type} for ${emergencyId}`);
}

/**
 * Mark SMS as sent successfully
 */
export function markSMSSent(
  emergencyId: string,
  type: SMSQueueEntry["type"]
): void {
  const key = generateKey(emergencyId, type);
  const entry = smsQueue.get(key);
  
  if (entry) {
    entry.status = "sent";
    entry.timestamp = Date.now();
  } else {
    smsQueue.set(key, {
      emergencyId,
      type,
      timestamp: Date.now(),
      status: "sent",
    });
  }
  console.log(`[SMSQueue] Marked sent: ${type} for ${emergencyId}`);
}

/**
 * Mark SMS as failed
 */
export function markSMSFailed(
  emergencyId: string,
  type: SMSQueueEntry["type"]
): void {
  const key = generateKey(emergencyId, type);
  const entry = smsQueue.get(key);
  
  if (entry) {
    entry.status = "failed";
  } else {
    smsQueue.set(key, {
      emergencyId,
      type,
      timestamp: Date.now(),
      status: "failed",
    });
  }
  console.log(`[SMSQueue] Marked failed: ${type} for ${emergencyId}`);
}

/**
 * Get status for an SMS
 */
export function getSMSStatus(
  emergencyId: string,
  type: SMSQueueEntry["type"]
): SMSQueueEntry | null {
  const key = generateKey(emergencyId, type);
  return smsQueue.get(key) || null;
}

/**
 * Clear old entries from the queue (cleanup)
 */
export function cleanupSMSQueue(): void {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes

  for (const [key, entry] of smsQueue.entries()) {
    if (now - entry.timestamp > maxAge) {
      smsQueue.delete(key);
    }
  }
}

// Run cleanup periodically
if (typeof window !== "undefined") {
  setInterval(cleanupSMSQueue, 10 * 60 * 1000); // Every 10 minutes
}
