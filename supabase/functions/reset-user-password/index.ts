import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  user_id?: string;
  new_password?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (status: number, data: unknown) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Missing Authorization" });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json(401, { error: "Not authenticated" });
    const caller = userData.user;

    const body = (await req.json()) as Body;
    const targetUserId = (body.user_id || "").trim();
    const newPassword = (body.new_password || "").trim();

    if (!targetUserId || !newPassword) {
      return json(400, { error: "user_id y new_password son obligatorios" });
    }
    if (newPassword.length < 6) {
      return json(400, { error: "La contraseña debe tener al menos 6 caracteres" });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Autorización
    const { data: isSuper } = await admin.rpc("is_super_admin", { uid: caller.id });
    let allowed = !!isSuper;

    if (!allowed) {
      // Admin de empresa: solo puede resetear drivers de su misma empresa
      const { data: myCompany } = await admin
        .from("company_users")
        .select("company_id")
        .eq("user_id", caller.id)
        .maybeSingle();

      if (myCompany?.company_id) {
        const { data: targetDriver } = await admin
          .from("driver_profiles")
          .select("company_id")
          .eq("id", targetUserId)
          .maybeSingle();
        allowed = !!targetDriver && targetDriver.company_id === myCompany.company_id;
      }
    }

    if (!allowed) return json(403, { error: "No autorizado" });

    const { error: updErr } = await admin.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
    });
    if (updErr) return json(400, { error: updErr.message });

    return json(200, { ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return json(500, { error: msg });
  }
});