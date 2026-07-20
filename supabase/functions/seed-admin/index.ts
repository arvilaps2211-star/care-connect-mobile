import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// One-time seed: creates all 4 demo accounts (admin, hospital, driver, patient)
// with their roles. Safe to call multiple times — idempotent.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const accounts: { email: string; password: string; role: "admin" | "hospital" | "ambulance" | null; name: string }[] = [
      { email: "admin@careconnect.com",    password: "Admin@123",    role: "admin",     name: "Admin" },
      { email: "hospital@citycare.com",    password: "Hospital@123", role: "hospital",  name: "City Care Hospital" },
      { email: "driver@ambulance1.com",    password: "Driver@123",   role: "ambulance", name: "Ambulance Driver" },
      { email: "patient@test.com",         password: "Patient@123",  role: null,        name: "Test Patient" },
    ];

    const { data: list } = await supabase.auth.admin.listUsers();
    const results: any[] = [];

    for (const acct of accounts) {
      let user = list?.users?.find((u: any) => u.email === acct.email);
      let created = false;
      if (!user) {
        const { data: c, error } = await supabase.auth.admin.createUser({
          email: acct.email, password: acct.password, email_confirm: true,
        });
        if (error) { results.push({ email: acct.email, error: error.message }); continue; }
        user = c.user!;
        created = true;
      }

      // Ensure profile row exists (patient/driver need it for app flows)
      await supabase.from("profiles").upsert(
        { user_id: user.id, name: acct.name, onboarding_completed: acct.role !== null },
        { onConflict: "user_id" },
      );

      // Ensure role
      if (acct.role) {
        const { data: existing } = await supabase
          .from("user_roles").select("id")
          .eq("user_id", user.id).eq("role", acct.role).maybeSingle();
        if (!existing) {
          await supabase.from("user_roles").insert({ user_id: user.id, role: acct.role });
        }
      }

      results.push({ email: acct.email, userId: user.id, role: acct.role, created });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});