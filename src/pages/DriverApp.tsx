import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Package, History, Power, LogOut, Bike, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import DeliveryHistory from "@/components/driver/DeliveryHistory";
import NearbyOrdersMap from "@/components/driver/NearbyOrdersMap";
import ActiveDeliveryView from "@/components/driver/ActiveDeliveryView";
import NewOrderAlert from "@/components/driver/NewOrderAlert";

interface DeliveryOrder {
  id: string;
  order_id: string;
  customer_name: string;
  customer_phone: string | null;
  pickup_address: string;
  delivery_address: string;
  amount: number;
  commission: number;
  estimated_time: number | null;
  status: string;
  zone: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

const DriverApp = () => {
  const { user, signOut } = useAuth();
  const [pendingOrders, setPendingOrders]     = useState<DeliveryOrder[]>([]);
  const [activeDelivery, setActiveDelivery]   = useState<DeliveryOrder | null>(null);
  const [activeTab, setActiveTab]             = useState<"orders" | "history">("orders");
  const [viewMode, setViewMode]               = useState<"feed" | "map">("map");
  const [isAvailable, setIsAvailable]         = useState(false);
  const [toggling, setToggling]               = useState(false);
  const [driverProfile, setDriverProfile]     = useState<any>(null);
  const [earningsToday, setEarningsToday]     = useState(0);
  const [alertOrder, setAlertOrder]           = useState<any>(null);

  const { isTracking, currentLocation, startTracking, stopTracking } = useDriverLocation();
  const prevCount   = useRef(0);
  const gpsStarted  = useRef(false);

  // ── Prevenir scroll en body (app mobile) ─────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // ── GPS auto-start ────────────────────────────────────────────────────────
  useEffect(() => {
    if (user && !gpsStarted.current && !isTracking) {
      gpsStarted.current = true;
      startTracking();
    }
  }, [user, isTracking, startTracking]);

  // ── Cargar perfil y ganancias del día ────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase.from("driver_profiles").select("*").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setDriverProfile(data);
          setIsAvailable(data.status === "activo" || data.status === "en_ruta");
        }
      });

    const today = new Date().toISOString().split("T")[0];
    supabase.from("deliveries")
      .select("commission")
      .eq("driver_id", user.id)
      .eq("status", "entregado")
      .gte("updated_at", today)
      .then(({ data }) => {
        const total = (data || []).reduce((s, d: any) => s + Number(d.commission || 0), 0);
        setEarningsToday(total);
      });
  }, [user]);

  // ── Fetch pedidos pendientes y entrega activa ─────────────────────────────
  const fetchData = useCallback(async () => {
    if (!user) return;

    // Entrega activa propia
    const { data: active } = await supabase
      .from("deliveries")
      .select("*")
      .eq("driver_id", user.id)
      .in("status", ["aceptado", "en_camino"])
      .maybeSingle();
    setActiveDelivery(active as any);

    // Pedidos disponibles (vista segura)
    if (isAvailable) {
      const { data: pending } = await supabase
        .from("pending_delivery_offers" as any)
        .select("*");
      const orders: DeliveryOrder[] = (pending || []).map((d: any) => ({
        id: d.id,
        order_id: d.order_id,
        customer_name: "Cliente",
        customer_phone: null,
        pickup_address: d.pickup_address,
        delivery_address: d.delivery_address,
        amount: Number(d.amount || 0),
        commission: Number(d.commission || 0),
        estimated_time: d.estimated_time,
        status: d.status,
        zone: d.zone,
        pickup_lat: d.pickup_lat ?? null,
        pickup_lng: d.pickup_lng ?? null,
        delivery_lat: d.delivery_lat ?? null,
        delivery_lng: d.delivery_lng ?? null,
      }));

      if (orders.length > prevCount.current) {
        try { new Audio("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3").play(); } catch (_) {}
      }
      prevCount.current = orders.length;
      setPendingOrders(orders);
    } else {
      setPendingOrders([]);
    }
  }, [user, isAvailable]);

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchData();

    const ch1 = supabase.channel("driver-db")
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, fetchData)
      .subscribe();

    const ch2 = supabase.channel("dispatch-notifications")
      .on("broadcast", { event: "new-order" }, (msg) => {
        fetchData();
        if (msg.payload && isAvailable) setAlertOrder(msg.payload);
      })
      .subscribe();

    const interval = setInterval(fetchData, 15000);

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
      clearInterval(interval);
    };
  }, [fetchData, isAvailable]);

  // ── Toggle disponibilidad ─────────────────────────────────────────────────
  const toggleAvailability = async () => {
    if (!user || toggling) return;
    setToggling(true);
    const newStatus = isAvailable ? "inactivo" : "activo";
    const { error } = await supabase.from("driver_profiles")
      .update({ status: newStatus as any, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) { toast.error("Error al cambiar disponibilidad"); setToggling(false); return; }
    setIsAvailable(!isAvailable);
    if (isAvailable) stopTracking(); else startTracking();
    toast.success(isAvailable ? "Desconectado" : "¡Estás en línea!");
    setToggling(false);
  };

  // ── Aceptar pedido (vía RPC claim_delivery — respeta RLS) ─────────────────
  const acceptOrder = async (order: DeliveryOrder) => {
    if (!user) return;
    const { data, error } = await supabase.rpc("claim_delivery", { p_delivery_id: order.id });
    if (error || !data?.ok) {
      toast.error(data?.error || "Otro mensajero fue más rápido");
      fetchData();
      return;
    }
    toast.success("¡Pedido tomado! Ve al punto de recogida 🛵");
    await supabase.from("delivery_audit_log" as any).insert({
      delivery_id: order.id,
      event: "Pedido aceptado",
      details: "Aceptado por mensajero",
      performed_by: user.id,
    });
    setAlertOrder(null);
    fetchData();
  };

  // ── Aceptar desde alerta push ─────────────────────────────────────────────
  const acceptFromAlert = async () => {
    if (!alertOrder) return;
    const found = pendingOrders.find(o => o.id === alertOrder.id || o.order_id === alertOrder.order_id);
    if (found) await acceptOrder(found);
    else if (alertOrder.id) {
      const { data, error } = await supabase.rpc("claim_delivery", { p_delivery_id: alertOrder.id });
      if (error || !data?.ok) toast.error(data?.error || "El pedido ya fue tomado");
      else { toast.success("¡Pedido tomado!"); fetchData(); }
    }
    setAlertOrder(null);
  };

  // ── Actualizar estado de entrega ──────────────────────────────────────────
  const updateStatus = async (s: string) => {
    if (!activeDelivery || !user) return;
    const updates: any = { status: s, updated_at: new Date().toISOString() };
    if (s === "en_camino")  updates.picked_up_at   = new Date().toISOString();
    if (s === "entregado")  updates.delivered_at   = new Date().toISOString();
    const { error } = await supabase.from("deliveries").update(updates).eq("id", activeDelivery.id);
    if (error) { toast.error("Error actualizando estado"); return; }
    if (s === "entregado") {
      setActiveDelivery(null);
      setEarningsToday(e => e + Number(activeDelivery.commission));
      toast.success("¡Entrega completada! 🎉");
    } else {
      toast.success("Estado actualizado");
      fetchData();
    }
    await supabase.from("delivery_audit_log" as any).insert({
      delivery_id: activeDelivery.id,
      event: s === "en_camino" ? "En camino" : "Entregado",
      details: `Estado: ${s}`, performed_by: user.id,
    });
  };

  const name     = user?.user_metadata?.full_name || "Mensajero";
  const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  // ── Pantalla de entrega activa ────────────────────────────────────────────
  if (activeDelivery) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col">
        <header className="bg-slate-900/90 backdrop-blur-xl border-b border-white/5 px-4 py-2 flex items-center justify-between z-50">
          <div className="flex items-center gap-2">
            <Bike className="h-5 w-5 text-indigo-400" />
            <span className="text-sm font-bold text-white">Servicio activo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${isTracking ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
            <span className="text-[10px] text-white/40">{isTracking ? "GPS activo" : "Sin GPS"}</span>
          </div>
        </header>
        <div className="flex-1 overflow-hidden">
          <ActiveDeliveryView
            delivery={activeDelivery as any}
            onPickedUp={() => updateStatus("en_camino")}
            onDelivered={() => updateStatus("entregado")}
          />
        </div>
      </div>
    );
  }

  // ── Pantalla principal ────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col overflow-hidden">

      {/* ── HEADER ── */}
      <header className="bg-slate-900/60 backdrop-blur-2xl border-b border-white/5 px-5 pt-5 pb-4 space-y-4 z-40">

        {/* Fila: avatar + nombre + earnings + logout */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-black text-white text-sm shadow-xl shadow-indigo-500/20">
                {initials}
              </div>
              {isAvailable && <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />}
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">{name}</p>
              <p className="text-[10px] text-white/40">{isAvailable ? "En línea" : "Desconectado"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[9px] text-white/30 uppercase tracking-widest">Hoy</p>
              <p className="text-sm font-black text-emerald-400">{fmt(earningsToday)}</p>
            </div>
            <button onClick={signOut} className="h-9 w-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
              <LogOut className="h-4 w-4 text-white/50" />
            </button>
          </div>
        </div>

        {/* Toggle disponibilidad */}
        <div
          onClick={toggleAvailability}
          className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all active:scale-[0.98] ${
            isAvailable ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white/5 border-white/5"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${isAvailable ? "bg-emerald-500/20" : "bg-white/5"}`}>
              <Power className={`h-4 w-4 ${isAvailable ? "text-emerald-400" : "text-white/30"}`} />
            </div>
            <div>
              <p className={`text-sm font-bold ${isAvailable ? "text-emerald-400" : "text-white/60"}`}>
                {isAvailable ? "Estás en línea" : "Estás desconectado"}
              </p>
              <p className="text-[10px] text-white/30">
                {isAvailable ? "Recibiendo pedidos · GPS activo" : "Toca para conectarte"}
              </p>
            </div>
          </div>
          <Switch
            checked={isAvailable}
            disabled={toggling}
            className="data-[state=checked]:bg-emerald-500 pointer-events-none"
          />
        </div>

        {/* Stats */}
        {driverProfile && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Entregas", value: driverProfile.total_deliveries ?? 0, color: "text-white" },
              { label: "Rating",   value: `⭐ ${driverProfile.rating ?? "—"}`, color: "text-amber-400" },
              { label: "Aceptación", value: `${driverProfile.acceptance_rate ?? 0}%`, color: "text-indigo-400" },
            ].map(s => (
              <div key={s.label} className="bg-white/5 rounded-2xl p-2.5 text-center border border-white/5">
                <p className={`text-lg font-black leading-none ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-white/30 uppercase tracking-wider mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Feed / Mapa switcher */}
        {activeTab === "orders" && (
          <div className="bg-white/5 p-1 rounded-2xl flex gap-1 border border-white/5">
            {[["feed", "Feed"], ["map", "Mapa"]].map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode as "feed" | "map")}
                className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  viewMode === mode ? "bg-indigo-600 text-white shadow-lg" : "text-white/30 hover:text-white/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* ── CONTENIDO ── */}
      <main className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === "orders" ? (
            <motion.div key={viewMode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full w-full">

              {/* MAPA */}
              {viewMode === "map" && (
                <div className="h-full w-full">
                  <NearbyOrdersMap
                    orders={pendingOrders}
                    currentLocation={currentLocation}
                    onAcceptOrder={(id) => {
                      const o = pendingOrders.find(o => o.id === id);
                      if (o) acceptOrder(o);
                    }}
                  />
                </div>
              )}

              {/* FEED */}
              {viewMode === "feed" && (
                <div className="h-full overflow-y-auto px-5 pt-5 pb-32 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Servicios disponibles</p>
                    <span className="bg-indigo-600/20 text-indigo-400 text-[9px] font-black px-3 py-1 rounded-full border border-indigo-600/30">
                      {pendingOrders.length} disponibles
                    </span>
                  </div>

                  {!isAvailable ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <div className="h-20 w-20 bg-white/5 rounded-3xl flex items-center justify-center border border-white/5">
                        <Power className="h-10 w-10 text-white/10" />
                      </div>
                      <p className="text-xs font-black text-white/20 uppercase tracking-widest text-center">
                        Actívate para recibir pedidos
                      </p>
                    </div>
                  ) : pendingOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <div className="h-20 w-20 bg-white/5 rounded-3xl flex items-center justify-center border border-white/5">
                        <Package className="h-10 w-10 text-white/10" />
                      </div>
                      <p className="text-xs font-black text-white/20 uppercase tracking-widest text-center">
                        Buscando pedidos cercanos...
                      </p>
                    </div>
                  ) : (
                    pendingOrders.map(order => (
                      <motion.div
                        key={order.id}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="bg-slate-900 border border-white/5 rounded-3xl p-5 shadow-2xl"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
                              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Nueva solicitud</span>
                            </div>
                            <p className="text-xs text-white/40">#{order.order_id} · {order.zone || "Sin zona"}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] text-white/30 uppercase mb-1">Ganancia</p>
                            <p className="text-2xl font-black text-indigo-400">{fmt(order.commission)}</p>
                          </div>
                        </div>

                        <div className="flex gap-3 mb-5">
                          <div className="flex flex-col items-center pt-1">
                            <div className="h-3 w-3 bg-emerald-500 rounded-full" />
                            <div className="w-px flex-1 bg-gradient-to-b from-emerald-500 to-indigo-500 my-1 min-h-[20px]" />
                            <div className="h-3 w-3 bg-indigo-500 rounded-full" />
                          </div>
                          <div className="flex-1 space-y-4">
                            <div>
                              <p className="text-[8px] text-white/30 uppercase tracking-widest mb-0.5">Recoger en</p>
                              <p className="text-xs font-semibold text-white leading-tight">{order.pickup_address}</p>
                            </div>
                            <div>
                              <p className="text-[8px] text-white/30 uppercase tracking-widest mb-0.5">Entregar en</p>
                              <p className="text-xs font-semibold text-white leading-tight">{order.delivery_address}</p>
                            </div>
                          </div>
                        </div>

                        {order.estimated_time && (
                          <p className="text-[10px] text-white/30 mb-3">⏱ {order.estimated_time} min estimado</p>
                        )}

                        <button
                          onClick={() => acceptOrder(order)}
                          className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm shadow-xl shadow-indigo-600/30 active:scale-95 transition-all"
                        >
                          ACEPTAR PEDIDO
                        </button>
                      </motion.div>
                    ))
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full overflow-y-auto pt-4 pb-32">
              <DeliveryHistory />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── BOTTOM NAV ── */}
      <nav className="fixed bottom-0 inset-x-0 bg-slate-950/90 backdrop-blur-2xl border-t border-white/5 z-50"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <div className="flex items-center justify-between px-10 pt-3 pb-1">
          <button
            onClick={() => setActiveTab("orders")}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === "orders" ? "text-indigo-400 scale-110" : "text-white/25"}`}
          >
            <LayoutGrid className="h-6 w-6" />
            <span className="text-[9px] font-black uppercase tracking-widest">Panel</span>
          </button>

          {/* Botón central de disponibilidad */}
          <div
            onClick={toggleAvailability}
            className={`h-16 w-16 -mt-10 rounded-[30%] flex items-center justify-center shadow-2xl transition-all active:scale-90 cursor-pointer border-4 border-slate-950 ${
              isAvailable ? "bg-indigo-600 shadow-indigo-600/40" : "bg-slate-800"
            }`}
          >
            <Bike className="h-8 w-8 text-white" />
          </div>

          <button
            onClick={() => setActiveTab("history")}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === "history" ? "text-indigo-400 scale-110" : "text-white/25"}`}
          >
            <History className="h-6 w-6" />
            <span className="text-[9px] font-black uppercase tracking-widest">Viajes</span>
          </button>
        </div>
      </nav>

      {/* ── ALERTA DE NUEVO PEDIDO ── */}
      <NewOrderAlert
        order={alertOrder}
        onAccept={acceptFromAlert}
        onDismiss={() => setAlertOrder(null)}
      />
    </div>
  );
};

export default DriverApp;
