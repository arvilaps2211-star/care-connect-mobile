import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify the caller is a signed-in admin
    const { data: caller, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !caller.user) return json({ error: "Not signed in" }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: caller.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Admin access required" }, 403);

    const { type, email, password, name, latitude, longitude, contact } = await req.json();
    if (!["hospital", "ambulance"].includes(type)) return json({ error: "Invalid type" }, 400);
    if (!email || !password || !name || !contact) return json({ error: "Missing required fields" }, 400);
    const lat = Number(latitude), lng = Number(longitude);
    if (!(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180)) return json({ error: "Invalid coordinates" }, 400);
    if (String(password).length < 6) return json({ error: "Password must be at least 6 characters" }, 400);

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: String(email).trim().toLowerCase(), password, email_confirm: true,
    });
    if (createErr || !created.user) {
      const msg = createErr?.message ?? "Account creation failed";
      return json({ error: /already/i.test(msg) ? "An account with this email already exists" : msg }, 400);
    }
    const userId = created.user.id;
    const table = type === "hospital" ? "hospitals" : "ambulance_services";

    const { error: rowErr } = await admin.from(table).insert({
      name, latitude: lat, longitude: lng, contact_number: contact, user_id: userId,
    });
    if (rowErr) {
      await admin.auth.admin.deleteUser(userId); // roll back so retries don't create duplicates
      return json({ error: rowErr.message }, 400);
    }
    await admin.from("user_roles").insert({ user_id: userId, role: type });
    return json({ success: true });
  } catch (e: any) {
    return json({ error: e?.message || "Unexpected error" }, 500);
  }
});
