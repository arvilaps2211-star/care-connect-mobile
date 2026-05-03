import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// One-time seed: creates admin@careconnect.com / Admin@123 with admin role.
// Safe to call multiple times — idempotent.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const email = "admin@careconnect.com";
    const password = "Admin@123";

    // Try to find existing user
    const { data: list } = await supabase.auth.admin.listUsers();
    let user = list?.users?.find((u: any) => u.email === email);

    if (!user) {
      const { data: created, error } = await supabase.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (error) throw error;
      user = created.user!;
    }

    // Ensure admin role
    const { data: existing } = await supabase
      .from("user_roles").select("id")
      .eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!existing) {
      await supabase.from("user_roles").insert({ user_id: user.id, role: "admin" });
    }

    return new Response(JSON.stringify({ success: true, email, userId: user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});