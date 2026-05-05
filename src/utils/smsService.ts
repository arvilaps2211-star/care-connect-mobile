/**
 * SMS Service Utilities
 * Handles SMS sending, status tracking, retry logic, and DEV mode simulation
 */

import { supabase } from "@/integrations/supabase/client";
import { validateAndFormatPhone } from "@/utils/phoneValidation";
import { wasSMSSentRecently, markSMSPending, markSMSSent, markSMSFailed } from "@/utils/smsQueue";
import { smsDiag } from "@/utils/safetyDiagnostics";

export type SMSStatus = "pending" | "sent" | "partial" | "failed" | "not_configured" | "simulated" | "retrying" | "duplicate";

export interface SMSResult {
  to: string;
  guardianName?: string;
  success: boolean;
  skipped?: boolean;
  sid?: string;
  twilioStatus?: string;
  errorCode?: string;
  errorMessage?: string;
  retried?: boolean;
}

export interface SMSSendResponse {
  success: boolean;
  status: SMSStatus;
  results: SMSResult[];
  mapsLink?: string;
  summary?: {
    total: number;
    sent: number;
    failed: number;
    skipped: number;
    retried: number;
  };
  error?: string;
  simulated?: boolean;
  timestamp?: string;
}

// Configuration
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000; // 1s, 2s, 4s exponential backoff

// Persist last SMS attempt for debug page
function recordSmsAttempt(entry: Record<string, any>) {
  try {
    if (typeof window === "undefined") return;
    const payload = { ...entry, ts: new Date().toISOString() };
    localStorage.setItem("careconnect_last_sms_attempt", JSON.stringify(payload));
  } catch {}
}

// Check if we're in development/simulation mode
const isDevMode = (): boolean => {
  return import.meta.env.DEV;
};

/**
 * Send emergency SMS notification to guardians
 * Supports GPS location with fallback handling
 */
export async function sendEmergencySMS(params: {
  emergencyId: string;
  userPhone: string;
  userName: string;
  location: { latitude: number; longitude: number } | null;
  locationSource?: "gps" | "fallback" | "unavailable";
  guardians: Array<{ name: string; phone: string }>;
  userAge?: number;
  userGender?: string;
  vehicleNumber?: string;
  bloodGroup?: string;
  medicalHistory?: string;
  profilePhotoUrl?: string;
  residentialAddress?: string;
}, retryAttempt: number = 0): Promise<SMSSendResponse> {
  const isRetry = retryAttempt > 0;
  
  // Duplicate prevention check (skip on retry)
  if (!isRetry && wasSMSSentRecently(params.emergencyId, "emergency")) {
    console.log("[SMS] Duplicate prevented - emergency SMS already sent recently");
    return {
      success: true,
      status: "duplicate",
      results: [],
      error: "SMS already sent for this emergency",
    };
  }

  smsDiag.sending(params.guardians.length);
  console.log(`[SMS] ${isRetry ? "RETRY #" + retryAttempt : "Initiating"} emergency SMS notification...`);
  console.log("[SMS] Emergency ID:", params.emergencyId);

  // Mark as pending to prevent concurrent sends
  if (!isRetry) {
    markSMSPending(params.emergencyId, "emergency");
  }

  // Check location availability - DO NOT BLOCK if unavailable
  const hasLocation = params.location && params.location.latitude !== 0 && params.location.longitude !== 0;
  smsDiag.locationIncluded(hasLocation);

  // Validate guardian phone numbers before sending
  const validatedGuardians = params.guardians.map(g => ({
    ...g,
    validation: validateAndFormatPhone(g.phone),
  }));

  const invalidCount = validatedGuardians.filter(g => !g.validation.isValid).length;
  if (invalidCount > 0) {
    console.warn(`[SMS] ${invalidCount} guardian(s) have invalid phone numbers`);
  }

  // In DEV mode without real credentials, simulate
  if (isDevMode()) {
    console.log("[SMS] DEV MODE – checking if simulation needed");
  }

  try {
    const { data, error } = await supabase.functions.invoke("notify-emergency", {
      body: {
        emergencyId: params.emergencyId,
        userPhone: params.userPhone,
        userName: params.userName,
        location: params.location,
        guardianPhones: params.guardians.map((g) => g.phone),
        guardians: params.guardians,
        userAge: params.userAge,
        userGender: params.userGender,
        vehicleNumber: params.vehicleNumber,
        bloodGroup: params.bloodGroup,
        medicalHistory: params.medicalHistory,
        profilePhotoUrl: params.profilePhotoUrl,
        residentialAddress: params.residentialAddress,
      },
    });

    if (error) {
      console.error("[SMS] Edge function error:", error);
      
      // DEV mode simulation fallback
      if (isDevMode()) {
        console.log("[SMS] DEV MODE – simulated send (edge function failed)");
        return simulateSMSSend(params.guardians, params.location);
      }
      
      return {
        success: false,
        status: "failed",
        results: [],
        error: error.message,
      };
    }

    console.log("[SMS] Edge function response:", data);

    // Parse response status
    const status: SMSStatus = parseStatus(data?.guardianSmsStatus || data?.smsStatus);
    const retriedCount = data?.results?.filter((r: any) => r.retried)?.length || 0;

    const response: SMSSendResponse = {
      success: data?.success ?? false,
      status,
      results: data?.results || [],
      mapsLink: data?.mapsLink,
      summary: {
        total: data?.summary?.total || 0,
        sent: data?.summary?.sent || 0,
        failed: data?.summary?.failed || 0,
        skipped: data?.summary?.skipped || 0,
        retried: retriedCount,
      },
      timestamp: new Date().toISOString(),
    };

    // Mark SMS status for duplicate prevention
    if (response.success) {
      markSMSSent(params.emergencyId, "emergency");
      smsDiag.sent(response.summary?.sent || 0, response.summary?.total || 0);
    } else {
      markSMSFailed(params.emergencyId, "emergency");
      smsDiag.failed(response.error || "Unknown error");
    }

    recordSmsAttempt({
      kind: "emergency",
      emergencyId: params.emergencyId,
      attempt: retryAttempt + 1,
      success: response.success,
      status: response.status,
      summary: response.summary,
      error: response.error,
    });

    // Retry with exponential backoff: 1s, 2s, 4s
    if (!response.success && retryAttempt < MAX_RETRIES) {
      const wait = RETRY_BASE_DELAY_MS * Math.pow(2, retryAttempt);
      console.log(`[SMS] Retry ${retryAttempt + 1}/${MAX_RETRIES} in ${wait}ms`);
      await delay(wait);
      return sendEmergencySMS(params, retryAttempt + 1);
    }

    return response;
  } catch (err: any) {
    console.error("[SMS] Exception during send:", err);
    
    recordSmsAttempt({
      kind: "emergency",
      emergencyId: params.emergencyId,
      attempt: retryAttempt + 1,
      success: false,
      error: err?.message,
    });
    if (retryAttempt < MAX_RETRIES) {
      const wait = RETRY_BASE_DELAY_MS * Math.pow(2, retryAttempt);
      console.log(`[SMS] Exception retry ${retryAttempt + 1}/${MAX_RETRIES} in ${wait}ms`);
      await delay(wait);
      return sendEmergencySMS(params, retryAttempt + 1);
    }
    
    // DEV mode simulation fallback
    if (isDevMode()) {
      console.log("[SMS] DEV MODE – simulated send (exception, max retries reached)");
      return simulateSMSSend(params.guardians, params.location);
    }
    
    return {
      success: false,
      status: "failed",
      results: [],
      error: err?.message || "Unknown error",
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Delay utility for retry logic
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send ambulance dispatch notification
 */
export async function sendAmbulanceDispatchSMS(params: {
  emergencyId: string;
  ambulanceId: string;
  patientName: string;
  patientPhone: string;
  location: { latitude: number; longitude: number };
}): Promise<SMSSendResponse> {
  console.log("[SMS] Initiating ambulance dispatch notification...");
  console.log("[SMS] Emergency ID:", params.emergencyId);
  console.log("[SMS] Ambulance ID:", params.ambulanceId);

  try {
    const { data, error } = await supabase.functions.invoke("notify-ambulance-dispatch", {
      body: params,
    });

    if (error) {
      console.error("[SMS] Dispatch notification error:", error);
      
      if (isDevMode()) {
        console.log("[SMS] DEV MODE – simulated dispatch send");
        return {
          success: true,
          status: "simulated",
          results: [{ to: "driver", success: true }],
          simulated: true,
        };
      }
      
      return {
        success: false,
        status: "failed",
        results: [],
        error: error.message,
      };
    }

    console.log("[SMS] Dispatch response:", data);

    return {
      success: data?.success ?? false,
      status: parseStatus(data?.driverSmsStatus),
      results: data?.results || [],
      mapsLink: data?.mapsLink,
    };
  } catch (err: any) {
    console.error("[SMS] Dispatch exception:", err);
    
    if (isDevMode()) {
      console.log("[SMS] DEV MODE – simulated dispatch (exception)");
      return {
        success: true,
        status: "simulated",
        results: [],
        simulated: true,
      };
    }
    
    return {
      success: false,
      status: "failed",
      results: [],
      error: err?.message || "Unknown error",
    };
  }
}

/**
 * Send hospital acceptance notification
 */
export async function sendHospitalAcceptanceSMS(params: {
  emergencyId: string;
  hospitalId: string;
  hospitalName: string;
  hospitalPhone?: string;
  patientLocation: { latitude: number; longitude: number };
}): Promise<SMSSendResponse> {
  console.log("[SMS] Initiating hospital acceptance notification...");
  console.log("[SMS] Emergency ID:", params.emergencyId);
  console.log("[SMS] Hospital:", params.hospitalName);

  try {
    const { data, error } = await supabase.functions.invoke("notify-hospital-acceptance", {
      body: params,
    });

    if (error) {
      console.error("[SMS] Hospital acceptance notification error:", error);
      
      if (isDevMode()) {
        console.log("[SMS] DEV MODE – simulated hospital acceptance");
        return {
          success: true,
          status: "simulated",
          results: [],
          simulated: true,
        };
      }
      
      return {
        success: false,
        status: "failed",
        results: [],
        error: error.message,
      };
    }

    console.log("[SMS] Hospital acceptance response:", data);

    return {
      success: data?.success ?? false,
      status: parseStatus(data?.smsStatus),
      results: data?.results || [],
    };
  } catch (err: any) {
    console.error("[SMS] Hospital acceptance exception:", err);
    
    if (isDevMode()) {
      console.log("[SMS] DEV MODE – simulated hospital acceptance (exception)");
      return {
        success: true,
        status: "simulated",
        results: [],
        simulated: true,
      };
    }
    
    return {
      success: false,
      status: "failed",
      results: [],
      error: err?.message || "Unknown error",
    };
  }
}

/**
 * Parse Twilio/edge function status to our internal status type
 */
function parseStatus(status?: string): SMSStatus {
  if (!status) return "pending";
  
  const normalized = status.toLowerCase();
  
  if (normalized === "all_sent" || normalized === "sent" || normalized === "delivered") {
    return "sent";
  }
  if (normalized === "partial") {
    return "partial";
  }
  if (normalized === "failed" || normalized === "error") {
    return "failed";
  }
  if (normalized === "not_configured" || normalized === "no_guardians") {
    return "not_configured";
  }
  if (normalized === "simulated") {
    return "simulated";
  }
  
  return "pending";
}

/**
 * DEV mode SMS simulation - handles GPS unavailable case
 */
function simulateSMSSend(
  guardians: Array<{ name: string; phone: string }>,
  location: { latitude: number; longitude: number } | null
): SMSSendResponse {
  console.log("[SMS] DEV MODE – simulating SMS send to", guardians.length, "guardian(s)");
  
  const results: SMSResult[] = guardians.map((g) => ({
    to: g.phone,
    guardianName: g.name,
    success: true,
    sid: `DEV_SIM_${Date.now()}`,
    twilioStatus: "simulated",
  }));

  const hasLocation = location && location.latitude !== 0 && location.longitude !== 0;
  const mapsLink = hasLocation 
    ? `https://maps.google.com/?q=${location!.latitude},${location!.longitude}`
    : null;

  console.log("[SMS] DEV MODE – simulated payload:", {
    guardians,
    location: hasLocation ? location : "UNAVAILABLE",
    mapsLink: mapsLink || "GPS unavailable",
  });

  return {
    success: true,
    status: "simulated",
    results,
    mapsLink: mapsLink ?? undefined,
    summary: {
      total: guardians.length,
      sent: guardians.length,
      failed: 0,
      skipped: 0,
      retried: 0,
    },
    simulated: true,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get human-readable SMS status label
 */
export function getSMSStatusLabel(status: SMSStatus): string {
  switch (status) {
    case "sent":
      return "✓ SMS Sent";
    case "partial":
      return "⚠ Partial Delivery";
    case "failed":
      return "✗ SMS Failed";
    case "not_configured":
      return "⚙ Not Configured";
    case "simulated":
      return "🔧 DEV Simulated";
    case "retrying":
      return "↻ Retrying...";
    case "pending":
    default:
      return "⏳ Pending";
  }
}

/**
 * Get SMS status badge variant
 */
export function getSMSStatusVariant(status: SMSStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "sent":
      return "default";
    case "partial":
    case "retrying":
      return "secondary";
    case "failed":
      return "destructive";
    case "simulated":
    case "not_configured":
    case "pending":
    default:
      return "outline";
  }
}
