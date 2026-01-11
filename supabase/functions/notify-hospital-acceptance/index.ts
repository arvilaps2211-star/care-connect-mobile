import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

// Ensure phone has country code (defaults to +91 India if missing)
function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");
  if (!cleaned.startsWith("+")) {
    if (cleaned.startsWith("0")) {
      cleaned = cleaned.substring(1);
    }
    cleaned = "+91" + cleaned;
  }
  return cleaned;
}

// Reverse geocode to get address from coordinates
async function getAddressFromCoordinates(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'CareConnect Emergency App'
        }
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

    console.log("Processing hospital acceptance notification:", {
      emergencyId,
      hospitalId,
      hospitalName,
    });

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
      console.log("No guardian found for user");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No guardian to notify" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userName = profile?.name || "Your loved one";
    const patientAddress = profile?.address || "Address not available";

    // Get address from hospital location if not provided
    let finalHospitalAddress = hospitalAddress;
    if (!finalHospitalAddress) {
      // Get hospital coordinates
      const { data: hospital } = await supabase
        .from("hospitals")
        .select("latitude, longitude")
        .eq("id", hospitalId)
        .single();
      
      if (hospital) {
        finalHospitalAddress = await getAddressFromCoordinates(hospital.latitude, hospital.longitude);
      }
    }

    // Build patient location link
    const patientMapsLink = patientLocation
      ? `https://www.google.com/maps?q=${patientLocation.latitude},${patientLocation.longitude}`
      : "";

    // Build SMS message with hospital details and patient address
    const smsMessage = `✅ HOSPITAL UPDATE\n\n${userName} has been accepted by:\n\n🏥 ${hospitalName}\n📍 Hospital: ${finalHospitalAddress || "Address not available"}${hospitalPhone ? `\n📞 ${hospitalPhone}` : ""}\n\n📋 Patient Address: ${patientAddress}${patientMapsLink ? `\n📍 Patient Location: ${patientMapsLink}` : ""}\n\nThe hospital is preparing to dispatch an ambulance.`;

    // Get Twilio credentials
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    const results: any[] = [];

    if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
      const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

      // Send SMS to ALL guardians
      for (const guardian of guardians) {
        const formattedPhone = formatPhoneNumber(guardian.contact_number);
        
        try {
          const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
            {
              method: "POST",
              headers: {
                "Authorization": `Basic ${auth}`,
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
            errorCode: twilio?.error_code,
          });

          results.push({
            guardianName: guardian.name,
            to: formattedPhone,
            success: response.ok,
            sid: twilio?.sid,
            twilioStatus: twilio?.status,
            errorCode: twilio?.code,
          });
        } catch (error: any) {
          console.error("Error sending SMS to guardian:", guardian.name, error);
          results.push({
            guardianName: guardian.name,
            to: formattedPhone,
            success: false,
            error: error?.message,
          });
        }
      }
    } else {
      console.log("Twilio credentials not configured. SMS message would be:", smsMessage);
    }

    const anySuccess = results.some((r) => r.success);
    const allSuccess = results.every((r) => r.success);

    return new Response(
      JSON.stringify({
        success: true,
        smsStatus: results.length === 0 ? "not_configured" : anySuccess ? (allSuccess ? "all_sent" : "partial") : "failed",
        results,
        message: anySuccess 
          ? `Notified ${results.filter(r => r.success).length} of ${results.length} guardian(s)`
          : results.length === 0 
          ? "SMS requires Twilio configuration"
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
