import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, "").trim();

  if (cleaned.startsWith("+")) return cleaned;

  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }

  if (cleaned.length === 10 && /^\d+$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
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

    const mapsLink = `https://maps.google.com/maps?q=${location.latitude},${location.longitude}`;
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

    const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    // Send SMS to ALL guardians
    const results: any[] = [];
    for (const phone of guardianPhones) {
      const formattedTo = formatPhoneNumber(phone);

      try {
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
              Body: smsBody,
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
          errorCode: twilio?.code,
          errorMessage: twilio?.message,
        });

        results.push({
          to: formattedTo,
          success: response.ok,
          status: response.status,
          sid: twilio?.sid,
          twilioStatus: twilio?.status,
          errorCode: twilio?.code,
          errorMessage: twilio?.message,
        });
      } catch (e: any) {
        console.error("Test SMS send error:", e);
        results.push({
          to: formattedTo,
          success: false,
          error: e?.message ?? "Unknown error",
        });
      }
    }

    const allSuccess = results.every((r) => r.success);
    const anySuccess = results.some((r) => r.success);

    return new Response(
      JSON.stringify({
        success: anySuccess,
        allSuccess,
        results,
        mapsLink,
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
