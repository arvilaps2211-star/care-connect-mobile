import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Coordinates = { latitude: number; longitude: number };

type GuardianInput = {
  name?: string;
  phone: string;
};

interface EmergencyNotificationRequest {
  emergencyId: string;
  userPhone: string;
  userName: string;
  location: Coordinates;

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
      userAge,
      userGender,
      bloodGroup,
      medicalHistory,
      residentialAddress,
    } = payload;

    if (!location?.latitude || !location?.longitude) {
      return new Response(JSON.stringify({ success: false, error: "Invalid location" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const guardians = normalizeGuardians(payload);

    console.log("Processing emergency notification:", {
      emergencyId,
      userName,
      guardiansCount: guardians.length,
      location,
    });

    // Initialize backend client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const exactAddress = await getAddressFromCoordinates(location.latitude, location.longitude);
    const mapsLink = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;

    const formattedUserPhone = formatPhoneNumber(userPhone);

    // Twilio credentials
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      return new Response(
        JSON.stringify({
          success: true,
          guardianSmsStatus: "not_configured",
          mapsLink,
          error: "SMS not configured",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (guardians.length === 0) {
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

    for (const g of guardians) {
      const to = formatPhoneNumber(g.phone);

      let body = `🚨 EMERGENCY ALERT!\n\n`;
      body += `${g.name ? `Dear ${g.name}, ` : ""}${userName} needs help!\n\n`;

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

      body += `📍 Current Location:\n${exactAddress}\n\n`;
      body += `🗺️ Maps: ${mapsLink}\n\n`;
      body += `📞 Contact: ${formattedUserPhone}`;

      try {
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

        console.log("Guardian SMS provider response:", {
          ok: response.ok,
          status: response.status,
          to,
          sid: twilio?.sid,
          twilioStatus: twilio?.status,
          errorCode: twilio?.code ?? twilio?.error_code,
          errorMessage: twilio?.message ?? twilio?.error_message,
        });

        results.push({
          to,
          guardianName: g.name,
          success: response.ok,
          httpStatus: response.status,
          sid: twilio?.sid,
          twilioStatus: twilio?.status,
          errorCode: twilio?.code ?? twilio?.error_code,
          errorMessage: twilio?.message ?? twilio?.error_message,
          raw: response.ok ? undefined : twilio,
        });
      } catch (e: any) {
        console.error("Error sending SMS:", e);
        results.push({
          to,
          guardianName: g.name,
          success: false,
          errorMessage: e?.message ?? "Unknown error",
        });
      }
    }

    const anySuccess = results.some((r) => r.success);

    // Mark emergency as notified if Twilio accepted at least one message.
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
        guardianSmsStatus: anySuccess ? "accepted" : "failed",
        results,
        mapsLink,
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
