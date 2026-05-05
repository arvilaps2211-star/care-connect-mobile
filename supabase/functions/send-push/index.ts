import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * send-push
 * Send FCM push notifications to ambulance drivers (or specified user_ids / roles)
 * for a new/dispatched emergency.
 *
 * Body: {
 *   emergencyId?: string,
 *   title: string,
 *   body: string,
 *   data?: Record<string,string>,
 *   userIds?: string[],
 *   targetRoles?: string[]   // default ['ambulance']
 * }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const FCM_SERVER_KEY = Deno.env.get("FCM_SERVER_KEY");

    const payload = await req.json().catch(() => ({}));
    const {
      emergencyId,
      title = "🚨 Emergency Alert",
      body = "A new emergency has been dispatched",
      data = {},
      userIds,
      targetRoles = ["ambulance"],
    } = payload as any;

    // Resolve target user_ids
    let targets: string[] = Array.isArray(userIds) ? [...userIds] : [];
    if (targets.length === 0 && targetRoles?.length) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", targetRoles);
      targets = (roles || []).map((r: any) => r.user_id);
    }

    if (targets.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "no targets" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: tokens } = await supabase
      .from("fcm_tokens")
      .select("token, device_type, user_id")
      .in("user_id", targets);

    const tokenList = (tokens || []).map((t: any) => t.token).filter(Boolean);
    console.log(`[send-push] targets=${targets.length} tokens=${tokenList.length} fcmConfigured=${!!FCM_SERVER_KEY}`);

    if (!FCM_SERVER_KEY) {
      return new Response(
        JSON.stringify({
          success: true,
          sent: 0,
          tokens: tokenList.length,
          message: "FCM_SERVER_KEY not configured – logged only",
          preview: { title, body, data: { ...data, emergencyId } },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (tokenList.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "no fcm tokens for targets" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = await Promise.all(
      tokenList.map(async (token: string) => {
        try {
          const res = await fetch("https://fcm.googleapis.com/fcm/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `key=${FCM_SERVER_KEY}`,
            },
            body: JSON.stringify({
              to: token,
              priority: "high",
              notification: { title, body, sound: "default" },
              data: { ...data, emergencyId: emergencyId ?? "" },
            }),
          });
          const json = await res.json().catch(() => ({}));
          return { ok: res.ok, status: res.status, fcm: json };
        } catch (e: any) {
          return { ok: false, error: e?.message };
        }
      })
    );
    const sent = results.filter((r) => r.ok).length;
    console.log(`[send-push] sent ${sent}/${tokenList.length}`);
    return new Response(
      JSON.stringify({ success: true, sent, total: tokenList.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[send-push] error", e);
    return new Response(
      JSON.stringify({ success: false, error: e?.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});