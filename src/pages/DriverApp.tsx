import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import {
  Package, History, Power, LogOut, Star,
  CheckCircle, Clock, DollarSign, ChevronRight,
  MapPin, Bike, Navigation
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import OrderCard from "@/components/driver/OrderCard";
import ActiveDeliveryView from "@/components/driver/ActiveDeliveryView";
import DeliveryHistory from "@/components/driver/DeliveryHistory";

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

type Tab = "orders" | "history";

// ─── Formato moneda ───────────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", minimumFractionDigits: 0,
  }).format(v);

const DriverApp = () => {
  const { user, signOut } = useAuth();
  const [pendingOrders, setPendingOrders] = useState<DeliveryOrder[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<DeliveryOrder | null>(null);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<Tab>("orders");
  const [isAvailable, setIsAvailable] = useState(false);
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const { isTracking, startTracking, stopTracking } = useDriverLocation();
  const notificationSound = useRef<HTMLAudioElement | null>(null);
  const gpsAutoStarted = useRef(false);
  const prevPendingCount = useRef(0);

  // Sonido de notificación
  useEffect(() => {
    notificationSound.current = new Audio(
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJavm66LcF93h5ammJZxX2V/k6Wlm4t0ZHaHlaOdlIBvZHOFk56cloR0aXWFlJ2bln95bnSEk5yblYJ5b3WEk5uZlIF5cHaDkpqYkoB5cXeDkpmXkX94cXeDkpmXkYB4"
    );
  }, []);

  // GPS auto-start al entrar
  useEffect(() => {
    if (user && !gpsAutoStarted.current && !isTracking) {
      gpsAutoStarted.current = true;
      startTracking();
    }
  }, [user, isTracking, startTracking]);

  // Cargar perfil del driver
  useEffect(() => {
    if (!user) return;
    supabase
      .from("driver_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setDriverProfile(data);
        if (data) {
          setIsAvailable(data.status === "activo" || data.status === "en_ruta");
        }
      });
  }, [user]);

  // Toggle disponibilidad
  const toggleAvailability = async () => {
    if (!user || togglingAvailability) return;
    setTogglingAvailability(true);
    const newStatus = isAvailable ? "inactivo" : "activo";
    const { error } = await supabase
      .from("driver_profiles")
      .update({ status: newStatus as any, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) {
      toast.error("Error al cambiar disponibilidad");
      setTogglingAvailability(false);
      return;
    }
    setIsAvailable(!isAvailable);
    setDriverProfile((prev: any) => prev ? { ...prev, status: newStatus } : prev);
    toast.success(isAvailable ? "Estás desconectado" : "¡Estás en línea!");

    if (isAvailable && isTracking) stopTracking();
    else if (!isAvailable && !isTracking) startTracking();
    setTogglingAvailability(false);
  };

  // ── Fetch pedidos pendientes y activo ──────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const fetchPending = async () => {
      if (!isAvailable) { setPendingOrders([]); return; }

      // BUG FIX: usar available_deliveries (vista segura) en lugar de deliveries
      // La política RLS ya no permite leer pendientes de la tabla directa
      const { data, error } = await supabase
        .from("available_deliveries" as any)
        .select("id, order_id, pickup_address, delivery_address, amount, commission, estimated_time, zone, status")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[DriverApp] fetchPending error:", error.message);
        return;
      }

      // La vista no expone datos sensibles — los completamos con valores por defecto
      const orders: DeliveryOrder[] = (data || []).map((d: any) => ({
        id: d.id,
        order_id: d.order_id,
        customer_name: "Cliente",          // revelado tras aceptar
        customer_phone: null,
        pickup_address: d.pickup_address,
        delivery_address: d.delivery_address,
        amount: Number(d.amount || 0),
        commission: Number(d.commission || 0),
        estimated_time: d.estimated_time,
        status: d.status,
        zone: d.zone,
        pickup_lat: null,
        pickup_lng: null,
        delivery_lat: null,
        delivery_lng: null,
      }));

      if (orders.length > prevPendingCount.current) {
        notificationSound.current?.play().catch(() => {});
      }
      prevPendingCount.current = orders.length;
      setPendingOrders(orders);
    };

    const fetchActive = async () => {
      const { data } = await supabase
        .from("deliveries")
        .select("id, order_id, customer_name, customer_phone, pickup_address, delivery_address, amount, commission, estimated_time, status, zone, pickup_lat, pickup_lng, delivery_lat, delivery_lng")
        .eq("driver_id", user.id)
        .in("status", ["aceptado", "en_camino"])
        .maybeSingle();
      setActiveDelivery(data as DeliveryOrder | null);
    };

    fetchPending();
    fetchActive();

    const channel = supabase
      .channel("driver-deliveries-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, () => {
        fetchPending();
        fetchActive();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, isAvailable]);

  // Aceptar pedido
  const acceptOrder = async (delivery: DeliveryOrder) => {
    if (!user) return;

    // Si no está activo, activarlo primero
    if (!isAvailable) {
      toast.error("Actívate primero para recibir pedidos");
      return;
    }

    const { data, error } = await supabase.rpc("claim_delivery", {
      p_delivery_id: delivery.id,
    });

    if (error || !data?.ok) {
      toast.error(data?.error || error?.message || "No se pudo tomar el pedido");
      return;
    }

    toast.success("¡Pedido tomado!");

    // Insertar log de auditoría (con política corregida)
    await supabase.from("delivery_audit_log").insert({
      delivery_id: delivery.id,
      event: "Pedido aceptado",
      details: "Aceptado por mensajero",
      performed_by: user.id,
    }).then(({ error: e }) => {
      if (e) console.warn("[DriverApp] audit log error:", e.message);
    });
  };

  const rejectOrder = (delivery: DeliveryOrder) => {
    setPendingOrders((prev) => prev.filter((o) => o.id !== delivery.id));
  };

  const updateDeliveryStatus = async (newStatus: string) => {
    if (!activeDelivery || !user) return;
    const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === "en_camino") updates.picked_up_at = new Date().toISOString();
    if (newStatus === "entregado") updates.delivered_at = new Date().toISOString();

    const { error } = await supabase.from("deliveries").update(updates).eq("id", activeDelivery.id);
    if (error) { toast.error("Error actualizando estado"); return; }

    toast.success(newStatus === "entregado" ? "¡Entrega completada! 🎉" : "Estado actualizado");
    await supabase.from("delivery_audit_log").insert({
      delivery_id: activeDelivery.id,
      event: newStatus === "en_camino" ? "En camino" : "Entregado",
      details: `Estado cambiado a ${newStatus}`,
      performed_by: user.id,
    });
  };

  const name = user?.user_metadata?.full_name || "Mensajero";
  const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
  const todayEarnings = driverProfile ? Number(driverProfile.total_deliveries || 0) * Number(driverProfile.rating || 0) : 0;

  // ── Si hay entrega activa → pantalla de navegación full ──────────────────
  if (activeDelivery) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header compacto encima del mapa */}
        <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-xl border-b border-border/30 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bike className="h-5 w-5 text-primary" />
            <span className="text-sm font-bold">Servicio activo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${isTracking ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
            <span className="text-[10px] text-muted-foreground">{isTracking ? "GPS" : "Sin GPS"}</span>
          </div>
        </header>
        <div className="flex-1">
          <ActiveDeliveryView
            delivery={activeDelivery}
            onPickedUp={() => updateDeliveryStatus("en_camino")}
            onDelivered={() => updateDeliveryStatus("entregado")}
          />
        </div>
      </div>
    );
  }

  // ── Pantalla principal ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── HEADER ── */}
      <header className="bg-card border-b border-border/30 px-4 pt-4 pb-3 space-y-3">
        {/* Fila superior: avatar + nombre + logout */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm font-bold text-white shadow-md">
              {initials}
            </div>
            <div>
              <p className="text-base font-bold text-foreground leading-tight">{name}</p>
              <div className="flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${isAvailable ? "bg-green-500 animate-pulse" : "bg-zinc-400"}`} />
                <span className="text-xs text-muted-foreground">
                  {isAvailable ? "En línea" : "Desconectado"}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={signOut}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Toggle de disponibilidad estilo DiDi */}
        <div
          onClick={toggleAvailability}
          className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
            isAvailable
              ? "bg-green-500/10 border-green-500/30"
              : "bg-muted/40 border-border/40"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
              isAvailable ? "bg-green-500/20" : "bg-muted"
            }`}>
              <Power className={`h-5 w-5 ${isAvailable ? "text-green-500" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className={`text-sm font-bold ${isAvailable ? "text-green-600 dark:text-green-400" : "text-foreground"}`}>
                {isAvailable ? "Estás en línea" : "Estás desconectado"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {isAvailable ? "Recibiendo pedidos · GPS activo" : "Toca para conectarte"}
              </p>
            </div>
          </div>
          <Switch
            checked={isAvailable}
            disabled={togglingAvailability}
            className="data-[state=checked]:bg-green-500 pointer-events-none"
          />
        </div>

        {/* Stats rápidas */}
        {driverProfile && (
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded-xl bg-muted/40">
              <p className="text-lg font-extrabold text-foreground">{driverProfile.total_deliveries ?? 0}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Entregas</p>
            </div>
            <div className="text-center p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-lg font-extrabold text-amber-500">⭐ {driverProfile.rating ?? "—"}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Rating</p>
            </div>
            <div className="text-center p-2 rounded-xl bg-muted/40">
              <p className="text-lg font-extrabold text-foreground">{driverProfile.acceptance_rate ?? 0}%</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Aceptación</p>
            </div>
          </div>
        )}
      </header>

      {/* ── CONTENIDO ── */}
      <div className="flex-1 overflow-y-auto pb-24">
        <AnimatePresence mode="wait">
          {activeTab === "orders" && (
            <motion.div
              key="orders"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="p-4 space-y-4"
            >
              {/* Banner desconectado */}
              {!isAvailable && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20"
                >
                  <Power className="h-5 w-5 text-amber-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Estás desconectado</p>
                    <p className="text-xs text-muted-foreground">Actívate para recibir pedidos</p>
                  </div>
                  <button
                    onClick={toggleAvailability}
                    className="text-xs font-bold text-amber-500 border border-amber-500/40 rounded-lg px-3 py-1.5"
                  >
                    Activar
                  </button>
                </motion.div>
              )}

              {/* Sin pedidos */}
              {isAvailable && pendingOrders.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                  <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center">
                    <Package className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                  <p className="text-base font-semibold text-muted-foreground">Sin pedidos disponibles</p>
                  <p className="text-xs text-muted-foreground/60">Te notificaremos cuando llegue uno nuevo</p>
                </div>
              )}

              {/* Lista de pedidos */}
              <AnimatePresence>
                {pendingOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onAccept={() => acceptOrder(order)}
                    onReject={() => rejectOrder(order)}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}

          {activeTab === "history" && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="p-4"
            >
              <DeliveryHistory />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── BOTTOM NAV estilo DiDi ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border/40 shadow-2xl shadow-black/30">
        <div className="flex">
          <button
            onClick={() => setActiveTab("orders")}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors relative ${
              activeTab === "orders" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {activeTab === "orders" && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full"
              />
            )}
            <Package className="h-5 w-5" />
            <span className="text-[11px] font-semibold">Pedidos</span>
            {pendingOrders.length > 0 && (
              <span className="absolute top-2 right-[calc(50%-20px)] h-4 min-w-[16px] px-1 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">
                {pendingOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors relative ${
              activeTab === "history" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {activeTab === "history" && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full"
              />
            )}
            <History className="h-5 w-5" />
            <span className="text-[11px] font-semibold">Historial</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default DriverApp;
