const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Eres el asistente de soporte de la plataforma "Central" (SaaS de logística/mensajería en Colombia).
La plataforma tiene:
- Panel Administrador de empresa: Dashboard, Análisis, Operaciones, Repartidores, Despacho (crear/publicar/despublicar/eliminar pedidos pendientes), Financiera, Alertas, Auditoría, Reportes, Seguimiento en mapa.
- App PWA del Mensajero: recibe pedidos por push, acepta, navega con Mapbox modo conducción, entrega, chat con central y cliente, historial de entregas y ganancias.
- Página pública de seguimiento para el cliente con chat y calificación.
- Panel SaaS (super admin): gestiona empresas, planes, pagos, usuarios.

Responde SIEMPRE en español, breve y directo (máx. 4-6 líneas). Explica cómo hacer cosas dentro del sistema, resuelve dudas de uso, sugiere pasos concretos. Si te preguntan algo fuera del alcance de la plataforma, respóndelo brevemente pero recuerda que tu foco es el sistema.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = (await req.json()) as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...(messages || [])],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(
        JSON.stringify({ error: "gateway_error", status: res.status, details: errText }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ content }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});