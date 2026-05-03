import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { email, password, phone, serviceName, licenseNumber } = await req.json();
    if (!email || !password || !serviceName || !phone) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { service_name: serviceName, license_number: licenseNumber, phone },
    });
    if (createErr || !created.user) throw createErr || new Error("User creation failed");

    const userId = created.user.id;
    const { data: amb, error: ambErr } = await supabase.from("ambulance_services").insert({
      name: serviceName, contact_number: phone, latitude: 0, longitude: 0, user_id: userId,
    }).select("id").single();
    if (ambErr) throw ambErr;

    const { error: roleErr } = await supabase.from("user_roles").insert({ user_id: userId, role: "ambulance" });
    if (roleErr) throw roleErr;

    return new Response(JSON.stringify({ success: true, ambulanceId: amb.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Registration failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});