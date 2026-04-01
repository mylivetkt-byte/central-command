import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bike, MapPin, Clock, DollarSign, CheckCircle, XCircle,
  Navigation, LogOut, Package, Phone, ChevronUp
} from "lucide-react";
import { toast } from "sonner";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";

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
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

const SwipeToAccept = ({ onAccept, onReject }: { onAccept: () => void; onReject: () => void }) => {
  const x = useMotionValue(0);
  const background = useTransform(x, [-150, 0, 150], [
    "hsl(0, 84%, 60%)", "hsl(217, 33%, 14%)", "hsl(160, 84%, 39%)"
  ]);
  const acceptOpacity = useTransform(x, [0, 150], [0, 1]);
  const rejectOpacity = useTransform(x, [-150, 0], [1, 0]);

  const handleDragEnd = (_: any, info: { offset: { x: number } }) => {
    if (info.offset.x > 120) {
      onAccept();
    } else if (info.offset.x < -120) {
      onReject();
    }
  };

  return (
    <div className="relative h-14 rounded-xl overflow-hidden bg-muted border border-border/50">
      <motion.div className="absolute inset-0 rounded-xl" style={{ backgroundColor: background }} />
      <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
        <motion.span className="text-destructive-foreground text-sm font-medium" style={{ opacity: rejectOpacity }}>
          <XCircle className="h-5 w-5 inline mr-1" /> Rechazar
        </motion.span>
        <span className="text-muted-foreground text-xs">← Desliza →</span>
        <motion.span className="text-accent-foreground text-sm font-medium" style={{ opacity: acceptOpacity }}>
          Aceptar <CheckCircle className="h-5 w-5 inline ml-1" />
        </motion.span>
      </div>
      <motion.div
        drag="x"
        dragConstraints={{ left: -150, right: 150 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-16 rounded-lg bg-foreground/90 flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
      >
        <Package className="h-5 w-5 text-background" />
      </motion.div>
    </div>
  );
};

const DriverApp = () => {
  const { user, signOut } = useAuth();
  const [pendingOrders, setPendingOrders] = useState<DeliveryOrder[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<DeliveryOrder | null>(null);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const notificationSound = useRef<HTMLAudioElement | null>(null);

  // Initialize notification sound
  useEffect(() => {
    notificationSound.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJavm66LcF93h5ammJZxX2V/k6Wlm4t0ZHaHlaOdlIBvZHOFk56cloR0aXWFlJ2bln95bnSEk5yblYJ5b3WEk5uZlIF5cHaDkpqYkoB5cXeDkpmXkX94cXeDkpmXkYB4");
  }, []);

  // Watch for pending orders
  useEffect(() => {
    if (!user) return;

    const fetchPending = async () => {
      const { data } = await supabase
        .from("deliveries")
        .select("*")
        .eq("status", "pendiente")
        .order("created_at", { ascending: false });
      
      if (data && data.length > (pendingOrders?.length ?? 0)) {
        notificationSound.current?.play().catch(() => {});
      }
      setPendingOrders(data || []);
    };

    const fetchActive = async () => {
      const { data } = await supabase
        .from("deliveries")
        .select("*")
        .eq("driver_id", user.id)
        .in("status", ["aceptado", "en_camino"])
        .maybeSingle();
      setActiveDelivery(data);
    };

    fetchPending();
    fetchActive();

    const channel = supabase
      .channel("driver-deliveries")
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, () => {
        fetchPending();
        fetchActive();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Fetch driver profile
  useEffect(() => {
    if (!user) return;
    supabase.from("driver_profiles").select("*").eq("id", user.id).maybeSingle()
      .then(({ data }) => setDriverProfile(data));
  }, [user]);

  // Real-time location tracking
  const startLocationTracking = useCallback(() => {
    if (!user || !navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        setLocationEnabled(true);
        await supabase.from("driver_locations").upsert({
          driver_id: user.id,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          updated_at: new Date().toISOString(),
        }, { onConflict: "driver_id" });
      },
      (err) => {
        console.error("Geolocation error:", err);
        toast.error("No se pudo acceder a tu ubicación. Activa el GPS.");
        setLocationEnabled(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }, [user]);

  useEffect(() => {
    startLocationTracking();
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [startLocationTracking]);

  const acceptOrder = async (delivery: DeliveryOrder) => {
    if (!user) return;
    const { error } = await supabase
      .from("deliveries")
      .update({
        driver_id: user.id,
        status: "aceptado" as any,
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", delivery.id)
      .eq("status", "pendiente");

    if (error) {
      toast.error("No se pudo aceptar el pedido");
    } else {
      toast.success("¡Pedido aceptado!");
      // Log audit
      await supabase.from("delivery_audit_log").insert({
        delivery_id: delivery.id,
        event: "Pedido aceptado",
        details: `Aceptado por mensajero`,
        performed_by: user.id,
      });
    }
  };

  const rejectOrder = (delivery: DeliveryOrder) => {
    toast.info(`Pedido ${delivery.order_id} rechazado`);
    setPendingOrders((prev) => prev.filter((o) => o.id !== delivery.id));
  };

  const updateDeliveryStatus = async (newStatus: string) => {
    if (!activeDelivery || !user) return;

    const updates: any = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (newStatus === "en_camino") updates.picked_up_at = new Date().toISOString();
    if (newStatus === "entregado") updates.delivered_at = new Date().toISOString();

    const { error } = await supabase
      .from("deliveries")
      .update(updates)
      .eq("id", activeDelivery.id);

    if (error) {
      toast.error("Error actualizando estado");
    } else {
      toast.success(newStatus === "entregado" ? "¡Entrega completada!" : "Estado actualizado");
      await supabase.from("delivery_audit_log").insert({
        delivery_id: activeDelivery.id,
        event: newStatus === "en_camino" ? "En camino" : "Entregado",
        details: `Estado cambiado a ${newStatus}`,
        performed_by: user.id,
      });
    }
  };

  const profileInitials = driverProfile
    ? (user?.user_metadata?.full_name || "M").split(" ").map((n: string) => n[0]).join("").toUpperCase()
    : "M";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-xl border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-success flex items-center justify-center text-sm font-bold text-accent-foreground">
              {profileInitials}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{user?.user_metadata?.full_name || "Mensajero"}</p>
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${locationEnabled ? "bg-accent animate-pulse" : "bg-destructive"}`} />
                <span className="text-xs text-muted-foreground">
                  {locationEnabled ? "GPS activo" : "Sin GPS"}
                </span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>
      </header>

      {/* Stats bar */}
      {driverProfile && (
        <div className="grid grid-cols-3 gap-2 p-3 bg-card/50">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold text-foreground">{driverProfile.total_deliveries}</p>
            <p className="text-[10px] text-muted-foreground">Entregas</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold text-accent">{driverProfile.rating}</p>
            <p className="text-[10px] text-muted-foreground">Rating</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold text-foreground">{driverProfile.acceptance_rate}%</p>
            <p className="text-[10px] text-muted-foreground">Aceptación</p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {/* Active delivery */}
        <AnimatePresence>
          {activeDelivery && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass-card p-4 space-y-3 glow-primary"
            >
              <div className="flex items-center justify-between">
                <Badge className="bg-primary/20 text-primary border-0">
                  Pedido activo
                </Badge>
                <span className="text-xs text-muted-foreground">{activeDelivery.order_id}</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="mt-1 h-2 w-2 rounded-full bg-accent shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Recoger en</p>
                    <p className="text-sm text-foreground">{activeDelivery.pickup_address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Entregar en</p>
                    <p className="text-sm text-foreground">{activeDelivery.delivery_address}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{activeDelivery.customer_name}</span>
                <span className="font-semibold text-accent">{formatCurrency(Number(activeDelivery.commission))}</span>
              </div>

              {activeDelivery.customer_phone && (
                <a href={`tel:${activeDelivery.customer_phone}`} className="flex items-center gap-2 text-sm text-primary">
                  <Phone className="h-4 w-4" /> Llamar al cliente
                </a>
              )}

              <div className="flex gap-2">
                {activeDelivery.status === "aceptado" && (
                  <Button onClick={() => updateDeliveryStatus("en_camino")} className="flex-1 bg-gradient-primary">
                    <Navigation className="h-4 w-4 mr-2" /> Ya recogí el pedido
                  </Button>
                )}
                {activeDelivery.status === "en_camino" && (
                  <Button onClick={() => updateDeliveryStatus("entregado")} className="flex-1 bg-gradient-success">
                    <CheckCircle className="h-4 w-4 mr-2" /> Entrega completada
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pending orders */}
        {!activeDelivery && (
          <>
            <h2 className="text-lg font-semibold text-foreground">
              Pedidos disponibles
              {pendingOrders.length > 0 && (
                <Badge className="ml-2 bg-warning/20 text-warning border-0">{pendingOrders.length}</Badge>
              )}
            </h2>

            {pendingOrders.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No hay pedidos disponibles</p>
                <p className="text-xs text-muted-foreground mt-1">Te notificaremos cuando llegue uno</p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {pendingOrders.map((order) => (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="glass-card p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-primary">{order.order_id}</span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {order.estimated_time ?? "?"} min
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-3.5 w-3.5 text-accent shrink-0" />
                          <span className="text-foreground truncate">{order.pickup_address}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="text-foreground truncate">{order.delivery_address}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{order.customer_name}</span>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3.5 w-3.5 text-accent" />
                          <span className="text-sm font-semibold text-accent">{formatCurrency(Number(order.commission))}</span>
                        </div>
                      </div>

                      <SwipeToAccept
                        onAccept={() => acceptOrder(order)}
                        onReject={() => rejectOrder(order)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DriverApp;
