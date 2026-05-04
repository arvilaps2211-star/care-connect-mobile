import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_SMS_LENGTH = 155;
function truncateSms(msg: string): string {
  if (!msg) return msg;
  if (msg.length <= MAX_SMS_LENGTH) {
    console.log(`[SMS] length=${msg.length} (ok)`);
    return msg;
  }
  console.warn(`[SMS] length=${msg.length} TRUNCATING to ${MAX_SMS_LENGTH}`);
  return msg.slice(0, MAX_SMS_LENGTH - 3) + "...";
}

/**
 * Reverse geocode coordinates to human-readable address
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
 */
function formatPhoneNumber(phone: string): { formatted: string; isValid: boolean } {
  if (!phone || typeof phone !== "string") {
    return { formatted: "", isValid: false };
  }

  let cleaned = phone.replace(/[^\d+]/g, "").trim();

  if (!cleaned) {
    return { formatted: "", isValid: false };
  }

  if (cleaned.startsWith("+")) {
    const isValid = /^\+[1-9]\d{6,14}$/.test(cleaned);
    return { formatted: cleaned, isValid };
  }

  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }

  if (cleaned.length === 10 && /^\d{10}$/.test(cleaned)) {
    return { formatted: `+91${cleaned}`, isValid: true };
  }

  if ((cleaned.length === 12 || cleaned.length === 11) && cleaned.startsWith("91")) {
    const withPlus = `+${cleaned}`;
    const isValid = /^\+91\d{10}$/.test(withPlus);
    return { formatted: withPlus, isValid };
  }

  const withPlus = cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
  const isValid = /^\+[1-9]\d{6,14}$/.test(withPlus);
  return { formatted: withPlus, isValid };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate user is authenticated
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { guardianPhones, location } = await req.json();

    console.log("=== TEST SMS REQUEST ===");
    console.log("User:", userRes.user.email);
    console.log("Guardian phones:", guardianPhones?.length || 0);

    // Validate guardians array
    if (!guardianPhones || !Array.isArray(guardianPhones) || guardianPhones.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No guardian phone numbers provided",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!location?.latitude || !location?.longitude) {
      return new Response(JSON.stringify({ error: "Invalid location" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Standard Google Maps link format
    const mapsLink = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
    const exactAddress = await getAddressFromCoordinates(location.latitude, location.longitude);

    const smsBody =
      `✅ CareConnect Test SMS\n\n` +
      `If you received this, SMS delivery is working.\n\n` +
      `📍 Location:\n${exactAddress}\n\n` +
      `🗺️ Maps: ${mapsLink}`;

    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.log("Twilio credentials not configured");
      return new Response(
        JSON.stringify({
          success: false,
          error: "SMS not configured",
          details: "Missing SMS provider credentials",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Reject Alphanumeric Sender ID — Twilio trial accounts (and most use cases) reject this with 21267.
    // The TWILIO_PHONE_NUMBER secret must be a real Twilio number in E.164 format (e.g. +15558675310).
    const fromIsNumeric = /^\+?[1-9]\d{6,14}$/.test(twilioPhoneNumber.trim());
    if (!fromIsNumeric) {
      console.error(
        `TWILIO_PHONE_NUMBER is not a valid E.164 number: "${twilioPhoneNumber}". ` +
          `Alphanumeric Sender IDs (e.g. "CARECONNECT") are not allowed on trial accounts (Twilio error 21267).`
      );
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "TWILIO_PHONE_NUMBER must be a real Twilio phone number in E.164 format (e.g. +15558675310). " +
            "Alphanumeric Sender IDs cannot be used on trial accounts.",
          errorCode: "21267",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    // Send SMS to ALL guardians
    const results: any[] = [];
    for (const phone of guardianPhones) {
      const { formatted: formattedTo, isValid } = formatPhoneNumber(phone);

      // Skip invalid phone numbers
      if (!isValid || !formattedTo) {
        console.warn(`Skipping invalid phone number: ${phone}`);
        results.push({
          to: phone,
          success: false,
          skipped: true,
          error: "Invalid phone number format",
        });
        continue;
      }

      try {
        console.log(`Sending test SMS to: ${formattedTo}`);

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: formattedTo,
              From: twilioPhoneNumber,
              Body: truncateSms(smsBody),
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

        console.log("Test SMS response:", {
          ok: response.ok,
          status: response.status,
          to: formattedTo,
          sid: twilio?.sid,
          twilioStatus: twilio?.status,
          errorCode: twilio?.code ?? twilio?.error_code,
          errorMessage: twilio?.message ?? twilio?.error_message,
        });

        results.push({
          to: formattedTo,
          success: response.ok,
          status: response.status,
          sid: twilio?.sid,
          twilioStatus: twilio?.status,
          errorCode: response.ok ? undefined : (twilio?.code ?? twilio?.error_code),
          errorMessage: response.ok ? undefined : (twilio?.message ?? twilio?.error_message),
        });
      } catch (e: any) {
        console.error(`Test SMS send error to ${formattedTo}:`, e);
        results.push({
          to: formattedTo,
          success: false,
          error: e?.message ?? "Unknown error",
        });
      }
    }

    const allSuccess = results.every((r) => r.success || r.skipped);
    const anySuccess = results.some((r) => r.success);
    const sentCount = results.filter((r) => r.success).length;

    console.log("=== TEST SMS SUMMARY ===");
    console.log(`Sent: ${sentCount}/${results.length}`);

    return new Response(
      JSON.stringify({
        success: anySuccess,
        allSuccess,
        results,
        mapsLink,
        summary: {
          total: results.length,
          sent: sentCount,
          failed: results.filter((r) => !r.success && !r.skipped).length,
          skipped: results.filter((r) => r.skipped).length,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-test-sms:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message ?? "Failed to send test SMS",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
