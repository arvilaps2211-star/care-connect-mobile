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
    console.log(`Emergency ID: ${emergencyId}`);

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

    // Generate Google Maps link
    const mapsLink = `https://maps.google.com/maps?q=${location.latitude},${location.longitude}`;
    
    // Build SMS message for ambulance driver
    const driverSmsMessage = `🚨 NEW CASE DISPATCHED!\n\nPatient: ${patientName}\n📞 ${patientPhone}\n\n📍 Location:\n${mapsLink}\n\nOpen driver dashboard to accept/decline.`;

    // Get Twilio credentials
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    let smsStatus = "not_configured";

    if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber && ambulance.contact_number) {
      try {
        const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
        
        // Format phone number (ensure it has country code)
        let formattedPhone = ambulance.contact_number.replace(/\s+/g, '');
        if (!formattedPhone.startsWith('+')) {
          formattedPhone = '+91' + formattedPhone; // Default to India country code
        }

        console.log(`Sending SMS to: ${formattedPhone}`);

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              "Authorization": `Basic ${authHeader}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: formattedPhone,
              From: twilioPhoneNumber,
              Body: driverSmsMessage,
            }),
          }
        );

        if (response.ok) {
          smsStatus = "sent";
          console.log("SMS sent successfully to ambulance driver");
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
      console.log("Twilio credentials not configured or no ambulance phone. SMS would be:", driverSmsMessage);
    }

    return new Response(
      JSON.stringify({
        success: true,
        smsStatus,
        ambulanceName: ambulance.name,
        mapsLink,
        message: smsStatus === "sent" 
          ? "Ambulance driver notified via SMS"
          : smsStatus === "not_configured"
          ? "SMS not configured - notification logged"
          : "Notification logged but SMS failed",
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
