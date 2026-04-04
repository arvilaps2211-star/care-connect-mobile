/**
 * SMS Bulk Service
 * Provides sendBulkSMS for sending SMS to multiple phone numbers
 * and hospital acceptance SMS to guardians.
 */

import { supabase } from "@/integrations/supabase/client";
import { validateAndFormatPhone } from "@/utils/phoneValidation";

export interface BulkSMSResult {
  phone: string;
  success: boolean;
  error?: string;
  sid?: string;
}

export interface BulkSMSResponse {
  total: number;
  sent: number;
  failed: number;
  results: BulkSMSResult[];
}

/**
 * Send SMS to multiple phone numbers via the send-test-sms edge function.
 * Validates each number (10+ digits), calls edge function per number,
 * logs masked phone (last 4 digits only).
 */
export async function sendBulkSMS(
  phoneNumbers: string[],
  message: string
): Promise<BulkSMSResponse> {
  const results: BulkSMSResult[] = [];
  let sent = 0;
  let failed = 0;

  console.log(`[BulkSMS] Sending to ${phoneNumbers.length} recipient(s)`);

  for (const phone of phoneNumbers) {
    const validation = validateAndFormatPhone(phone);
    const masked = phone.slice(-4).padStart(phone.length, "*");

    if (!validation.isValid) {
      console.warn(`[BulkSMS] Invalid phone skipped: ${masked}`);
      results.push({ phone: masked, success: false, error: "Invalid phone number" });
      failed++;
      continue;
    }

    try {
      console.log(`[BulkSMS] Sending to: ${masked}`);
      const { data, error } = await supabase.functions.invoke("send-test-sms", {
        body: {
          to: validation.formatted || phone,
          body: message,
        },
      });

      if (error) {
        console.error(`[BulkSMS] Failed for ${masked}:`, error.message);
        results.push({ phone: masked, success: false, error: error.message });
        failed++;
      } else if (data?.success === false) {
        console.error(`[BulkSMS] Provider error for ${masked}:`, data.error);
        results.push({ phone: masked, success: false, error: data.error || "Provider error" });
        failed++;
      } else {
        console.log(`[BulkSMS] Sent to ${masked}, SID: ${data?.sid || "N/A"}`);
        results.push({ phone: masked, success: true, sid: data?.sid });
        sent++;
      }

      // 800ms delay between recipients to avoid rate limiting
      if (phoneNumbers.indexOf(phone) < phoneNumbers.length - 1) {
        await new Promise((r) => setTimeout(r, 800));
      }
    } catch (err: any) {
      console.error(`[BulkSMS] Exception for ${masked}:`, err?.message);
      results.push({ phone: masked, success: false, error: err?.message || "Unknown error" });
      failed++;
    }
  }

  console.log(`[BulkSMS] Complete: ${sent} sent, ${failed} failed out of ${phoneNumbers.length}`);

  return {
    total: phoneNumbers.length,
    sent,
    failed,
    results,
  };
}

/**
 * Send hospital acceptance SMS to all guardians of an emergency's user.
 * Fetches guardians dynamically from the guardians table – NO hardcoded numbers.
 */
export async function sendHospitalAcceptanceSMSToGuardians(params: {
  emergencyId: string;
  hospitalName: string;
  hospitalLatitude: number;
  hospitalLongitude: number;
}): Promise<BulkSMSResponse> {
  console.log("[HospitalSMS] Sending acceptance SMS for emergency:", params.emergencyId);

  // 1. Fetch emergency to get user_id
  const { data: emergency, error: emergencyError } = await supabase
    .from("emergencies")
    .select("user_id")
    .eq("id", params.emergencyId)
    .single();

  if (emergencyError || !emergency) {
    console.error("[HospitalSMS] Failed to fetch emergency:", emergencyError?.message);
    return { total: 0, sent: 0, failed: 0, results: [] };
  }

  // 2. Fetch user profile for name
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("user_id", emergency.user_id)
    .single();

  const patientName = profile?.name || "Patient";

  // 3. Fetch guardians dynamically – NEVER hardcoded
  const { data: guardians, error: guardianError } = await supabase
    .from("guardians")
    .select("name, contact_number")
    .eq("user_id", emergency.user_id);

  if (guardianError) {
    console.error("[HospitalSMS] Failed to fetch guardians:", guardianError.message);
    return { total: 0, sent: 0, failed: 0, results: [] };
  }

  if (!guardians || guardians.length === 0) {
    console.log("[HospitalSMS] No guardians found for user:", emergency.user_id);
    return { total: 0, sent: 0, failed: 0, results: [] };
  }

  console.log(`[HospitalSMS] Found ${guardians.length} guardian(s)`);

  // 4. Build SMS message
  const mapsLink = `https://maps.google.com/?q=${params.hospitalLatitude},${params.hospitalLongitude}`;
  const message = `🏥 HOSPITAL ACCEPTED - ${patientName}\n📍 ${mapsLink}\n🏨 ${params.hospitalName}\n⏱️ Patient being transported`;

  // 5. Send to all guardians
  const phones = guardians.map((g) => g.contact_number);
  return sendBulkSMS(phones, message);
}
