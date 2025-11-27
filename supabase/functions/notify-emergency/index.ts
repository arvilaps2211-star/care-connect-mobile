import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emergencyId, userPhone, guardianPhone, userName, location } = await req.json();

    console.log("Processing emergency notification:", {
      emergencyId,
      userPhone,
      guardianPhone,
      userName,
      location,
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Note: SMS functionality requires Twilio credentials to be configured
    // Users need to add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER
    // as secrets for SMS notifications to work
    
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    let smsStatus = "not_configured";

    if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
      try {
        // Send SMS to guardian
        const message = `EMERGENCY ALERT: ${userName} has triggered an emergency at location: ${location.latitude}, ${location.longitude}. Please respond immediately.`;
        
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
              To: guardianPhone,
              From: twilioPhoneNumber,
              Body: message,
            }),
          }
        );

        if (response.ok) {
          smsStatus = "sent";
          console.log("SMS sent successfully");
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
      console.log("Twilio credentials not configured. Skipping SMS.");
    }

    // Update emergency record
    const { error: updateError } = await supabase
      .from("emergencies")
      .update({
        notified_at: new Date().toISOString(),
        guardian_notified: smsStatus === "sent",
      })
      .eq("id", emergencyId);

    if (updateError) {
      console.error("Error updating emergency:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        smsStatus,
        message: smsStatus === "not_configured" 
          ? "Emergency logged. SMS requires Twilio configuration."
          : smsStatus === "sent"
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
