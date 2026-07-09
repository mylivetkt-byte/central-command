import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  company_id?: string;
  email?: string;
  password?: string;
  full_name?: string;
  phone?: string;
  role?: "admin" | "driver";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    // Cliente para validar la identidad del que llama
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const caller = userData.user;

    const body = (await req.json()) as Body;
    const role = body.role === "driver" ? "driver" : "admin";
    const email = (body.email || "").trim().toLowerCase();
    const password = (body.password || "").trim();
    const fullName = (body.full_name || "").trim();
    const phone = (body.phone || "").trim() || null;
    const companyId = (body.company_id || "").trim();

    if (!email || !password || !fullName || !companyId) {
      return new Response(JSON.stringify({ error: "email, password, full_name y company_id son obligatorios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "La contraseña debe tener al menos 6 caracteres" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Cliente con service role para operaciones administrativas
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });

    // Autorización: super_admin puede todo; admin solo para su propia empresa creando drivers
    const { data: isSuper } = await admin.rpc("is_super_admin", { uid: caller.id });
    let allowed = !!isSuper;
    if (!allowed && role === "driver") {
      const { data: myCompany } = await admin
        .from("company_users")
        .select("company_id")
        .eq("user_id", caller.id)
        .maybeSingle();
      allowed = !!myCompany && myCompany.company_id === companyId;
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Crear usuario ya confirmado
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone,
        role,
        company_id: companyId,
        is_approved: true,
      },
    });
    if (createErr || !created?.user) {
      return new Response(JSON.stringify({ error: createErr?.message || "No se pudo crear el usuario" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, user_id: created.user.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});