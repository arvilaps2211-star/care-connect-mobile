import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface HospitalAcceptanceRequest {
  emergencyId: string;
  hospitalId: string;
  hospitalName: string;
  hospitalAddress?: string;
  hospitalPhone?: string;
  patientLocation: {
    latitude: number;
    longitude: number;
  };
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

/**
 * Reverse geocode to get address from coordinates
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      emergencyId,
      hospitalId,
      hospitalName,
      hospitalAddress,
      hospitalPhone,
      patientLocation,
    }: HospitalAcceptanceRequest = await req.json();

    console.log("=== HOSPITAL ACCEPTANCE NOTIFICATION ===");
    console.log("Emergency ID:", emergencyId);
    console.log("Hospital:", hospitalName);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get emergency details and user info
    const { data: emergency, error: emergencyError } = await supabase
      .from("emergencies")
      .select("user_id")
      .eq("id", emergencyId)
      .single();

    if (emergencyError || !emergency) {
      console.error("Failed to fetch emergency:", emergencyError);
      return new Response(
        JSON.stringify({ error: "Emergency not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, address")
      .eq("user_id", emergency.user_id)
      .single();

    // Get ALL guardians for this user
    const { data: guardians } = await supabase
      .from("guardians")
      .select("name, contact_number")
      .eq("user_id", emergency.user_id);

    if (!guardians || guardians.length === 0) {
      console.log("No guardians found for user");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No guardian to notify",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Guardians to notify:", guardians.length);

    const userName = profile?.name || "Your loved one";
    const patientAddress = profile?.address || "Address not available";

    // Get hospital location and address
    let finalHospitalAddress = hospitalAddress;
    let hospitalMapsLink = "";
    
    if (!finalHospitalAddress || !hospitalMapsLink) {
      const { data: hospital } = await supabase
        .from("hospitals")
        .select("latitude, longitude")
        .eq("id", hospitalId)
        .single();

      if (hospital) {
        // Generate Google Maps link for hospital
        hospitalMapsLink = `https://maps.google.com/?q=${hospital.latitude},${hospital.longitude}`;
        
        // Get address if not provided
        if (!finalHospitalAddress) {
          finalHospitalAddress = await getAddressFromCoordinates(
            hospital.latitude,
            hospital.longitude
          );
        }
      }
    }

    // Build patient location link using standard Google Maps format
    const patientMapsLink = patientLocation
      ? `https://maps.google.com/?q=${patientLocation.latitude},${patientLocation.longitude}`
      : "";

    // Build clear SMS message with hospital details
    let smsMessage = `🏥 HOSPITAL UPDATE\n\n`;
    smsMessage += `${userName} has been accepted by:\n\n`;
    smsMessage += `🏥 ${hospitalName}\n`;
    smsMessage += `📍 ${finalHospitalAddress || "Address not available"}\n`;
    if (hospitalMapsLink) {
      smsMessage += `🗺️ Hospital: ${hospitalMapsLink}\n`;
    }
    if (hospitalPhone) {
      smsMessage += `📞 ${hospitalPhone}\n`;
    }
    smsMessage += `\n📋 Patient Home: ${patientAddress}`;
    if (patientMapsLink) {
      smsMessage += `\n📍 Patient Location: ${patientMapsLink}`;
    }
    smsMessage += `\n\nThe hospital is preparing to dispatch an ambulance.`;

    // Get Twilio credentials
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    const results: any[] = [];

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.log("Twilio credentials not configured");
      return new Response(
        JSON.stringify({
          success: true,
          smsStatus: "not_configured",
          message: "SMS requires Twilio configuration",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    // Send SMS to ALL guardians
    for (const guardian of guardians) {
      const { formatted: formattedPhone, isValid } = formatPhoneNumber(guardian.contact_number);

      // Skip invalid phone numbers
      if (!isValid || !formattedPhone) {
        console.warn(`Skipping invalid phone for guardian ${guardian.name}:`, guardian.contact_number);
        results.push({
          guardianName: guardian.name,
          to: guardian.contact_number,
          success: false,
          skipped: true,
          error: "Invalid phone number format",
        });
        continue;
      }

      try {
        console.log(`Sending hospital acceptance SMS to ${guardian.name}: ${formattedPhone}`);

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: formattedPhone,
              From: twilioPhoneNumber,
              Body: smsMessage,
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

        console.log("Hospital acceptance SMS response:", {
          ok: response.ok,
          status: response.status,
          to: formattedPhone,
          guardianName: guardian.name,
          sid: twilio?.sid,
          twilioStatus: twilio?.status,
          errorCode: twilio?.error_code ?? twilio?.code,
        });

        results.push({
          guardianName: guardian.name,
          to: formattedPhone,
          success: response.ok,
          sid: twilio?.sid,
          twilioStatus: twilio?.status,
          errorCode: response.ok ? undefined : (twilio?.code ?? twilio?.error_code),
        });
      } catch (error: any) {
        console.error(`Error sending SMS to guardian ${guardian.name}:`, error);
        results.push({
          guardianName: guardian.name,
          to: formattedPhone,
          success: false,
          error: error?.message,
        });
      }
    }

    const anySuccess = results.some((r) => r.success);
    const allSuccess = results.every((r) => r.success || r.skipped);
    const sentCount = results.filter((r) => r.success).length;

    console.log("=== HOSPITAL ACCEPTANCE SMS SUMMARY ===");
    console.log(`Sent: ${sentCount}/${results.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        smsStatus: results.length === 0
          ? "not_configured"
          : anySuccess
          ? allSuccess
            ? "all_sent"
            : "partial"
          : "failed",
        results,
        message: anySuccess
          ? `Notified ${sentCount} of ${results.length} guardian(s)`
          : "Failed to send SMS to guardians",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in notify-hospital-acceptance function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
