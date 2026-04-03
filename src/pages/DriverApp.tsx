import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import {
  Package, History, Power, LogOut, Star,
  CheckCircle, Clock, DollarSign, ChevronRight,
  MapPin, Bike, Navigation, LayoutGrid, RotateCw
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
  created_at: string;
  distanceToMe?: number;
}

type Tab = "orders" | "history" | "stats";

// Helper for distance calc
const calculateKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const DriverApp = () => {
  const { user, signOut } = useAuth();
  const [pendingOrders, setPendingOrders] = useState<DeliveryOrder[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<DeliveryOrder | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("orders");
  const [isAvailable, setIsAvailable] = useState(false);
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const { isTracking, currentLocation, startTracking, stopTracking } = useDriverLocation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const notificationSound = useRef<HTMLAudioElement | null>(null);
  const prevPendingCount = useRef(0);

  // Bloquear scroll del body
  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    return () => { document.body.style.overflow = "auto"; };
  }, []);

  useEffect(() => {
    notificationSound.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3");
  }, []);

  // Fetch profiles
  useEffect(() => {
    if (!user) return;
    supabase.from("driver_profiles").select("*").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) setIsAvailable((data as any).status === "activo" || (data as any).status === "en_ruta");
      });
  }, [user]);

  // FETCH ORDERS (CON ORDENAMIENTO POR PROXIMIDAD)
  const refreshData = useCallback(async (silent = true) => {
    if (!user) return;
    if (!silent) setIsRefreshing(true);

    // Fetch Activo
    const { data: active } = await supabase.from("deliveries").select("*").eq("driver_id", user.id).in("status", ["aceptado", "en_camino"]).maybeSingle();
    setActiveDelivery(active as any);

    // Fetch Pendientes
    if (isAvailable) {
      const { data: pending, error } = await supabase.from("pending_delivery_offers").select("*");
      if (!error && pending) {
        let orders: DeliveryOrder[] = pending.map((d: any) => ({
            ...d,
            amount: Number(d.amount || 0),
            commission: Number(d.commission || 0),
            customer_name: "Cliente VIP",
            distanceToMe: (currentLocation && d.pickup_lat) ? calculateKm(currentLocation.lat, currentLocation.lng, d.pickup_lat, d.pickup_lng) : undefined
        }));

        // SORT BY PROXIMITY
        orders.sort((a, b) => (a.distanceToMe || 999) - (b.distanceToMe || 999));

        if (orders.length > prevPendingCount.current) {
          notificationSound.current?.play().catch(() => {});
          toast("🔔 ¡Nuevo pedido cercano disponible!");
        }
        prevPendingCount.current = orders.length;
        setPendingOrders(orders);
      }
    } else {
      setPendingOrders([]);
    }
    
    if (!silent) {
        setTimeout(() => setIsRefreshing(false), 500);
        toast.success("Lista actualizada");
    }
  }, [user, isAvailable, currentLocation]);

  // Realtime + Polling Fallback (10s)
  useEffect(() => {
    if (!user) return;
    
    refreshData();

    // Suscripción Realtime (Escuchamos todo en deliveries ya que las vistas no soportan realtime)
    const channel = supabase.channel("driver-global-v6")
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, () => {
         console.log("Realtime event - refreshing...");
         refreshData(true);
      })
      .subscribe();

    // Fallback Polling (Cada 15 segundos para asegurar)
    const interval = setInterval(() => refreshData(true), 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user, isAvailable, refreshData]);

  const toggleAvailability = async () => {
    if (!user || togglingAvailability) return;
    setTogglingAvailability(true);
    const newStatus = isAvailable ? "inactivo" : "activo";
    await (supabase.from("driver_profiles") as any).update({ status: newStatus }).eq("id", user.id);
    setIsAvailable(!isAvailable);
    if (!isAvailable) startTracking();
    setTogglingAvailability(false);
  };

  const acceptOrder = async (order: DeliveryOrder) => {
    if (!user) return;
    const { data, error } = await (supabase.from("deliveries") as any)
      .update({ driver_id: user.id, status: "aceptado", accepted_at: new Date().toISOString() })
      .eq("id", order.id).eq("status", "pendiente").is("driver_id", null).select();

    if (error || !data?.length) { toast.error("Alguien tomó este pedido antes"); return; }
    setActiveDelivery(data[0] as any);
  };

  const updateStatus = async (s: string) => {
    if (!activeDelivery) return;
    await (supabase.from("deliveries") as any).update({ status: s, updated_at: new Date().toISOString() }).eq("id", activeDelivery.id);
    if (s === "entregado") setActiveDelivery(null);
    else refreshData();
  };

  if (activeDelivery) {
    return (
      <div className="fixed inset-0 h-screen w-screen bg-background flex flex-col overflow-hidden">
        <ActiveDeliveryView 
            delivery={activeDelivery as any} 
            currentLocation={currentLocation} 
            onPickedUp={() => updateStatus("en_camino")} 
            onDelivered={() => updateStatus("entregado")} 
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 h-screen w-screen bg-background flex flex-col overflow-hidden select-none">
      <header className="safe-top bg-card border-b border-border/30 px-6 pt-6 pb-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center font-black text-white shadow-lg">
                {user?.user_metadata?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "M"}
            </div>
            <div>
              <h1 className="text-lg font-black">{user?.user_metadata?.full_name || "Mensajero"}</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Driver ID: {user?.id.slice(0, 6)}</p>
            </div>
          </div>
          <button onClick={() => refreshData(false)} className={`h-11 w-11 rounded-xl bg-muted/50 flex items-center justify-center transition-all ${isRefreshing ? 'animate-spin' : ''}`}>
             <RotateCw className="h-5 w-5" />
          </button>
        </div>

        <div className={`p-3 rounded-2xl border transition-all ${isAvailable ? 'bg-green-500/10 border-green-500/20' : 'bg-muted/50 border-transparent'}`}>
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-2.5 w-2.5 rounded-full ${isAvailable ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
                <span className={`text-xs font-black tracking-widest uppercase ${isAvailable ? 'text-green-500' : 'text-muted-foreground'}`}>
                    {isAvailable ? 'Recibiendo Pedidos' : 'Modo Desconectado'}
                </span>
              </div>
              <Switch checked={isAvailable} onCheckedChange={toggleAvailability} disabled={togglingAvailability} />
           </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-32 space-y-4 bg-slate-50/50">
         <div className="flex items-center p-1 bg-muted/40 rounded-2xl">
            <button onClick={() => setActiveTab('orders')} className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${activeTab === 'orders' ? 'bg-white shadow-md' : 'text-muted-foreground'}`}>PEDIDOS ({pendingOrders.length})</button>
            <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${activeTab === 'history' ? 'bg-white shadow-md' : 'text-muted-foreground'}`}>HISTORIAL</button>
         </div>

         <AnimatePresence mode="wait">
            {activeTab === 'orders' ? (
                <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    {pendingOrders.length === 0 ? (
                        <div className="text-center py-20 px-10 grayscale opacity-40">
                            <Package className="h-14 w-14 mx-auto mb-4 text-muted-foreground" />
                            <p className="text-sm font-black uppercase tracking-widest italic">Buscando rutas cercanas...</p>
                        </div>
                    ) : (
                        pendingOrders.map(order => (
                            <OrderCard 
                                key={order.id} 
                                order={order} 
                                onAccept={() => acceptOrder(order)}
                                onReject={() => refreshData(true)}   
                            />
                        ))
                    )}
                </motion.div>
            ) : <DeliveryHistory key="history" />}
         </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-3xl border-t border-border/10 px-8 py-3 flex items-center justify-between z-50 safe-bottom h-[90px]">
          <button onClick={() => toast.info("Coming Soon")} className="flex flex-col items-center gap-1 opacity-40"><Star className="h-6 w-6" /><span className="text-[10px] font-black uppercase">Premios</span></button>
          <div onClick={() => setActiveTab('orders')} className="bg-primary p-4 rounded-3xl -mt-16 border-8 border-background shadow-2xl active:scale-90 transition-transform cursor-pointer">
              <Bike className="h-8 w-8 text-white" />
          </div>
          <button onClick={() => setActiveTab('history')} className="flex flex-col items-center gap-1 opacity-40"><DollarSign className="h-6 w-6" /><span className="text-[10px] font-black uppercase">Ganancias</span></button>
      </nav>
    </div>
  );
};

export default DriverApp;
