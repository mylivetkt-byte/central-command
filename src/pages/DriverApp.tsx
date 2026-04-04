import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Bike, LogOut, Package, History, Power,
  TrendingUp, User, ChevronDown, Star,
  CheckCircle, BarChart2, X
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
  notes: string | null;
}

type Tab = "orders" | "history";

const SELECT_FIELDS =
  "id,order_id,customer_name,customer_phone,pickup_address,delivery_address,amount,commission,estimated_time,status,zone,pickup_lat,pickup_lng,delivery_lat,delivery_lng,notes";

const fmt = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

// ── Panel de estadísticas (va dentro del menú desplegable) ────────────────────
const StatsPanel = ({
  profile, todayEarnings, onClose
}: { profile: any; todayEarnings: number; onClose: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: -8, scale: 0.97 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: -8, scale: 0.97 }}
    transition={{ duration: 0.18 }}
    className="absolute right-4 top-16 z-[200] w-72 bg-card border border-border/60 rounded-2xl shadow-2xl shadow-black/30 overflow-hidden"
  >
    {/* Cabecera del panel */}
    <div className="flex items-center justify-between px-4 pt-4 pb-2">
      <p className="text-sm font-bold text-foreground">Mis estadísticas</p>
      <button onClick={onClose} className="h-7 w-7 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>

    <div className="px-4 pb-4 space-y-3">
      {/* Ganancias hoy */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/10 border border-accent/20">
        <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
          <TrendingUp className="h-5 w-5 text-accent" />
        </div>
        <div>
          <p className="text-xl font-extrabold text-accent leading-none">{fmt(todayEarnings)}</p>
          <p className="text-[11px] text-muted-foreground">Ganancias hoy</p>
        </div>
      </div>

      {/* Métricas en grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2.5 rounded-xl bg-muted/50 border border-border/30">
          <p className="text-lg font-extrabold text-foreground">{profile?.total_deliveries ?? 0}</p>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Entregas</p>
        </div>
        <div className="text-center p-2.5 rounded-xl bg-muted/50 border border-border/30">
          <div className="flex items-center justify-center gap-0.5">
            <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
            <p className="text-lg font-extrabold text-foreground">{profile?.rating ?? "0.0"}</p>
          </div>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Rating</p>
        </div>
        <div className="text-center p-2.5 rounded-xl bg-muted/50 border border-border/30">
          <p className="text-lg font-extrabold text-foreground">{profile?.acceptance_rate ?? 100}%</p>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Acepta.</p>
        </div>
      </div>

      {/* Carga actual */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/30">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Pedidos activos</span>
        </div>
        <span className="text-sm font-bold text-foreground">{profile?.current_load ?? 0}</span>
      </div>

      {profile?.zone && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/30">
          <span className="text-sm text-muted-foreground">Zona asignada</span>
          <span className="text-sm font-bold text-foreground">{profile.zone}</span>
        </div>
      )}
    </div>
  </motion.div>
);

// ── App principal ─────────────────────────────────────────────────────────────
const DriverApp = () => {
  const { user, signOut }                           = useAuth();
  const [pendingOrders, setPendingOrders]           = useState<DeliveryOrder[]>([]);
  const [activeDelivery, setActiveDelivery]         = useState<DeliveryOrder | null>(null);
  const [driverProfile, setDriverProfile]           = useState<any>(null);
  const [activeTab, setActiveTab]                   = useState<Tab>("orders");
  const [isAvailable, setIsAvailable]               = useState(false);
  const [todayEarnings, setTodayEarnings]           = useState(0);
  const [menuOpen, setMenuOpen]                     = useState(false);
  const { isTracking, startTracking, stopTracking } = useDriverLocation();
  const notificationSound = useRef<HTMLAudioElement | null>(null);
  const gpsAutoStarted    = useRef(false);
  const prevPendingCount  = useRef(0);

  useEffect(() => {
    notificationSound.current = new Audio(
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJavm66LcF93h5ammJZxX2V/k6Wlm4t0ZHaHlaOdlIBvZHOFk56cloR0aXWFlJ2bln95bnSEk5yblYJ5b3WEk5uZlIF5cHaDkpqYkoB5cXeDkpmXkX94cXeDkpmXkYB4"
    );
  }, []);

  useEffect(() => {
    if (user && !gpsAutoStarted.current && !isTracking) {
      gpsAutoStarted.current = true;
      startTracking();
    }
  }, [user, isTracking, startTracking]);

  useEffect(() => {
    if (!user) return;
    supabase.from("driver_profiles").select("*").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        setDriverProfile(data);
        if (data) setIsAvailable(data.status === "activo" || data.status === "en_ruta");
      });
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    supabase.from("deliveries")
      .select("commission")
      .eq("driver_id", user.id)
      .eq("status", "entregado")
      .gte("delivered_at", todayStart.toISOString())
      .then(({ data }) => {
        setTodayEarnings((data || []).reduce((s, d) => s + Number(d.commission), 0));
      });
  }, [user]);

  const toggleAvailability = async () => {
    if (!user) return;
    const newStatus = isAvailable ? "inactivo" : "activo";
    const { error } = await supabase.from("driver_profiles").update({ status: newStatus as any }).eq("id", user.id);
    if (error) { toast.error("Error al cambiar disponibilidad"); return; }
    setIsAvailable(!isAvailable);
    setDriverProfile((p: any) => p ? { ...p, status: newStatus } : p);
    toast.success(isAvailable ? "Ahora estás desconectado" : "¡Estás disponible para recibir pedidos!");
    if (isAvailable && isTracking) stopTracking();
    else if (!isAvailable && !isTracking) startTracking();
  };

  const fetchPending = useCallback(async () => {
    if (!isAvailable) { setPendingOrders([]); return; }
    const { data } = await supabase
      .from("deliveries").select(SELECT_FIELDS)
      .eq("status", "pendiente").is("driver_id", null)
      .order("created_at", { ascending: false });
    const orders = (data || []) as DeliveryOrder[];
    if (orders.length > prevPendingCount.current) notificationSound.current?.play().catch(() => {});
    prevPendingCount.current = orders.length;
    setPendingOrders(orders);
  }, [isAvailable]);

  const fetchActive = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("deliveries").select(SELECT_FIELDS)
      .eq("driver_id", user.id).in("status", ["aceptado", "en_camino"]).maybeSingle();
    setActiveDelivery(data as DeliveryOrder | null);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchPending(); fetchActive();
    const ch = supabase.channel("driver-deliveries-v3")
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, () => {
        fetchPending(); fetchActive();
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, isAvailable, fetchPending, fetchActive]);

  const acceptOrder = async (delivery: DeliveryOrder) => {
    if (!user) return;
    const { data, error } = await supabase.rpc("claim_delivery", { p_delivery_id: delivery.id });
    if (error || !data?.ok) { toast.error(data?.error || "No se pudo tomar el pedido"); return; }
    toast.success("¡Pedido tomado!");
    await supabase.from("delivery_audit_log").insert({
      delivery_id: delivery.id, event: "Pedido aceptado",
      details: "Aceptado por mensajero", performed_by: user.id,
    });
  };

  const rejectOrder = (delivery: DeliveryOrder) => {
    toast.info(`Pedido ${delivery.order_id} rechazado`);
    setPendingOrders(prev => prev.filter(o => o.id !== delivery.id));
  };

  const updateDeliveryStatus = async (newStatus: string) => {
    if (!activeDelivery || !user) return;
    const updates: any = { status: newStatus };
    if (newStatus === "en_camino") updates.picked_up_at = new Date().toISOString();
    if (newStatus === "entregado") updates.delivered_at = new Date().toISOString();
    const { error } = await supabase.from("deliveries").update(updates).eq("id", activeDelivery.id);
    if (error) { toast.error("Error actualizando estado"); return; }
    toast.success(newStatus === "entregado" ? "¡Entrega completada!" : "Estado actualizado");
    await supabase.from("delivery_audit_log").insert({
      delivery_id: activeDelivery.id,
      event: newStatus === "en_camino" ? "En camino" : "Entregado",
      details: `Estado cambiado a ${newStatus}`, performed_by: user.id,
    });
  };

  const profileInitials = (user?.user_metadata?.full_name || "M")
    .split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  // ── Vista de entrega activa (pantalla completa) ────────────────────────────
  if (activeDelivery) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-xl border-b border-border/30 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bike className="h-5 w-5 text-primary" />
            <span className="text-sm font-bold text-foreground">Servicio activo</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${isTracking ? "bg-accent animate-pulse" : "bg-destructive"}`} />
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

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-xl border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-3">

          {/* Avatar + nombre + estado */}
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm font-bold text-primary-foreground shrink-0">
            {profileInitials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">
              {user?.user_metadata?.full_name || "Mensajero"}
            </p>
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${isAvailable ? "bg-accent animate-pulse" : "bg-destructive"}`} />
              <span className="text-[10px] text-muted-foreground">
                {isAvailable ? "Disponible" : "No disponible"}
              </span>
            </div>
          </div>

          {/* Toggle de disponibilidad (compacto, inline) */}
          <div className="flex items-center gap-2 bg-muted/50 border border-border/30 rounded-xl px-3 py-1.5">
            <Power className={`h-4 w-4 shrink-0 ${isAvailable ? "text-accent" : "text-muted-foreground"}`} />
            <Switch
              checked={isAvailable}
              onCheckedChange={toggleAvailability}
              className="data-[state=checked]:bg-accent scale-90"
            />
          </div>

          {/* Botón menú desplegable (estadísticas, perfil, etc.) */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors ${
                menuOpen ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart2 className="h-4 w-4" />
            </button>

            {/* Panel flotante de estadísticas */}
            <AnimatePresence>
              {menuOpen && (
                <StatsPanel
                  profile={driverProfile}
                  todayEarnings={todayEarnings}
                  onClose={() => setMenuOpen(false)}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Cerrar sesión */}
          <button
            onClick={signOut}
            className="h-9 w-9 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Overlay para cerrar el menú al tocar fuera */}
      {menuOpen && (
        <div className="fixed inset-0 z-[199]" onClick={() => setMenuOpen(false)} />
      )}

      {/* ── TABS ───────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 mx-4 mt-3 p-1 bg-muted/50 rounded-2xl">
        <button
          onClick={() => setActiveTab("orders")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "orders" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          <Package className="h-4 w-4" />
          Pedidos
          {pendingOrders.length > 0 && (
            <span className="h-5 min-w-[20px] px-1 rounded-full bg-warning text-warning-foreground text-[10px] font-bold flex items-center justify-center">
              {pendingOrders.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "history" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          <History className="h-4 w-4" />
          Historial
        </button>
      </div>

      {/* ── CONTENIDO ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-8">

        {activeTab === "orders" && (
          <>
            {/* Sin pedidos */}
            {pendingOrders.length === 0 ? (
              <div className="text-center py-20">
                <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Package className="h-10 w-10 text-muted-foreground/40" />
                </div>
                {isAvailable ? (
                  <>
                    <p className="text-base font-semibold text-muted-foreground">No hay pedidos disponibles</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Te notificaremos cuando llegue uno nuevo</p>
                  </>
                ) : (
                  <>
                    <p className="text-base font-semibold text-muted-foreground">Estás desconectado</p>
                    <p className="text-xs text-muted-foreground/60 mt-1 mb-4">Activa el switch para empezar a recibir pedidos</p>
                    <button
                      onClick={toggleAvailability}
                      className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-accent-foreground"
                    >
                      <Power className="h-4 w-4" /> Activarme ahora
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence>
                  {pendingOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onAccept={() => acceptOrder(order)}
                      onReject={() => rejectOrder(order)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </>
        )}

        {activeTab === "history" && <DeliveryHistory />}
      </div>
    </div>
  );
};

export default DriverApp;
