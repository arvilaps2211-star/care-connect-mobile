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
      .select("name")
      .eq("user_id", emergency.user_id)
      .single();

    // Get guardian info
    const { data: guardians } = await supabase
      .from("guardians")
      .select("name, contact_number")
      .eq("user_id", emergency.user_id)
      .limit(1);

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

    const guardian = guardians[0];
    const userName = profile?.name || "Your loved one";

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

    // Build SMS message with hospital details
    const smsMessage = `✅ HOSPITAL UPDATE\n\n${userName} has been accepted by:\n\n🏥 ${hospitalName}\n📍 ${finalHospitalAddress || "Address not available"}${hospitalPhone ? `\n📞 ${hospitalPhone}` : ""}\n\nThe hospital is preparing to dispatch an ambulance.`;

    // Get Twilio credentials
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    let smsStatus = "not_configured";

    if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
      try {
        const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              "Authorization": `Basic ${authHeader}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: guardian.contact_number,
              From: twilioPhoneNumber,
              Body: smsMessage,
            }),
          }
        );

        if (response.ok) {
          smsStatus = "sent";
          console.log("Hospital acceptance SMS sent to guardian:", guardian.contact_number);
        } else {
          const error = await response.text();
          console.error("Failed to send SMS:", error);
          smsStatus = "failed";
        }
      } catch (error) {
        console.error("Error sending SMS:", error);
        smsStatus = "error";
      }
    } else {
      console.log("Twilio credentials not configured. SMS message would be:", smsMessage);
    }

    return new Response(
      JSON.stringify({
        success: true,
        smsStatus,
        message: smsStatus === "sent" 
          ? "Guardian notified of hospital acceptance"
          : smsStatus === "not_configured"
          ? "SMS requires Twilio configuration"
          : "Failed to send SMS to guardian",
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
