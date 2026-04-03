import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Bike, LogOut, Package, Navigation, Clock, History, Radio
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

const DriverApp = () => {
  const { user, signOut } = useAuth();
  const [pendingOrders, setPendingOrders] = useState<DeliveryOrder[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<DeliveryOrder | null>(null);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<Tab>("orders");
  const { isTracking, startTracking, stopTracking } = useDriverLocation();
  const notificationSound = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    notificationSound.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJavm66LcF93h5ammJZxX2V/k6Wlm4t0ZHaHlaOdlIBvZHOFk56cloR0aXWFlJ2bln95bnSEk5yblYJ5b3WEk5uZlIF5cHaDkpqYkoB5cXeDkpmXkX94cXeDkpmXkYB4");
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchPending = async () => {
      const { data } = await supabase
        .from("deliveries")
        .select("id, order_id, customer_name, customer_phone, pickup_address, delivery_address, amount, commission, estimated_time, status, zone, pickup_lat, pickup_lng, delivery_lat, delivery_lng")
        .eq("status", "pendiente")
        .order("created_at", { ascending: false });

      const orders = (data || []) as DeliveryOrder[];
      if (orders.length > (pendingOrders?.length ?? 0)) {
        notificationSound.current?.play().catch(() => {});
      }
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
      .channel("driver-deliveries")
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, () => {
        fetchPending();
        fetchActive();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase.from("driver_profiles").select("*").eq("id", user.id).maybeSingle()
      .then(({ data }) => setDriverProfile(data));
  }, [user]);

  const acceptOrder = async (delivery: DeliveryOrder) => {
    if (!user) return;

    // Directly update the delivery to claim it
    const { error } = await supabase
      .from("deliveries")
      .update({
        driver_id: user.id,
        status: "aceptado" as const,
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", delivery.id)
      .eq("status", "pendiente");

    if (error) {
      toast.error("No se pudo tomar el pedido");
      return;
    }

    toast.success("¡Pedido tomado! Ya es tuyo.");
    await supabase.from("delivery_audit_log").insert({
      delivery_id: delivery.id,
      event: "Pedido aceptado",
      details: "Aceptado por mensajero",
      performed_by: user.id,
    });
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

  // If there's an active delivery, show the full-screen delivery view
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

  const profileInitials = driverProfile
    ? (user?.user_metadata?.full_name || "M").split(" ").map((n: string) => n[0]).join("").toUpperCase()
    : "M";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-xl border-b border-border/30 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm font-bold text-primary-foreground">
              {profileInitials}
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{user?.user_metadata?.full_name || "Mensajero"}</p>
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${isTracking ? "bg-accent animate-pulse" : "bg-destructive"}`} />
                <span className="text-[10px] text-muted-foreground">
                  {isTracking ? "En línea" : "Desconectado"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={isTracking ? stopTracking : startTracking}
              className={`h-9 w-9 rounded-full ${isTracking ? 'text-accent' : 'text-muted-foreground'}`}
            >
              <Radio className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} className="h-9 w-9 rounded-full">
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </header>

      {/* Quick Stats */}
      {driverProfile && (
        <div className="grid grid-cols-3 gap-2 p-3">
          <div className="text-center p-2.5 rounded-2xl bg-muted/40 border border-border/30">
            <p className="text-lg font-extrabold text-foreground">{driverProfile.total_deliveries}</p>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Entregas</p>
          </div>
          <div className="text-center p-2.5 rounded-2xl bg-accent/10 border border-accent/20">
            <p className="text-lg font-extrabold text-accent">⭐ {driverProfile.rating}</p>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Rating</p>
          </div>
          <div className="text-center p-2.5 rounded-2xl bg-muted/40 border border-border/30">
            <p className="text-lg font-extrabold text-foreground">{driverProfile.acceptance_rate}%</p>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Aceptación</p>
          </div>
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 mx-4 p-1 bg-muted/50 rounded-2xl">
        <button
          onClick={() => setActiveTab("orders")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "orders"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground"
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
            activeTab === "history"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground"
          }`}
        >
          <History className="h-4 w-4" />
          Historial
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-8">
        {activeTab === "orders" && (
          <>
            {!isTracking && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-warning/10 border border-warning/20"
              >
                <Navigation className="h-5 w-5 text-warning shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-foreground">GPS desactivado</p>
                  <p className="text-[10px] text-muted-foreground">Actívalo para recibir pedidos cercanos</p>
                </div>
                <Button size="sm" variant="outline" onClick={startTracking} className="text-xs h-8 rounded-lg border-warning/30 text-warning">
                  Activar
                </Button>
              </motion.div>
            )}

            {pendingOrders.length === 0 ? (
              <div className="text-center py-16">
                <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Package className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <p className="text-base font-semibold text-muted-foreground">No hay pedidos disponibles</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Te notificaremos cuando llegue uno nuevo</p>
              </div>
            ) : (
              <div className="space-y-4">
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
