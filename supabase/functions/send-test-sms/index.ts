import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendTestSmsRequest {
  toPhone: string;
  location: {
    latitude: number;
    longitude: number;
  };
}

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
  let cleaned = phone.replace(/\s+/g, "").trim();

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

    // Validate user is authenticated (verify_jwt disabled in config)
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

    const { toPhone, location }: SendTestSmsRequest = await req.json();
    if (!toPhone || !location?.latitude || !location?.longitude) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formattedTo = formatPhoneNumber(toPhone);
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
          error: "SMS not configured",
          details: "Missing SMS provider credentials",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
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

    console.log("Test SMS response:", {
      ok: response.ok,
      status: response.status,
      to: formattedTo,
    });

    if (!response.ok) {
      console.error("Test SMS failed:", responseText);
      return new Response(
        JSON.stringify({
          success: false,
          status: response.status,
          error: "Failed to send SMS",
          providerResponse: responseText,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: response.status,
        to: formattedTo,
        mapsLink,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-test-sms:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
