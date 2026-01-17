import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DispatchNotificationRequest {
  emergencyId: string;
  ambulanceId: string;
  patientName: string;
  patientPhone: string;
  location: {
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { emergencyId, ambulanceId, patientName, patientPhone, location } = 
      await req.json() as DispatchNotificationRequest;

    console.log(`Processing dispatch notification for ambulance: ${ambulanceId}`);
    console.log(`Emergency ID: ${emergencyId}, Patient: ${patientName}`);

    // Get emergency details for user_id
    const { data: emergency, error: emergencyError } = await supabase
      .from("emergencies")
      .select("user_id, accepted_by_hospital")
      .eq("id", emergencyId)
      .single();

    if (emergencyError || !emergency) {
      console.error("Emergency not found:", emergencyError);
      throw new Error("Emergency not found");
    }

    // Get ambulance details
    const { data: ambulance, error: ambulanceError } = await supabase
      .from("ambulance_services")
      .select("name, contact_number")
      .eq("id", ambulanceId)
      .single();

    if (ambulanceError || !ambulance) {
      console.error("Ambulance not found:", ambulanceError);
      throw new Error("Ambulance not found");
    }

    console.log(`Ambulance: ${ambulance.name}, Contact: ${ambulance.contact_number}`);

    // Get hospital details if available
    let hospitalName = "Hospital";
    if (emergency.accepted_by_hospital) {
      const { data: hospital } = await supabase
        .from("hospitals")
        .select("name")
        .eq("id", emergency.accepted_by_hospital)
        .single();
      if (hospital) hospitalName = hospital.name;
    }

    // Get guardians for this user
    const { data: guardians } = await supabase
      .from("guardians")
      .select("name, contact_number")
      .eq("user_id", emergency.user_id);

    // Get patient address from coordinates
    const patientAddress = await getAddressFromCoordinates(location.latitude, location.longitude);
    const mapsLink = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
    
    // Build SMS message for ambulance driver
    const driverSmsMessage = `🚨 NEW CASE DISPATCHED!\n\nPatient: ${patientName}\n📞 ${patientPhone}\n\n📍 Location:\n${patientAddress}\n\n🗺️ Navigate: ${mapsLink}\n\nOpen driver dashboard to accept.`;

    // Build SMS message for guardians
    const guardianSmsMessage = `🚑 AMBULANCE DISPATCHED\n\nAn ambulance has been dispatched for ${patientName}.\n\n🚑 ${ambulance.name}\n📞 Driver: ${ambulance.contact_number}\n🏥 From: ${hospitalName}\n\n📍 Patient Location:\n${mapsLink}\n\nHelp is on the way!`;

    // Get Twilio credentials
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    const results: any[] = [];
    let driverSmsStatus = "not_configured";

    if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
      const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

      // Send SMS to ambulance driver
      if (ambulance.contact_number) {
        const formattedDriverPhone = formatPhoneNumber(ambulance.contact_number);
        console.log(`Sending SMS to ambulance driver: ${formattedDriverPhone}`);

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
                To: formattedDriverPhone,
                From: twilioPhoneNumber,
                Body: driverSmsMessage,
              }),
            }
          );

          const responseText = await response.text();
          let twilioRes: any = {};
          try { twilioRes = JSON.parse(responseText); } catch { twilioRes = { raw: responseText }; }

          console.log("Driver SMS response:", {
            ok: response.ok,
            status: response.status,
            sid: twilioRes?.sid,
            twilioStatus: twilioRes?.status,
          });

          driverSmsStatus = response.ok ? "sent" : "failed";
          results.push({
            recipient: "ambulance_driver",
            to: formattedDriverPhone,
            success: response.ok,
            sid: twilioRes?.sid,
            twilioStatus: twilioRes?.status,
          });
        } catch (error: any) {
          console.error("Error sending SMS to driver:", error);
          driverSmsStatus = "error";
          results.push({
            recipient: "ambulance_driver",
            to: formattedDriverPhone,
            success: false,
            error: error?.message,
          });
        }
      }

      // Send SMS to ALL guardians
      if (guardians && guardians.length > 0) {
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
                  Body: guardianSmsMessage,
                }),
              }
            );

            const responseText = await response.text();
            let twilioRes: any = {};
            try { twilioRes = JSON.parse(responseText); } catch { twilioRes = { raw: responseText }; }

            console.log("Guardian SMS response:", {
              ok: response.ok,
              guardianName: guardian.name,
              to: formattedPhone,
              sid: twilioRes?.sid,
            });

            results.push({
              recipient: `guardian_${guardian.name}`,
              to: formattedPhone,
              success: response.ok,
              sid: twilioRes?.sid,
              twilioStatus: twilioRes?.status,
            });
          } catch (error: any) {
            console.error("Error sending SMS to guardian:", guardian.name, error);
            results.push({
              recipient: `guardian_${guardian.name}`,
              to: formattedPhone,
              success: false,
              error: error?.message,
            });
          }
        }
      } else {
        console.log("No guardians found for this user");
      }
    } else {
      console.log("Twilio credentials not configured.");
      console.log("Driver SMS would be:", driverSmsMessage);
      console.log("Guardian SMS would be:", guardianSmsMessage);
    }

    const anySuccess = results.some((r) => r.success);

    return new Response(
      JSON.stringify({
        success: true,
        driverSmsStatus,
        ambulanceName: ambulance.name,
        mapsLink,
        results,
        message: anySuccess 
          ? `Notifications sent: ${results.filter(r => r.success).length} of ${results.length}`
          : results.length === 0 
          ? "SMS not configured"
          : "SMS notifications failed",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in notify-ambulance-dispatch:", error);
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
