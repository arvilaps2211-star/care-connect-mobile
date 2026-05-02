import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Coordinates = { latitude: number; longitude: number } | null;

type GuardianInput = {
  name?: string;
  phone: string;
};

interface EmergencyNotificationRequest {
  emergencyId: string;
  userPhone: string;
  userName: string;
  location: Coordinates;
  locationSource?: "gps" | "fallback" | "unavailable";

  // Backwards compat (older clients)
  guardianPhone?: string;
  guardianName?: string;

  // Preferred (multi-guardian)
  guardianPhones?: string[];
  guardians?: GuardianInput[];

  userAge?: number;
  userGender?: string;
  vehicleNumber?: string;
  bloodGroup?: string;
  medicalHistory?: string;
  profilePhotoUrl?: string;
  residentialAddress?: string;
}

/**
 * Reverse geocode coordinates to human-readable address using Nominatim
 */
async function getAddressFromCoordinates(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          "User-Agent": "CareConnect Emergency App",
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  } catch (error) {
    console.error("Geocoding error:", error);
  }

  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

/**
 * Format phone number to E.164 format (+91XXXXXXXXXX for India)
 * Validates that the result is a proper E.164 number
 */
function formatPhoneNumber(phone: string): { formatted: string; isValid: boolean } {
  if (!phone || typeof phone !== "string") {
    return { formatted: "", isValid: false };
  }

  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, "").trim();

  // If empty after cleaning, invalid
  if (!cleaned) {
    return { formatted: "", isValid: false };
  }

  // If already has country code
  if (cleaned.startsWith("+")) {
    // Validate E.164 format (+ followed by 7-15 digits)
    const isValid = /^\+[1-9]\d{6,14}$/.test(cleaned);
    return { formatted: cleaned, isValid };
  }

  // Remove leading 0 if present (common in India)
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }

  // If 10 digits, assume India (+91)
  if (cleaned.length === 10 && /^\d{10}$/.test(cleaned)) {
    return { formatted: `+91${cleaned}`, isValid: true };
  }

  // If 11-12 digits starting with 91, add +
  if ((cleaned.length === 12 || cleaned.length === 11) && cleaned.startsWith("91")) {
    const withPlus = `+${cleaned}`;
    const isValid = /^\+91\d{10}$/.test(withPlus);
    return { formatted: withPlus, isValid };
  }

  // For other formats, try adding + and validate
  const withPlus = cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
  const isValid = /^\+[1-9]\d{6,14}$/.test(withPlus);
  return { formatted: withPlus, isValid };
}

/**
 * Normalize guardian list from various input formats
 */
function normalizeGuardians(payload: EmergencyNotificationRequest): GuardianInput[] {
  // Preferred: explicit guardians array
  if (Array.isArray(payload.guardians) && payload.guardians.length > 0) {
    return payload.guardians
      .map((g) => ({ name: g?.name, phone: String(g?.phone ?? "").trim() }))
      .filter((g) => g.phone);
  }

  // Next: phone list
  if (Array.isArray(payload.guardianPhones) && payload.guardianPhones.length > 0) {
    return payload.guardianPhones
      .map((p) => ({ phone: String(p ?? "").trim() }))
      .filter((g) => g.phone);
  }

  // Backwards compat
  if (payload.guardianPhone) {
    return [{ name: payload.guardianName, phone: String(payload.guardianPhone).trim() }];
  }

  return [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: EmergencyNotificationRequest = await req.json();

    const {
      emergencyId,
      userPhone,
      userName,
      location,
      locationSource,
      userAge,
      userGender,
      bloodGroup,
      medicalHistory,
      residentialAddress,
    } = payload;

    console.log("=== EMERGENCY SMS NOTIFICATION ===");
    console.log("Emergency ID:", emergencyId);
    console.log("User:", userName);
    console.log("Location source:", locationSource || "unknown");

    // Validate location - ALLOW null/missing location (send SMS without GPS)
    const hasValidLocation = location && 
      typeof location.latitude === "number" && 
      typeof location.longitude === "number" &&
      location.latitude !== 0 && 
      location.longitude !== 0;

    if (!hasValidLocation) {
      console.warn("GPS location unavailable or invalid - SMS will be sent without location link");
    } else {
      console.log("Location:", location.latitude.toFixed(6), location.longitude.toFixed(6));
    }

    const guardians = normalizeGuardians(payload);
    console.log("Guardians to notify:", guardians.length);

    // Initialize backend client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get address from coordinates (if available)
    let exactAddress = "Location unavailable";
    let mapsLink: string | null = null;

    if (hasValidLocation && location) {
      exactAddress = await getAddressFromCoordinates(location.latitude, location.longitude);
      mapsLink = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
      console.log("Resolved address:", exactAddress);
      console.log("Maps link:", mapsLink);
    } else {
      console.log("No GPS - skipping address resolution");
    }

    // Format user phone for contact info in SMS
    const { formatted: formattedUserPhone } = formatPhoneNumber(userPhone);

    // Twilio credentials from Supabase secrets
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    // Check Twilio configuration
    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.error("Twilio credentials not configured");
      console.log("Missing: ", {
        accountSid: !!twilioAccountSid,
        authToken: !!twilioAuthToken,
        phoneNumber: !!twilioPhoneNumber,
      });

      // Update emergency record even if SMS not configured
      await supabase
        .from("emergencies")
        .update({
          notified_at: new Date().toISOString(),
          guardian_notified: false,
        })
        .eq("id", emergencyId);

      return new Response(
        JSON.stringify({
          success: true,
          guardianSmsStatus: "not_configured",
          mapsLink,
          error: "SMS not configured - Twilio credentials missing",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reject Alphanumeric Sender ID — Twilio trial accounts reject this with error 21267.
    const fromIsNumeric = /^\+?[1-9]\d{6,14}$/.test(twilioPhoneNumber.trim());
    if (!fromIsNumeric) {
      console.error(
        `TWILIO_PHONE_NUMBER is not a valid E.164 number: "${twilioPhoneNumber}". ` +
          `Alphanumeric Sender IDs are not allowed on trial accounts (Twilio error 21267).`
      );
      await supabase
        .from("emergencies")
        .update({ notified_at: new Date().toISOString(), guardian_notified: false })
        .eq("id", emergencyId);

      return new Response(
        JSON.stringify({
          success: false,
          guardianSmsStatus: "not_configured",
          mapsLink,
          error:
            "TWILIO_PHONE_NUMBER must be a real Twilio phone number in E.164 format (e.g. +15558675310). " +
            "Alphanumeric Sender IDs are not supported on trial accounts.",
          errorCode: "21267",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if there are guardians to notify
    if (guardians.length === 0) {
      console.log("No guardians found for user");
      
      await supabase
        .from("emergencies")
        .update({
          notified_at: new Date().toISOString(),
          guardian_notified: false,
        })
        .eq("id", emergencyId);

      return new Response(
        JSON.stringify({
          success: true,
          guardianSmsStatus: "no_guardians",
          mapsLink,
          message: "No guardians found for this user.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
    const results: any[] = [];

    // Send SMS to EACH guardian (with delay between calls to avoid Twilio rate limits)
    for (let i = 0; i < guardians.length; i++) {
      const g = guardians[i];
      const { formatted: to, isValid } = formatPhoneNumber(g.phone);

      // Skip invalid phone numbers (don't crash, just log and continue)
      if (!isValid || !to) {
        console.warn(`Skipping invalid phone number for guardian ${g.name}:`, g.phone);
        results.push({
          to: g.phone,
          guardianName: g.name,
          success: false,
          skipped: true,
          errorMessage: "Invalid phone number format",
        });
        continue;
      }

      // Build personalized SMS message
      let body = `🚨 EMERGENCY ALERT!\n\n`;
      body += `${g.name ? `Dear ${g.name}, ` : ""}${userName} needs help!\n\n`;

      // Add patient info if available
      if (userAge || userGender || bloodGroup) {
        body += `👤 Patient Info:\n`;
        if (userAge) body += `Age: ${userAge}\n`;
        if (userGender) body += `Gender: ${userGender}\n`;
        if (bloodGroup) body += `Blood: ${bloodGroup}\n`;
        body += `\n`;
      }

      if (medicalHistory) {
        body += `⚕️ Medical: ${medicalHistory}\n\n`;
      }

      if (residentialAddress) {
        body += `🏠 Home Address:\n${residentialAddress}\n\n`;
      }

      // Add location info - handle GPS unavailable case
      if (hasValidLocation && mapsLink) {
        body += `📍 Current Location:\n${exactAddress}\n\n`;
        body += `🗺️ Maps: ${mapsLink}\n\n`;
      } else {
        body += `📍 Location: Unable to fetch GPS at this moment\n\n`;
      }

      body += `📞 Contact: ${formattedUserPhone || userPhone}`;

      // Retry logic per guardian (1 retry on failure)
      let lastError: any = null;
      let sent = false;

      for (let attempt = 0; attempt < 2 && !sent; attempt++) {
        try {
          if (attempt > 0) {
            console.log(`Retry attempt ${attempt} for ${g.name}: ${to}`);
            await new Promise(r => setTimeout(r, 1500));
          }

          console.log(`Sending SMS to guardian ${g.name || "Unknown"}: ${to} (attempt ${attempt + 1})`);

          const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
            {
              method: "POST",
              headers: {
                Authorization: `Basic ${authHeader}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                To: to,
                From: twilioPhoneNumber,
                Body: body,
              }),
            }
          );

          const responseText = await response.text();
          let twilio: any = null;
          try {
            twilio = JSON.parse(responseText);
          } catch {
            twilio = { raw: responseText };
          }

          console.log("Twilio response:", {
            ok: response.ok,
            status: response.status,
            to,
            guardianName: g.name,
            sid: twilio?.sid,
            twilioStatus: twilio?.status,
            errorCode: twilio?.code ?? twilio?.error_code,
          });

          if (response.ok) {
            results.push({
              to,
              guardianName: g.name,
              success: true,
              httpStatus: response.status,
              sid: twilio?.sid,
              twilioStatus: twilio?.status,
              retried: attempt > 0,
            });
            sent = true;
          } else {
            // Check if it's a Twilio trial account restriction (21608)
            const errorCode = twilio?.code ?? twilio?.error_code;
            if (errorCode === 21608 || errorCode === "21608") {
              // Unverified number on trial - no point retrying
              results.push({
                to,
                guardianName: g.name,
                success: false,
                httpStatus: response.status,
                errorCode: String(errorCode),
                errorMessage: "Unverified number (Twilio trial). Verify this number at twilio.com/console/phone-numbers/verified",
              });
              sent = true; // Don't retry
            } else {
              lastError = {
                httpStatus: response.status,
                errorCode,
                errorMessage: twilio?.message ?? twilio?.error_message,
              };
            }
          }
        } catch (e: any) {
          console.error(`Error sending SMS to ${g.name} (attempt ${attempt + 1}):`, e);
          lastError = { errorMessage: e?.message ?? "Unknown error" };
        }
      }

      if (!sent && lastError) {
        results.push({
          to,
          guardianName: g.name,
          success: false,
          ...lastError,
        });
      }

      // Delay between recipients to avoid Twilio rate limits
      if (i < guardians.length - 1) {
        await new Promise(r => setTimeout(r, 800));
      }
    }

    const anySuccess = results.some((r) => r.success);
    const allSuccess = results.every((r) => r.success || r.skipped);
    const sentCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success && !r.skipped).length;
    const skippedCount = results.filter((r) => r.skipped).length;

    console.log("=== SMS SUMMARY ===");
    console.log(`Sent: ${sentCount}, Failed: ${failedCount}, Skipped: ${skippedCount}`);

    // Update emergency record with notification status
    await supabase
      .from("emergencies")
      .update({
        notified_at: new Date().toISOString(),
        guardian_notified: anySuccess,
      })
      .eq("id", emergencyId);

    return new Response(
      JSON.stringify({
        success: anySuccess,
        guardianSmsStatus: anySuccess ? (allSuccess ? "all_sent" : "partial") : "failed",
        results,
        mapsLink,
        summary: {
          total: results.length,
          sent: sentCount,
          failed: failedCount,
          skipped: skippedCount,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in notify-emergency function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
