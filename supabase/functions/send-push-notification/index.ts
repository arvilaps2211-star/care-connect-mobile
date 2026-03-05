import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PushNotificationRequest {
  emergencyId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  targetRoles?: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { emergencyId, title, body, data, targetRoles = ["hospital", "ambulance"] } = 
      await req.json() as PushNotificationRequest;

    console.log(`Processing push notification for emergency: ${emergencyId}`);
    console.log(`Target roles: ${targetRoles.join(", ")}`);

    if (!fcmServerKey) {
      console.log("FCM_SERVER_KEY not configured - notifications will be logged only");
      
      // Log the notification attempt for debugging
      console.log("Notification details:", { title, body, data, targetRoles });
      
      return new Response(
        JSON.stringify({
          success: true,
          message: "FCM not configured - notification logged",
          notificationDetails: { title, body, targetRoles },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get user IDs for target roles
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", targetRoles);

    if (roleError) {
      console.error("Error fetching roles:", roleError);
      throw roleError;
    }

    const userIds = roleData?.map((r) => r.user_id) || [];
    console.log(`Found ${userIds.length} users with target roles`);

    if (userIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No users with target roles found",
          sentCount: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get FCM tokens for these users
    const { data: tokenData, error: tokenError } = await supabase
      .from("fcm_tokens")
      .select("token")
      .in("user_id", userIds);

    if (tokenError) {
      console.error("Error fetching FCM tokens:", tokenError);
      throw tokenError;
    }

    const tokens = tokenData?.map((t) => t.token) || [];
    console.log(`Found ${tokens.length} FCM tokens`);

    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No FCM tokens found for target users",
          sentCount: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Send FCM notifications
    const sendResults = await Promise.all(
      tokens.map(async (token) => {
        try {
          const response = await fetch("https://fcm.googleapis.com/fcm/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `key=${fcmServerKey}`,
            },
            body: JSON.stringify({
              to: token,
              notification: {
                title,
                body,
                icon: "/icons/icon-192x192.png",
                badge: "/icons/badge-72x72.png",
                click_action: "/hospital",
              },
              data: {
                emergencyId,
                ...data,
              },
              priority: "high",
            }),
          });

          const result = await response.json();
          console.log(`FCM response for token ${token.slice(0, 10)}...:`, result);
          return { success: response.ok, token: token.slice(0, 10), result };
        } catch (error) {
          console.error(`Error sending to token ${token.slice(0, 10)}...:`, error);
          return { success: false, token: token.slice(0, 10), error: String(error) };
        }
      })
    );

    const successCount = sendResults.filter((r) => r.success).length;
    console.log(`Successfully sent ${successCount}/${tokens.length} notifications`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${successCount} notifications`,
        sentCount: successCount,
        totalTokens: tokens.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-push-notification:", error);
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
