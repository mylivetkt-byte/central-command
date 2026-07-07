import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Package, History, Power, LogOut, Bike, LayoutGrid, Battery, BatteryCharging, Flame, Trophy, Zap, AlertTriangle, AlertCircle } from "lucide-react";
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

const DAILY_GOAL_DELIVERIES = 10;
const WEEKLY_GOAL_EARNINGS = 500000;
const STREAK_BONUS_THRESHOLD = 5;

const DriverApp = () => {
  const { user, signOut } = useAuth();
  const [pendingOrders, setPendingOrders]     = useState<DeliveryOrder[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState<DeliveryOrder[]>([]);
  const [activeTab, setActiveTab]             = useState<"orders" | "history">("orders");
  const [viewMode, setViewMode]               = useState<"feed" | "map">("map");
  const [isAvailable, setIsAvailable]         = useState(false);
  const [toggling, setToggling]               = useState(false);
  const [driverProfile, setDriverProfile]     = useState<any>(null);
  const [earningsToday, setEarningsToday]     = useState(0);
  const [earningsWeek, setEarningsWeek]       = useState(0);
  const [deliveriesToday, setDeliveriesToday] = useState(0);
  const [deliveryStreak, setDeliveryStreak]   = useState(0);
  const [alertOrder, setAlertOrder]           = useState<any>(null);
  const shownAlertIds                          = useRef<Set<string>>(new Set());

  const { isTracking, currentLocation, startTracking, stopTracking, batterySaver, setBatterySaver } = useDriverLocation();
  const prevCount   = useRef(0);
  const gpsStarted  = useRef(false);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      if (!isStandalone) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isIOSDevice && !isStandalone) {
      setShowInstallBanner(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowInstallBanner(false);
      setDeferredPrompt(null);
    }
  };

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Mantener la pantalla encendida mientras la app está en uso
  useEffect(() => {
    let wl: any = null;
    const acquire = async () => {
      try {
        if ("wakeLock" in navigator) {
          wl = await (navigator as any).wakeLock.request("screen");
        }
      } catch {}
    };
    acquire();
    const onVis = () => { if (document.visibilityState === "visible") acquire(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      try { wl?.release?.(); } catch {}
    };
  }, []);

  useEffect(() => {
    if (user && !gpsStarted.current && !isTracking) {
      gpsStarted.current = true;
      startTracking();
    }
  }, [user, isTracking, startTracking]);

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
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0,0,0,0);
    const weekStartStr = weekStart.toISOString();

    supabase.from("deliveries")
      .select("commission, delivered_at, created_at")
      .eq("driver_id", user.id)
      .eq("status", "entregado")
      .gte("updated_at", today)
      .then(({ data }) => {
        const total = (data || []).reduce((s, d: any) => s + Number(d.commission || 0), 0);
        setEarningsToday(total);
        setDeliveriesToday(data?.length || 0);
      });

    supabase.from("deliveries")
      .select("commission")
      .eq("driver_id", user.id)
      .eq("status", "entregado")
      .gte("updated_at", weekStartStr)
      .then(({ data }) => {
        const total = (data || []).reduce((s, d: any) => s + Number(d.commission || 0), 0);
        setEarningsWeek(total);
      });

    // Load streak from localStorage
    const savedStreak = localStorage.getItem(`streak-${user.id}`);
    if (savedStreak) setDeliveryStreak(Number(savedStreak));
  }, [user]);

  const fetchData = useCallback(async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from("driver_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (profile) {
      setDriverProfile(profile);
    }

    const { data: active } = await supabase
      .from("deliveries")
      .select("*")
      .eq("driver_id", user.id)
      .in("status", ["aceptado", "en_camino"])
      .order("created_at", { ascending: true });
    setActiveDeliveries((active || []) as any);

    const isCurrentlyAvailable = profile ? (profile.status === "activo" || profile.status === "en_ruta") : isAvailable;
    setIsAvailable(isCurrentlyAvailable);

    if (isCurrentlyAvailable) {
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

      if (isCurrentlyAvailable && (active || []).length < 2) {
        const fresh = orders.find(o => !shownAlertIds.current.has(o.id));
        if (fresh && !alertOrder) {
          shownAlertIds.current.add(fresh.id);
          setAlertOrder(fresh);
        }
      }
      prevCount.current = orders.length;
      setPendingOrders(orders);
    } else {
      setPendingOrders([]);
    }
  }, [user, isAvailable, activeDeliveries.length, alertOrder]);

  useEffect(() => {
    fetchData();

    const ch1 = supabase.channel("driver-db")
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, fetchData)
      .subscribe();

    const ch2 = supabase.channel("dispatch-notifications")
      .on("broadcast", { event: "new-order" }, () => {
        fetchData();
      })
      .subscribe();

    const interval = setInterval(fetchData, 15000);

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
      clearInterval(interval);
    };
  }, [fetchData, isAvailable]);

  const toggleAvailability = async () => {
    if (!user || toggling) return;
    if (driverProfile?.status === "pendiente") {
      toast.error("Tu cuenta está pendiente de aprobación por la empresa.");
      return;
    }
    if (driverProfile?.status === "suspendido") {
      toast.error("Tu cuenta está suspendida. Contacta con la empresa.");
      return;
    }
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

  const acceptOrder = async (order: DeliveryOrder) => {
    if (!user) return;
    const { data: claimed, error } = await supabase
      .from("deliveries")
      .update({
        driver_id: user.id,
        status: "aceptado",
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .eq("status", "pendiente")
      .is("driver_id", null)
      .select()
      .maybeSingle();
    if (error || !claimed) {
      toast.error("Otro mensajero fue más rápido");
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

  const acceptFromAlert = async () => {
    if (!alertOrder) return;
    const found = pendingOrders.find(o => o.id === alertOrder.id || o.order_id === alertOrder.order_id);
    if (found) await acceptOrder(found);
    else if (alertOrder.id) {
      const { data: claimed, error } = await supabase
        .from("deliveries")
        .update({
          driver_id: user.id,
          status: "aceptado",
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", alertOrder.id)
        .eq("status", "pendiente")
        .is("driver_id", null)
        .select()
        .maybeSingle();
      if (error || !claimed) toast.error("El pedido ya fue tomado");
      else { toast.success("¡Pedido tomado!"); fetchData(); }
    }
    setAlertOrder(null);
  };

  const rejectFromAlert = async (reason?: string) => {
    if (!alertOrder || !user) { setAlertOrder(null); return; }
    try {
      await supabase.from("delivery_audit_log" as any).insert({
        delivery_id: alertOrder.id,
        event: "Oferta rechazada",
        details: reason ? `Motivo: ${reason}` : "Rechazada por mensajero",
        performed_by: user.id,
      });
    } catch (_) {}
    setAlertOrder(null);
  };

  const updateStatus = async (deliveryId: string, s: string) => {
    if (!user) return;
    const delivery = activeDeliveries.find(d => d.id === deliveryId);
    if (!delivery) return;
    const updates: any = { status: s, updated_at: new Date().toISOString() };
    if (s === "en_camino")  updates.picked_up_at   = new Date().toISOString();
    if (s === "entregado")  updates.delivered_at   = new Date().toISOString();
    const { error } = await supabase.from("deliveries").update(updates).eq("id", delivery.id);
    if (error) { toast.error("Error actualizando estado"); return; }
    if (s === "entregado") {
      const streak = deliveryStreak + 1;
      setDeliveryStreak(streak);
      localStorage.setItem(`streak-${user.id}`, String(streak));
      setEarningsToday(e => e + Number(delivery.commission));
      toast.success(streak > 0 && streak % STREAK_BONUS_THRESHOLD === 0 ? `🔥 ¡${streak} entregas consecutivas! Bono activado` : "¡Entrega completada! 🎉");
    } else {
      toast.success("Estado actualizado");
    }
    fetchData();
    await supabase.from("delivery_audit_log" as any).insert({
      delivery_id: delivery.id,
      event: s === "en_camino" ? "En camino" : "Entregado",
      details: `Estado: ${s}`, performed_by: user.id,
    });
  };

  const name     = user?.user_metadata?.full_name || "Mensajero";
  const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  // Active delivery view (supports multi-stop)
  if (activeDeliveries.length > 0) {
    const primary = activeDeliveries[0];
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col">
        <header className="bg-slate-900/90 backdrop-blur-xl border-b border-white/5 px-4 py-2 flex items-center justify-between z-50">
          <div className="flex items-center gap-2">
            <Bike className="h-5 w-5 text-indigo-400" />
            <span className="text-sm font-bold text-white">Servicio activo</span>
            {activeDeliveries.length > 1 && (
              <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded-full">{activeDeliveries.length} pedidos</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${isTracking ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
            <span className="text-[10px] text-white/40">{isTracking ? "GPS activo" : "Sin GPS"}</span>
          </div>
        </header>
        <div className="flex-1 overflow-hidden">
          <ActiveDeliveryView
            delivery={primary as any}
            onPickedUp={(id) => updateStatus(id, "en_camino")}
            onDelivered={(id) => updateStatus(id, "entregado")}
            allDeliveries={activeDeliveries as any}
          />
        </div>
      </div>
    );
  }

  const goalDeliveriesPct = Math.min(100, (deliveriesToday / DAILY_GOAL_DELIVERIES) * 100);
  const goalEarningsPct = Math.min(100, (earningsWeek / WEEKLY_GOAL_EARNINGS) * 100);
  const hasStreakBonus = deliveryStreak > 0 && deliveryStreak % STREAK_BONUS_THRESHOLD === 0;

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col overflow-hidden">

      {/* ── HEADER ── */}
      <header className="bg-slate-900/60 backdrop-blur-2xl border-b border-white/5 px-5 pt-5 pb-4 space-y-4 z-40">

        {/* Fila superior */}
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
            <button
              onClick={() => setBatterySaver(!batterySaver)}
              className={`h-8 w-8 rounded-xl flex items-center justify-center transition-all ${batterySaver ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/30'}`}
              title={batterySaver ? "Modo ahorro activo" : "Modo ahorro desactivado"}
            >
              {batterySaver ? <BatteryCharging className="h-4 w-4" /> : <Battery className="h-4 w-4" />}
            </button>
            <div className="text-right">
              <p className="text-[9px] text-white/30 uppercase tracking-widest">Hoy</p>
              <p className="text-sm font-black text-emerald-400">{fmt(earningsToday)}</p>
            </div>
            <button onClick={signOut} className="h-9 w-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
              <LogOut className="h-4 w-4 text-white/50" />
            </button>
          </div>
        </div>

        {/* Banners de Estado */}
        {driverProfile?.status === "pendiente" && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 p-3.5 text-yellow-400">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <p className="text-xs font-bold">Cuenta pendiente de aprobación</p>
              <p className="text-[10px] text-yellow-500/80">La empresa de mensajería debe autorizar tu cuenta para recibir pedidos.</p>
            </div>
          </div>
        )}
        {driverProfile?.status === "suspendido" && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-red-500/10 border border-red-500/20 p-3.5 text-red-400">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              <p className="text-xs font-bold">Cuenta suspendida</p>
              <p className="text-[10px] text-red-500/80">Tu cuenta ha sido suspendida. Comunícate con tu empresa de mensajería.</p>
            </div>
          </div>
        )}

        {/* Banner de instalación PWA (para Android/iOS) */}
        {showInstallBanner && driverProfile?.status === "activo" && (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-3.5 text-indigo-400">
            <div className="flex items-start gap-2.5">
              <Bike className="h-5 w-5 shrink-0 mt-0.5 animate-bounce" />
              <div>
                <p className="text-xs font-bold text-white">Instala la App en tu Celular</p>
                <p className="text-[10px] text-white/60">Ten acceso directo y recibe notificaciones más rápido.</p>
              </div>
            </div>
            <button
              onClick={() => {
                if (isIOS) {
                  setShowIOSPrompt(true);
                } else {
                  handleInstallPWA();
                }
              }}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-black text-white hover:bg-indigo-500 transition-colors shrink-0"
            >
              Instalar
            </button>
          </div>
        )}

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

        {/* Stats + Goals */}
        {driverProfile && (
          <>
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

            {/* Goals */}
            <div className="space-y-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider flex items-center gap-1"><Trophy className="h-3 w-3 text-amber-400" /> Meta diaria</span>
                  <span className="text-[10px] font-bold text-white/70">{deliveriesToday}/{DAILY_GOAL_DELIVERIES}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500" style={{ width: `${goalDeliveriesPct}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider flex items-center gap-1"><Zap className="h-3 w-3 text-indigo-400" /> Meta semanal</span>
                  <span className="text-[10px] font-bold text-white/70">{fmt(earningsWeek)}/{fmt(WEEKLY_GOAL_EARNINGS)}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500" style={{ width: `${goalEarningsPct}%` }} />
                </div>
              </div>
              {/* Streak */}
              {deliveryStreak > 0 && (
                <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/5">
                  <Flame className={`h-4 w-4 ${hasStreakBonus ? 'text-orange-400' : 'text-white/40'}`} />
                  <span className="text-xs font-bold text-white/70">{deliveryStreak} entregas consecutivas</span>
                  {hasStreakBonus && <span className="text-[9px] font-black text-orange-400 uppercase tracking-wider ml-auto">🔥 BONO ACTIVO</span>}
                </div>
              )}
            </div>
          </>
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

      <NewOrderAlert
        order={alertOrder}
        timeoutSeconds={30}
        onAccept={acceptFromAlert}
        onReject={rejectFromAlert}
      />

      {/* Modal instruccional para instalar en iOS */}
      {showIOSPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-6 relative bg-slate-900 border border-white/10 text-center space-y-4 rounded-3xl shadow-2xl">
            <Bike className="h-10 w-10 text-indigo-400 mx-auto animate-pulse" />
            <h3 className="text-sm font-bold text-white">Instalar en tu iPhone / iPad</h3>
            <p className="text-xs text-white/60">Sigue estos sencillos pasos para añadir la app a tu pantalla de inicio:</p>
            <div className="text-left space-y-2.5 text-xs text-white/80 bg-white/5 p-4 rounded-2xl">
              <p>1. Pulsa el botón de <strong>Compartir</strong> (icono de cuadrado con flecha hacia arriba) en la barra de Safari.</p>
              <p>2. Busca y selecciona la opción <strong>"Añadir a la pantalla de inicio"</strong>.</p>
              <p>3. Pulsa <strong>Añadir</strong> en la esquina superior derecha.</p>
            </div>
            <button
              onClick={() => setShowIOSPrompt(false)}
              className="w-full rounded-xl bg-white/10 py-2.5 text-xs font-bold text-white hover:bg-white/15 transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverApp;
