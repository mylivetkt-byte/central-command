import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ---------- POST: customer sends chat message ----------
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const action = String(body.action || "chat");
      const orderId = String(body.order_id || "").slice(0, 64);
      if (!orderId) {
        return new Response(JSON.stringify({ error: "order_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: d } = await supabase
        .from("deliveries")
        .select("id, company_id, status, driver_id")
        .eq("order_id", orderId).maybeSingle();
      if (!d) {
        return new Response(JSON.stringify({ error: "not_found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ---- Rating action ----
      if (action === "rate") {
        if (String((d as any).status) !== "entregado") {
          return new Response(JSON.stringify({ error: "not_delivered" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const score = Math.round(Number(body.score));
        if (!Number.isInteger(score) || score < 1 || score > 5) {
          return new Response(JSON.stringify({ error: "invalid_score" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const comment = body.comment ? String(body.comment).trim().slice(0, 500) : null;
        const tip = Math.max(0, Math.min(1_000_000, Number(body.tip_amount || 0)));

        const { data: existing } = await supabase
          .from("delivery_ratings").select("id").eq("delivery_id", (d as any).id).maybeSingle();
        if (existing) {
          return new Response(JSON.stringify({ error: "already_rated" }), {
            status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: rating, error: rErr } = await supabase
          .from("delivery_ratings").insert({
            delivery_id: (d as any).id,
            driver_id: (d as any).driver_id,
            company_id: (d as any).company_id,
            score,
            comment,
            tip_amount: tip,
          }).select("id, score, comment, tip_amount, created_at").single();
        if (rErr) throw rErr;
        return new Response(JSON.stringify({ ok: true, rating }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ---- Chat action (default) ----
      const message = String(body.message || "").trim().slice(0, 500);
      if (!message) {
        return new Response(JSON.stringify({ error: "message required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (["entregado", "cancelado"].includes(String((d as any).status))) {
        return new Response(JSON.stringify({ error: "closed" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: inserted, error: insErr } = await supabase
        .from("chat_messages")
        .insert({
          delivery_id: (d as any).id,
          sender_id: (d as any).id,
          sender_role: "customer",
          message,
          company_id: (d as any).company_id,
        })
        .select("id, created_at")
        .single();
      if (insErr) throw insErr;
      return new Response(JSON.stringify({ ok: true, message: inserted }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------- GET ----------
    const orderId = url.searchParams.get("order_id");
    if (!orderId || orderId.length > 64) {
      return new Response(JSON.stringify({ error: "order_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const wantChat = url.searchParams.get("chat") === "1";

    const { data: d, error } = await supabase
      .from("deliveries")
      .select("id, order_id, status, pickup_address, delivery_address, pickup_lat, pickup_lng, delivery_lat, delivery_lng, driver_id, created_at, accepted_at, delivered_at")
      .eq("order_id", orderId)
      .maybeSingle();

    if (error) throw error;
    if (!d) {
      return new Response(JSON.stringify({ delivery: null }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Existing rating (so UI knows whether to show the form)
    const { data: existingRating } = await supabase
      .from("delivery_ratings")
      .select("score, comment, tip_amount, created_at")
      .eq("delivery_id", (d as any).id)
      .maybeSingle();

    // Chat-only fast path
    if (wantChat) {
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("id, sender_role, message, created_at, sender_id")
        .eq("delivery_id", (d as any).id)
        .in("sender_role", ["customer", "driver"])
        .order("created_at", { ascending: true })
        .limit(200);
      const customerId = (d as any).id;
      const shaped = (msgs || []).map((m: any) => ({
        id: m.id,
        role: m.sender_role,
        mine: m.sender_role === "customer" && m.sender_id === customerId,
        message: m.message,
        created_at: m.created_at,
      }));
      return new Response(JSON.stringify({ messages: shaped }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let driver: any = null;
    let location: any = null;

    if (d.driver_id) {
      const [{ data: dp }, { data: loc }] = await Promise.all([
        supabase.from("driver_profiles")
          .select("id, rating, vehicle_type, profiles(full_name, phone)")
          .eq("id", d.driver_id).maybeSingle(),
        supabase.from("driver_locations")
          .select("lat, lng, heading, updated_at")
          .eq("driver_id", d.driver_id).maybeSingle(),
      ]);
      if (dp) {
        const p: any = (dp as any).profiles;
        driver = {
          id: (dp as any).id,
          rating: (dp as any).rating,
          vehicle_type: (dp as any).vehicle_type,
          full_name: p?.full_name ?? null,
          phone: p?.phone ?? null,
        };
      }
      if (loc) location = loc;
    }

    return new Response(JSON.stringify({ delivery: d, driver, location, rating: existingRating || null }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});