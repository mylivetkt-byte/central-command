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
    const orderId = url.searchParams.get("order_id");
    if (!orderId || orderId.length > 64) {
      return new Response(JSON.stringify({ error: "order_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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

    return new Response(JSON.stringify({ delivery: d, driver, location }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});