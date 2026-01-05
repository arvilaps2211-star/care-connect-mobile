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

// Helper function to format phone number with country code
function formatPhoneNumber(phone: string): string {
  // Remove any whitespace
  let cleaned = phone.replace(/\s+/g, "").trim();
  
  // If it starts with +, it's already formatted
  if (cleaned.startsWith("+")) {
    return cleaned;
  }
  
  // If it starts with 0, remove it and add +91 (India)
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }
  
  // If it's 10 digits, assume India (+91)
  if (cleaned.length === 10 && /^\d+$/.test(cleaned)) {
    return `+91${cleaned}`;
  }
  
  // Otherwise return as is with + prefix
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
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
      bloodGroup,
      medicalHistory,
      guardianName,
    }: EmergencyNotificationRequest = await req.json();

    // Format phone numbers with country code
    const formattedGuardianPhone = formatPhoneNumber(guardianPhone);
    const formattedUserPhone = formatPhoneNumber(userPhone);

    console.log("Processing emergency notification:", {
      emergencyId,
      userPhone: formattedUserPhone,
      guardianPhone: formattedGuardianPhone,
      userName,
      userAge,
      userGender,
      bloodGroup,
      location,
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get exact address from coordinates
    console.log("Fetching address for coordinates:", location.latitude, location.longitude);
    const exactAddress = await getAddressFromCoordinates(location.latitude, location.longitude);
    console.log("Resolved address:", exactAddress);

    // Generate shareable Google Maps link for easy navigation
    const mapsLink = `https://maps.google.com/maps?q=${location.latitude},${location.longitude}`;
    
    // Build guardian SMS message with patient details
    let guardianSmsMessage = `🚨 EMERGENCY ALERT!\n\n`;
    guardianSmsMessage += `${guardianName ? `Dear ${guardianName}, ` : ""}${userName} needs help!\n\n`;
    
    // Add patient details if available
    if (userAge || userGender || bloodGroup) {
      guardianSmsMessage += `👤 Patient Info:\n`;
      if (userAge) guardianSmsMessage += `Age: ${userAge}\n`;
      if (userGender) guardianSmsMessage += `Gender: ${userGender}\n`;
      if (bloodGroup) guardianSmsMessage += `Blood: ${bloodGroup}\n`;
      guardianSmsMessage += `\n`;
    }
    
    if (medicalHistory) {
      guardianSmsMessage += `⚕️ Medical: ${medicalHistory}\n\n`;
    }
    
    guardianSmsMessage += `📍 Location:\n${exactAddress}\n\n`;
    guardianSmsMessage += `🗺️ Maps: ${mapsLink}\n\n`;
    guardianSmsMessage += `📞 Contact: ${formattedUserPhone}`;

    console.log("SMS Message prepared:", guardianSmsMessage);

    // Get Twilio credentials
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");
    
    console.log("Twilio configured:", {
      hasAccountSid: !!twilioAccountSid,
      hasAuthToken: !!twilioAuthToken,
      hasPhoneNumber: !!twilioPhoneNumber,
    });

    let guardianSmsStatus = "not_configured";

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
              To: formattedGuardianPhone,
              From: twilioPhoneNumber,
              Body: guardianSmsMessage,
            }),
          }
        );

        if (response.ok) {
          guardianSmsStatus = "sent";
          console.log("SMS sent successfully to guardian:", guardianPhone);
        } else {
          const error = await response.text();
          console.error("Failed to send SMS:", error);
          guardianSmsStatus = "failed";
        }
      } catch (error) {
        console.error("Error sending SMS:", error);
        guardianSmsStatus = "error";
      }
    } else {
      console.log("Twilio credentials not configured. SMS message would be:", guardianSmsMessage);
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