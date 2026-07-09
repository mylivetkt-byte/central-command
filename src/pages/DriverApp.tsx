import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Package, History, Power, LogOut, Bike, Home, User, Map as MapIcon, Receipt, Battery, BatteryCharging, Flame, Trophy, Zap, AlertTriangle, AlertCircle, Coins, Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import { useOffline } from "@/hooks/useOffline";
import { useDriverPush } from "@/hooks/useDriverPush";
import DeliveryHistory from "@/components/driver/DeliveryHistory";
import NearbyOrdersMap from "@/components/driver/NearbyOrdersMap";
import ActiveDeliveryView from "@/components/driver/ActiveDeliveryView";
import NewOrderAlert from "@/components/driver/NewOrderAlert";
import { VersionBadge } from "@/components/driver/VersionBadge";

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
  notes?: string | null;
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
  const [activeTab, setActiveTab]             = useState<"inicio" | "pedidos" | "mapa" | "historial" | "cuenta">("inicio");
  const [isAvailable, setIsAvailable]         = useState(false);
  const [toggling, setToggling]               = useState(false);
  const [driverProfile, setDriverProfile]     = useState<any>(null);
  const [earningsToday, setEarningsToday]     = useState(0);
  const [earningsWeek, setEarningsWeek]       = useState(0);
  const [deliveriesToday, setDeliveriesToday] = useState(0);
  const [deliveryStreak, setDeliveryStreak]   = useState(0);
  const [alertOrder, setAlertOrder]           = useState<any>(null);
  const shownAlertIds                          = useRef<Set<string>>(new Set());
  const [selectedActiveIdx, setSelectedActiveIdx] = useState(0);

  useEffect(() => {
    if (selectedActiveIdx >= activeDeliveries.length) {
      setSelectedActiveIdx(0);
    }
  }, [activeDeliveries.length, selectedActiveIdx]);

  const { isTracking, currentLocation, startTracking, stopTracking, batterySaver, setBatterySaver } = useDriverLocation();
  const { isOffline, queueSize, enqueue, registerHandler, flushQueue } = useOffline();
  const push = useDriverPush(user?.id);
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

    const localToday = new Date();
    localToday.setHours(0, 0, 0, 0);
    const todayStr = localToday.toISOString();

    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0,0,0,0);
    const weekStartStr = weekStart.toISOString();

    supabase.from("deliveries")
      .select("commission, delivered_at, created_at")
      .eq("driver_id", user.id)
      .eq("status", "entregado")
      .gte("updated_at", todayStr)
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
        notes: d.notes,
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

  const fetchDataRef = useRef(fetchData);
  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  useEffect(() => {
    if (!user) return;

    // Carga inicial
    fetchDataRef.current();

    const ch1 = supabase.channel("driver-db")
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, () => {
        fetchDataRef.current();
      })
      .subscribe();

    const ch2 = supabase.channel("dispatch-notifications")
      .on("broadcast", { event: "new-order" }, (payload: any) => {
        const targetedDriverId = payload.payload?.driverId;
        // Si el pedido va dirigido a un mensajero específico, solo él lo procesa
        if (targetedDriverId && targetedDriverId !== user.id) return;

        const repId = payload.payload?.republished_delivery_id;
        if (repId) {
          shownAlertIds.current.delete(repId);
        }
        fetchDataRef.current();
      })
      .subscribe();

    const interval = setInterval(() => {
      fetchDataRef.current();
    }, 10000);

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
      clearInterval(interval);
    };
  }, [user?.id]);

  // Handler que ejecuta acciones encoladas cuando volvemos a estar online
  useEffect(() => {
    registerHandler(async (action) => {
      if (!user) throw new Error("no user");
      if (action.type === "accept") {
        const { data: claimed, error } = await supabase
          .from("deliveries")
          .update({
            driver_id: user.id,
            status: "aceptado",
            accepted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", action.payload.deliveryId)
          .eq("status", "pendiente")
          .is("driver_id", null)
          .select()
          .maybeSingle();
        if (error || !claimed) throw error || new Error("ya tomado");
      } else if (action.type === "reject") {
        await supabase.from("delivery_audit_log" as any).insert({
          delivery_id: action.payload.deliveryId,
          event: "Oferta rechazada",
          details: action.payload.reason ? `Motivo: ${action.payload.reason}` : "Rechazada (offline)",
          performed_by: user.id,
        });
      } else if (action.type === "status") {
        const updates: any = { status: action.payload.status, updated_at: new Date().toISOString() };
        if (action.payload.status === "en_camino") updates.picked_up_at = new Date(action.payload.ts).toISOString();
        if (action.payload.status === "entregado") updates.delivered_at = new Date(action.payload.ts).toISOString();
        const { error } = await supabase.from("deliveries").update(updates).eq("id", action.payload.deliveryId);
        if (error) throw error;
        await supabase.from("delivery_audit_log" as any).insert({
          delivery_id: action.payload.deliveryId,
          event: action.payload.status === "en_camino" ? "En camino" : "Entregado",
          details: `Estado: ${action.payload.status} (sync offline)`,
          performed_by: user.id,
        });
      }
    });
    // Intentar drenar al montar por si quedó algo pendiente de sesión previa
    if (navigator.onLine) flushQueue();
  }, [user, registerHandler, flushQueue]);

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
    if (isOffline) {
      enqueue("accept", { deliveryId: order.id });
      toast.success("Aceptación guardada. Se enviará al reconectar 📶");
      setAlertOrder(null);
      return;
    }
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
    if (isOffline) {
      enqueue("reject", { deliveryId: alertOrder.id, reason });
      toast("Rechazo guardado offline");
      setAlertOrder(null);
      return;
    }
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
    if (isOffline) {
      enqueue("status", { deliveryId: delivery.id, status: s, ts: Date.now() });
      // Actualización optimista local
      setActiveDeliveries(prev => prev.map(d => d.id === delivery.id ? { ...d, status: s } : d));
      toast.success(`Estado "${s}" guardado offline`);
      return;
    }
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
    const selectedDelivery = activeDeliveries[selectedActiveIdx] || activeDeliveries[0];
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col">
        <header className="bg-slate-900/90 backdrop-blur-xl border-b border-white/5 px-4 py-2 flex items-center justify-between z-50">
          <div className="flex items-center gap-2">
            <Bike className="h-5 w-5 text-indigo-400" />
            <span className="text-sm font-bold text-white">Servicio activo</span>
            {activeDeliveries.length > 1 && (
              <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded-full">
                {activeDeliveries.length} pedidos
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${isTracking ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
            <span className="text-[10px] text-white/40">{isTracking ? "GPS activo" : "Sin GPS"}</span>
          </div>
        </header>

        {/* Selector de Pedido Activo 1 y 2 */}
        {activeDeliveries.length > 1 && (
          <div className="bg-slate-900 border-b border-white/5 p-2 flex gap-2 z-40">
            {activeDeliveries.map((deliv, idx) => (
              <button
                key={deliv.id}
                onClick={() => setSelectedActiveIdx(idx)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  selectedActiveIdx === idx
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                    : "bg-white/5 text-white/40 hover:text-white/60"
                }`}
              >
                Pedido {idx + 1} ({deliv.order_id.slice(-4).toUpperCase()})
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          <ActiveDeliveryView
            delivery={selectedDelivery as any}
            onPickedUp={(id) => updateStatus(id, "en_camino")}
            onDelivered={(id) => updateStatus(id, "entregado")}
            allDeliveries={activeDeliveries as any}
          />
        </div>

        {/* Alerta de segundo pedido mientras está en servicio activo */}
        <NewOrderAlert
          order={alertOrder}
          timeoutSeconds={30}
          onAccept={acceptFromAlert}
          onReject={rejectFromAlert}
        />
      </div>
    );
  }

  const goalDeliveriesPct = Math.min(100, (deliveriesToday / DAILY_GOAL_DELIVERIES) * 100);
  const goalEarningsPct = Math.min(100, (earningsWeek / WEEKLY_GOAL_EARNINGS) * 100);
  const hasStreakBonus = deliveryStreak > 0 && deliveryStreak % STREAK_BONUS_THRESHOLD === 0;

  return (
    <div className="fixed inset-0 bg-[#f5f6f7] flex flex-col overflow-hidden">

      {/* Banner de conexión offline / cola pendiente */}
      {(isOffline || queueSize > 0) && (
        <div
          className={`px-4 py-1.5 text-[11px] font-bold text-center text-white ${
            isOffline ? "bg-red-600" : "bg-amber-500"
          }`}
        >
          {isOffline
            ? `Sin conexión${queueSize > 0 ? ` · ${queueSize} pendientes` : ""} — Se sincronizará al reconectar`
            : `Sincronizando ${queueSize} acción${queueSize === 1 ? "" : "es"} pendiente${queueSize === 1 ? "" : "s"}…`}
        </div>
      )}

      {/* ── HEADER CARD (siempre visible salvo en Mapa fullscreen) ── */}
      {activeTab !== "mapa" && (
        <header className="px-4 pt-5 pb-3">
          <div className={`flex items-center justify-between rounded-3xl bg-white px-4 py-3 border-2 ${isAvailable ? "border-green-500 shadow-[0_0_0_4px_rgba(34,197,94,0.08)]" : "border-slate-200"}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className={`h-11 w-11 rounded-full flex items-center justify-center font-black text-white text-sm ${isAvailable ? "bg-slate-700 ring-2 ring-green-500 ring-offset-2 ring-offset-white" : "bg-slate-400"}`}>
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-base font-black text-slate-900 leading-tight truncate">{name}</p>
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${isAvailable ? "bg-green-500" : "bg-slate-300"}`} />
                  {isAvailable ? "Conectado" : "Desconectado"}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-slate-900 leading-tight">{fmt(earningsToday)}</p>
              <p className="text-[11px] text-slate-500 flex items-center gap-1 justify-end">
                <Coins className="h-3 w-3" /> Hoy
              </p>
            </div>
          </div>

          {/* Banners de Estado */}
          {driverProfile?.status === "pendiente" && (
            <div className="mt-3 flex items-center gap-2.5 rounded-2xl bg-yellow-50 border border-yellow-200 p-3 text-yellow-700">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <div>
                <p className="text-xs font-bold">Cuenta pendiente de aprobación</p>
                <p className="text-[10px]">La empresa debe autorizar tu cuenta.</p>
              </div>
            </div>
          )}
          {driverProfile?.status === "suspendido" && (
            <div className="mt-3 flex items-center gap-2.5 rounded-2xl bg-red-50 border border-red-200 p-3 text-red-700">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <p className="text-xs font-bold">Cuenta suspendida</p>
                <p className="text-[10px]">Comunícate con tu empresa.</p>
              </div>
            </div>
          )}

          {showInstallBanner && driverProfile?.status === "activo" && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-green-50 border border-green-200 p-3">
              <div className="flex items-start gap-2.5">
                <Bike className="h-5 w-5 shrink-0 mt-0.5 text-green-600 animate-bounce" />
                <div>
                  <p className="text-xs font-bold text-slate-800">Instala la App</p>
                  <p className="text-[10px] text-slate-500">Acceso directo y notificaciones más rápidas.</p>
                </div>
              </div>
              <button
                onClick={() => { if (isIOS) setShowIOSPrompt(true); else handleInstallPWA(); }}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-black text-white hover:bg-green-700 transition-colors shrink-0"
              >Instalar</button>
            </div>
          )}
        </header>
      )}

      {/* ── CONTENIDO ── */}
      <main className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">

          {activeTab === "inicio" && (
            <motion.div key="inicio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full w-full flex flex-col items-center justify-center pb-32 px-6">
              <button
                onClick={toggleAvailability}
                disabled={toggling || driverProfile?.status === "pendiente" || driverProfile?.status === "suspendido"}
                className={`relative h-56 w-56 rounded-full bg-white flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 ${
                  isAvailable
                    ? "border-[10px] border-green-500 shadow-[0_0_60px_rgba(34,197,94,0.55)]"
                    : "border-[10px] border-slate-300 shadow-[0_0_30px_rgba(0,0,0,0.08)]"
                }`}
              >
                <Power className={`h-24 w-24 ${isAvailable ? "text-green-500" : "text-slate-400"}`} strokeWidth={2.5} />
              </button>
              <p className="mt-8 text-lg text-slate-600 font-medium">
                {isAvailable ? "Toca para desconectarte" : "Toca para conectarte"}
              </p>
            </motion.div>
          )}

          {activeTab === "pedidos" && (
            <motion.div key="pedidos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full overflow-y-auto px-4 pt-2 pb-32 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Servicios disponibles</p>
                <span className="bg-green-100 text-green-700 text-[10px] font-black px-3 py-1 rounded-full">
                  {pendingOrders.length} disponibles
                </span>
              </div>
              {!isAvailable ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="h-20 w-20 bg-white rounded-3xl flex items-center justify-center border border-slate-200">
                    <Power className="h-10 w-10 text-slate-300" />
                  </div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Actívate para recibir pedidos</p>
                </div>
              ) : pendingOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="h-20 w-20 bg-white rounded-3xl flex items-center justify-center border border-slate-200">
                    <Package className="h-10 w-10 text-slate-300" />
                  </div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Buscando pedidos cercanos...</p>
                </div>
              ) : (
                pendingOrders.map(order => (
                  <motion.div key={order.id} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                          <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">Nueva solicitud</span>
                        </div>
                        <p className="text-xs text-slate-500">#{order.order_id} · {order.zone || "Sin zona"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-slate-400 uppercase mb-1">Ganancia</p>
                        <p className="text-2xl font-black text-green-600">{fmt(order.commission)}</p>
                      </div>
                    </div>
                    <div className="flex gap-3 mb-4">
                      <div className="flex flex-col items-center pt-1">
                        <div className="h-3 w-3 bg-green-500 rounded-full" />
                        <div className="w-px flex-1 bg-slate-200 my-1 min-h-[20px]" />
                        <div className="h-3 w-3 bg-slate-700 rounded-full" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <p className="text-[8px] text-slate-400 uppercase tracking-widest mb-0.5">Recoger en</p>
                          <p className="text-xs font-semibold text-slate-800 leading-tight">{order.pickup_address}</p>
                        </div>
                        <div>
                          <p className="text-[8px] text-slate-400 uppercase tracking-widest mb-0.5">Entregar en</p>
                          <p className="text-xs font-semibold text-slate-800 leading-tight">{order.delivery_address}</p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => acceptOrder(order)}
                      className="w-full h-12 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-black text-sm shadow-lg shadow-green-600/20 active:scale-95 transition-all"
                    >ACEPTAR PEDIDO</button>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === "mapa" && (
            <motion.div key="mapa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full w-full pb-24">
              <NearbyOrdersMap
                orders={pendingOrders}
                currentLocation={currentLocation}
                onAcceptOrder={(id) => {
                  const o = pendingOrders.find(o => o.id === id);
                  if (o) acceptOrder(o);
                }}
              />
            </motion.div>
          )}

          {activeTab === "historial" && (
            <motion.div key="historial" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full overflow-y-auto pb-32">
              <DeliveryHistory />
            </motion.div>
          )}

          {activeTab === "cuenta" && (
            <motion.div key="cuenta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full overflow-y-auto px-4 pb-32 space-y-4">
              {driverProfile && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Entregas", value: driverProfile.total_deliveries ?? 0, color: "text-slate-800" },
                      { label: "Rating",   value: `⭐ ${driverProfile.rating ?? "—"}`, color: "text-amber-500" },
                      { label: "Aceptación", value: `${driverProfile.acceptance_rate ?? 0}%`, color: "text-green-600" },
                    ].map(s => (
                      <div key={s.label} className="bg-white rounded-2xl p-3 text-center border border-slate-200">
                        <p className={`text-lg font-black leading-none ${s.color}`}>{s.value}</p>
                        <p className="text-[9px] text-slate-500 uppercase tracking-wider mt-1">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Trophy className="h-3 w-3 text-amber-500" /> Meta diaria</span>
                        <span className="text-[11px] font-bold text-slate-700">{deliveriesToday}/{DAILY_GOAL_DELIVERIES}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${goalDeliveriesPct}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Zap className="h-3 w-3 text-green-600" /> Meta semanal</span>
                        <span className="text-[11px] font-bold text-slate-700">{fmt(earningsWeek)}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${goalEarningsPct}%` }} />
                      </div>
                    </div>
                    {deliveryStreak > 0 && (
                      <div className="flex items-center gap-2 bg-orange-50 rounded-xl px-3 py-2 border border-orange-100">
                        <Flame className={`h-4 w-4 ${hasStreakBonus ? 'text-orange-500' : 'text-slate-400'}`} />
                        <span className="text-xs font-bold text-slate-700">{deliveryStreak} entregas consecutivas</span>
                        {hasStreakBonus && <span className="text-[9px] font-black text-orange-500 uppercase tracking-wider ml-auto">🔥 BONO</span>}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setBatterySaver(!batterySaver)}
                    className="w-full flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4"
                  >
                    <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      {batterySaver ? <BatteryCharging className="h-4 w-4 text-green-600" /> : <Battery className="h-4 w-4 text-slate-400" />}
                      Modo ahorro
                    </span>
                    <span className={`text-xs font-black px-3 py-1 rounded-full ${batterySaver ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {batterySaver ? "ACTIVO" : "OFF"}
                    </span>
                  </button>

                  <button
                    onClick={signOut}
                    className="w-full flex items-center justify-center gap-2 bg-white rounded-2xl border border-red-200 p-4 text-red-600 font-bold text-sm active:scale-95 transition-all"
                  >
                    <LogOut className="h-4 w-4" /> Cerrar sesión
                  </button>

                  {/* Versión de la app */}
                  <VersionBadge />
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── BOTTOM NAV ── */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-50"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
        <div className="grid grid-cols-5 items-end px-2 pt-2">
          {[
            { key: "inicio", label: "Inicio", Icon: Home },
            { key: "pedidos", label: "Pedidos", Icon: Receipt },
          ].map(({ key, label, Icon }) => {
            const on = activeTab === key;
            return (
              <button key={key} onClick={() => setActiveTab(key as any)} className="flex flex-col items-center gap-1 pt-2 pb-1 relative">
                {on && <span className="absolute top-0 h-0.5 w-8 bg-green-500 rounded-full" />}
                <Icon className={`h-6 w-6 ${on ? "text-green-600" : "text-slate-400"}`} />
                <span className={`text-[11px] font-semibold ${on ? "text-green-600" : "text-slate-500"}`}>{label}</span>
              </button>
            );
          })}
          {/* Center raised Mapa button */}
          <button
            onClick={() => setActiveTab("mapa")}
            className="flex flex-col items-center gap-1"
          >
            <div className={`-mt-6 h-16 w-16 rounded-3xl flex items-center justify-center shadow-lg transition-all active:scale-95 border-4 border-white ${activeTab === "mapa" ? "bg-green-600 shadow-green-600/30" : "bg-green-500 shadow-green-500/30"}`}>
              <Bike className="h-8 w-8 text-white" />
            </div>
            <span className={`text-[11px] font-semibold ${activeTab === "mapa" ? "text-green-600" : "text-slate-500"}`}>Mapa</span>
          </button>
          {[
            { key: "historial", label: "Historial", Icon: History },
            { key: "cuenta", label: "Cuenta", Icon: User },
          ].map(({ key, label, Icon }) => {
            const on = activeTab === key;
            return (
              <button key={key} onClick={() => setActiveTab(key as any)} className="flex flex-col items-center gap-1 pt-2 pb-1 relative">
                {on && <span className="absolute top-0 h-0.5 w-8 bg-green-500 rounded-full" />}
                <Icon className={`h-6 w-6 ${on ? "text-green-600" : "text-slate-400"}`} />
                <span className={`text-[11px] font-semibold ${on ? "text-green-600" : "text-slate-500"}`}>{label}</span>
              </button>
            );
          })}
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
