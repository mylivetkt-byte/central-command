import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  company_id?: string;
  driver_id?: string; // opcional: enviar a un driver específico
  title: string;
  body: string;
  url?: string;
  delivery_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (status: number, data: unknown) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:notifications@lovable.app";

    if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json(500, { error: "VAPID keys not configured" });

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

    const body = (await req.json()) as Body;
    if (!body.title || !body.body) return json(400, { error: "title y body son obligatorios" });
    if (!body.company_id && !body.driver_id) return json(400, { error: "company_id o driver_id obligatorio" });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Encontrar drivers activos del target
    let driverIds: string[] = [];
    if (body.driver_id) {
      driverIds = [body.driver_id];
    } else if (body.company_id) {
      const { data: drivers } = await admin
        .from("driver_profiles")
        .select("id, status")
        .eq("company_id", body.company_id)
        .in("status", ["activo", "en_ruta"]);
      driverIds = (drivers || []).map((d: any) => d.id);
    }

    if (driverIds.length === 0) return json(200, { ok: true, sent: 0, reason: "no active drivers" });

    // 2. Cargar suscripciones
    const { data: subs } = await admin
      .from("driver_push_subscriptions")
      .select("id, endpoint, p256dh, auth_key")
      .in("driver_id", driverIds);

    if (!subs || subs.length === 0) return json(200, { ok: true, sent: 0, reason: "no subscriptions" });

    const payload = JSON.stringify({
      title: body.title,
      body: body.body,
      url: body.url || "/driver",
      delivery_id: body.delivery_id,
      ts: Date.now(),
    });

    let sent = 0;
    let failed = 0;
    const staleIds: string[] = [];

    await Promise.all(
      subs.map(async (s: any) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } },
            payload,
          );
          sent++;
        } catch (e: any) {
          failed++;
          // 404/410 = suscripción muerta, borrar
          if (e?.statusCode === 404 || e?.statusCode === 410) {
            staleIds.push(s.id);
          }
        }
      }),
    );

    if (staleIds.length > 0) {
      await admin.from("driver_push_subscriptions").delete().in("id", staleIds);
    }

    return json(200, { ok: true, sent, failed, cleaned: staleIds.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return json(500, { error: msg });
  }
});