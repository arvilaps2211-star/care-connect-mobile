import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmergencyNotificationRequest {
  emergencyId: string;
  userPhone: string;
  guardianPhone: string;
  userName: string;
  location: {
    latitude: number;
    longitude: number;
  };
  userAge?: number;
  userGender?: string;
  vehicleNumber?: string;
  bloodGroup?: string;
  medicalHistory?: string;
  profilePhotoUrl?: string;
  guardianName?: string;
  responderPhones?: string[]; // Hospital/ambulance phone numbers
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      emergencyId,
      userPhone,
      guardianPhone,
      userName,
      location,
      userAge,
      userGender,
      vehicleNumber,
      bloodGroup,
      medicalHistory,
      profilePhotoUrl,
      guardianName,
      responderPhones,
    }: EmergencyNotificationRequest = await req.json();

    console.log("Processing emergency notification:", {
      emergencyId,
      userPhone,
      guardianPhone,
      userName,
      location,
      userAge,
      bloodGroup,
      responderPhones,
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate shareable Google Maps link for easy navigation
    const mapsLink = `https://maps.google.com/maps?q=${location.latitude},${location.longitude}`;
    
    // Build guardian SMS message with simple, clear format
    const guardianSmsMessage = `🚨 EMERGENCY ALERT!\n\nEnsure ${userName} is safe...!\n\n📍 Location:\n${mapsLink}\n\n📞 Contact: ${userPhone}`;

    // Build detailed responder SMS with medical info for hospitals/ambulances
    let responderSmsMessage = `🚑 EMERGENCY RESPONSE NEEDED!\n\n`;
    responderSmsMessage += `👤 Patient: ${userName}\n`;
    responderSmsMessage += `📞 Phone: ${userPhone}\n`;
    if (userAge) responderSmsMessage += `📅 Age: ${userAge}\n`;
    if (userGender) responderSmsMessage += `⚧ Gender: ${userGender}\n`;
    if (vehicleNumber) responderSmsMessage += `🚗 Vehicle: ${vehicleNumber}\n`;
    
    responderSmsMessage += `\n🏥 MEDICAL INFO:\n`;
    responderSmsMessage += `🩸 Blood Group: ${bloodGroup || 'Unknown'}\n`;
    responderSmsMessage += `📋 History: ${medicalHistory || 'None provided'}\n`;
    
    responderSmsMessage += `\n📍 Location:\n${mapsLink}`;

    // Get Twilio credentials
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    let guardianSmsStatus = "not_configured";
    let responderSmsStatus = "not_configured";

    // Helper function to send SMS
    const sendSms = async (to: string, body: string): Promise<boolean> => {
      if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
        return false;
      }
      
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
              To: to,
              From: twilioPhoneNumber,
              Body: body,
            }),
          }
        );
        
        if (response.ok) {
          console.log("SMS sent successfully to:", to);
          return true;
        } else {
          const error = await response.text();
          console.error("Failed to send SMS to", to, ":", error);
          return false;
        }
      } catch (error) {
        console.error("Error sending SMS to", to, ":", error);
        return false;
      }
    };

    if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
      // Send SMS to guardian
      const guardianSuccess = await sendSms(guardianPhone, guardianSmsMessage);
      guardianSmsStatus = guardianSuccess ? "sent" : "failed";

      // Send SMS to hospitals/ambulances with medical info
      if (responderPhones && responderPhones.length > 0) {
        let successCount = 0;
        for (const phone of responderPhones) {
          const success = await sendSms(phone, responderSmsMessage);
          if (success) successCount++;
        }
        responderSmsStatus = successCount > 0 ? `sent_${successCount}/${responderPhones.length}` : "failed";
        console.log(`Responder SMS sent to ${successCount}/${responderPhones.length} recipients`);
      } else {
        // Fetch nearby hospitals and ambulances if no specific phones provided
        const { data: hospitals } = await supabase
          .from("hospitals")
          .select("contact_number")
          .not("contact_number", "is", null)
          .limit(5);

        const { data: ambulances } = await supabase
          .from("ambulance_services")
          .select("contact_number")
          .limit(5);

        const allResponderPhones = [
          ...(hospitals?.map(h => h.contact_number) || []),
          ...(ambulances?.map(a => a.contact_number) || []),
        ].filter(Boolean);

        if (allResponderPhones.length > 0) {
          let successCount = 0;
          for (const phone of allResponderPhones) {
            const success = await sendSms(phone, responderSmsMessage);
            if (success) successCount++;
          }
          responderSmsStatus = successCount > 0 ? `sent_${successCount}/${allResponderPhones.length}` : "failed";
          console.log(`Responder SMS sent to ${successCount}/${allResponderPhones.length} nearby responders`);
        }
      }
    } else {
      console.log("Twilio credentials not configured.");
      console.log("Guardian SMS would be:", guardianSmsMessage);
      console.log("Responder SMS would be:", responderSmsMessage);
    }

    // Update emergency record with notification status
    const { error: updateError } = await supabase
      .from("emergencies")
      .update({
        notified_at: new Date().toISOString(),
        guardian_notified: guardianSmsStatus === "sent",
      })
      .eq("id", emergencyId);

    if (updateError) {
      console.error("Error updating emergency:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        guardianSmsStatus,
        responderSmsStatus,
        mapsLink,
        message: guardianSmsStatus === "not_configured" 
          ? "Emergency logged. SMS requires Twilio configuration."
          : guardianSmsStatus === "sent"
          ? "Emergency notification sent successfully"
          : "Emergency logged but SMS failed",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in notify-emergency function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});