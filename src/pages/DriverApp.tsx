import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import {
  Package, History, Power, LogOut, Star,
  CheckCircle, Clock, DollarSign, ChevronRight,
  MapPin, Bike, Navigation, LayoutGrid, RotateCw,
  Search, Bell, Shield, Wallet
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import OrderCard from "@/components/driver/OrderCard";
import ActiveDeliveryView from "@/components/driver/ActiveDeliveryView";
import DeliveryHistory from "@/components/driver/DeliveryHistory";
import NearbyOrdersMap from "@/components/driver/NearbyOrdersMap";

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
  const [earningsToday, setEarningsToday] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"feed" | "map">("feed");
  const { isTracking, currentLocation, startTracking, stopTracking } = useDriverLocation();
  const notificationSound = useRef<HTMLAudioElement | null>(null);
  const prevPendingCount = useRef(0);

  // Layout Mobile Lock
  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.body.style.backgroundColor = "#020617";
    return () => { document.body.style.overflow = "auto"; };
  }, []);

  useEffect(() => {
    notificationSound.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3");
  }, []);

  const refreshData = useCallback(async (silent = true) => {
    if (!user) return;
    if (!silent) setIsRefreshing(true);

    const { data: profile } = await supabase.from("driver_profiles").select("status").eq("id", user.id).maybeSingle();
    if (profile) setIsAvailable((profile as any).status === "activo" || (profile as any).status === "en_ruta");

    // Activo
    const { data: active } = await supabase.from("deliveries").select("*").eq("driver_id", user.id).in("status", ["aceptado", "en_camino"]).maybeSingle();
    setActiveDelivery(active as any);

    // Ganancias de hoy
    const today = new Date().toISOString().split('T')[0];
    const { data: earnings } = await supabase.from("deliveries")
      .select("commission")
      .eq("driver_id", user.id)
      .eq("status", "entregado")
      .gte("updated_at", today);
    const total = (earnings as any[])?.reduce((acc, curr) => acc + (Number(curr.commission) || 0), 0) || 0;
    setEarningsToday(total);

    // Pendientes (Con Broadcast & Realtime)
    if (isAvailable) {
      const { data: pending, error } = await supabase.from("pending_delivery_offers").select("*");
      if (!error && pending) {
        let orders: DeliveryOrder[] = pending.map((d: any) => ({
            ...d,
            amount: Number(d.amount || 0),
            commission: Number(d.commission || 0),
            distanceToMe: (currentLocation && d.pickup_lat) ? calculateKm(currentLocation.lat, currentLocation.lng, d.pickup_lat, d.pickup_lng) : undefined
        }));

        orders.sort((a, b) => (a.distanceToMe || 999) - (b.distanceToMe || 999));

        if (orders.length > prevPendingCount.current) {
          notificationSound.current?.play().catch(() => {});
          toast("🔔 ¡NUEVO PEDIDO DISPONIBLE!", { 
            description: "Hay servicios disponibles cerca de tu posición.",
            icon: <Bell className="h-4 w-4 text-primary" />
          });
        }
        prevPendingCount.current = orders.length;
        setPendingOrders(orders);
      }
    } else {
      setPendingOrders([]);
    }
    
    if (!silent) {
        setTimeout(() => setIsRefreshing(false), 600);
    }
  }, [user, isAvailable, currentLocation]);

  // Realtime con BROADCAST (Mucho más eficiente que polling)
  useEffect(() => {
    if (!user) return;
    
    refreshData();

    // 1. Escuchar cambios directos en tabla (Postgres)
    const tableChannel = supabase.channel("table-db-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, () => refreshData(true))
      .subscribe();

    // 2. Escuchar BROADCAST de la central (Instantáneo)
    const broadcastChannel = supabase.channel("dispatch-notifications")
      .on("broadcast", { event: "new-order" }, () => {
         console.log("Broadcast received: New order published!");
         refreshData(true);
      })
      .subscribe();

    // 3. Fallback Polling (Menor intervalo para más velocidad)
    const interval = setInterval(() => refreshData(true), 10000);

    return () => {
      supabase.removeChannel(tableChannel);
      supabase.removeChannel(broadcastChannel);
      clearInterval(interval);
    };
  }, [user, isAvailable, refreshData]);

  const toggleAvailability = async () => {
    if (!user) return;
    const newStatus = isAvailable ? "inactivo" : "activo";
    await (supabase.from("driver_profiles") as any).update({ status: newStatus }).eq("id", user.id);
    setIsAvailable(!isAvailable);
    if (!isAvailable) startTracking();
    else { refreshData(false); startTracking(); }
  };

  const acceptOrder = async (order: DeliveryOrder) => {
    if (!user) return;
    const { data, error } = await (supabase.from("deliveries") as any)
      .update({ driver_id: user.id, status: "aceptado", accepted_at: new Date().toISOString() })
      .eq("id", order.id).eq("status", "pendiente").is("driver_id", null).select();

    if (error || !data?.length) { 
        toast.error("Oops! Otro mensajero fue más rápido."); 
        refreshData(true);
        return; 
    }
    setActiveDelivery(data[0] as any);
    toast.success("¡Pedido Aceptado!", { description: "Navega hacia el punto de recogida." });
  };

  const updateStatus = async (s: string) => {
    if (!activeDelivery) return;
    await (supabase.from("deliveries") as any).update({ status: s, updated_at: new Date().toISOString() }).eq("id", activeDelivery.id);
    if (s === "entregado") {
        setActiveDelivery(null);
        refreshData(false);
        toast.success("¡Entrega finalizada!", { description: "Buen trabajo." });
    } else refreshData();
  };

  if (activeDelivery) {
    return (
      <div className="fixed inset-0 h-full w-full bg-slate-950 flex flex-col overflow-hidden z-[1000]">
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
    <div className="fixed inset-0 h-full w-full bg-slate-950 flex flex-col overflow-hidden font-sans">
      
      {/* HEADER COMPACTO (Estilo App Profesional) */}
      <header className={`safe-top bg-slate-900/40 backdrop-blur-3xl px-6 pt-6 transition-all duration-500 overflow-hidden ${viewMode === 'map' ? 'pb-2' : 'pb-4 border-b border-white/5'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-black text-white shadow-xl shadow-indigo-500/20 text-sm">
                    {user?.user_metadata?.full_name?.[0] || "M"}
                </div>
                {isAvailable && <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />}
            </div>
            <div>
              <h1 className="text-sm font-black text-white tracking-tight">{user?.user_metadata?.full_name?.split(" ")[0] || "Mensajero"}</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                 <p className={`text-[9px] font-black uppercase tracking-widest ${isAvailable ? 'text-emerald-400' : 'text-white/20'}`}>{isAvailable ? 'En Línea' : 'Desconectado'}</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
              <div className="text-right">
                  <p className="text-[8px] font-black text-white/30 uppercase tracking-widest leading-none mb-1">Ganancia Hoy</p>
                  <p className="text-sm font-black text-white tracking-tighter leading-none">$ {earningsToday.toLocaleString()}</p>
              </div>
              <button onClick={toggleAvailability} className={`h-10 w-10 rounded-xl flex items-center justify-center active:scale-95 transition-all ${isAvailable ? 'bg-emerald-500/20 text-emerald-500' : 'bg-white/5 text-white/30'}`}>
                <Power className="h-5 w-5" />
              </button>
          </div>
        </div>

        {/* FEED / MAP SWITCHER (Floating-style) */}
        <div className="mt-4 pb-2 px-0">
          <div className="bg-white/5 p-1 rounded-2xl flex gap-1 border border-white/5 shadow-inner">
              <button 
                onClick={() => setViewMode("feed")}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'feed' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/30 hover:text-white/50'}`}
              >
                  Feed de Pedidos
              </button>
              <button 
                onClick={() => setViewMode("map")}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'map' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/30 hover:text-white/50'}`}
              >
                  Explorar Mapa
              </button>
          </div>
        </div>
      </header>

      {/* FEED / MAP SWITCHER */}
      <div className="px-6 py-2">
          <div className="bg-white/5 p-1 rounded-2xl flex gap-1">
              <button 
                onClick={() => setViewMode("feed")}
                className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'feed' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/30 hover:text-white/50'}`}
              >
                  Lista
              </button>
              <button 
                onClick={() => setViewMode("map")}
                className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'map' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/30 hover:text-white/50'}`}
              >
                  Ver Mapa
              </button>
          </div>
      </div>

      <main className={`flex-1 overflow-y-auto px-4 pb-32 space-y-4 transition-all duration-500 ${viewMode === 'map' ? 'pt-0' : 'pt-4'}`}>
         <AnimatePresence mode="wait">
            {activeTab === 'orders' ? (
                <motion.div 
                    key={viewMode}
                    initial={{ opacity: 0, scale: 0.98 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    exit={{ opacity: 0, scale: 1.02 }}
                    className="h-full w-full space-y-4"
                >
                    {viewMode === "feed" ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-2 px-2">
                                <h2 className="text-xs font-black text-white/30 uppercase tracking-[0.3em]">Servicios Cercanos</h2>
                                <span className="bg-indigo-600/20 text-indigo-400 font-black text-[10px] px-3 py-1 rounded-full">{pendingOrders.length} DISPONIBLES</span>
                            </div>
                            {pendingOrders.length === 0 ? (
                                <div className="text-center py-24 px-10 flex flex-col items-center">
                                    <div className="h-24 w-24 bg-white/10 rounded-[40px] flex items-center justify-center mb-6 animate-pulse">
                                        <Package className="h-12 w-12 text-white/20" />
                                    </div>
                                    <p className="text-sm font-black text-white/40 uppercase tracking-widest">Buscando rutas...</p>
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
                        </div>
                    ) : (
                        <div className="fixed inset-x-0 bottom-24 bg-slate-900 z-10" style={{ top: '160px' }}>
                            <NearbyOrdersMap 
                                orders={pendingOrders} 
                                currentLocation={currentLocation} 
                                onAcceptOrder={(id) => {
                                    const order = pendingOrders.find(o => o.id === id);
                                    if(order) acceptOrder(order);
                                }}
                            />
                        </div>
                    )}
                </motion.div>
            ) : <DeliveryHistory />}
         </AnimatePresence>
      </main>

      {/* BOTTOM NAVIGATION GLASS */}
      <nav className="fixed bottom-0 inset-x-0 h-24 bg-slate-900/80 backdrop-blur-3xl border-t border-white/5 px-10 flex items-center justify-between z-[100] safe-bottom">
          <button 
            onClick={() => setActiveTab('orders')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'orders' ? 'text-indigo-500 scale-110' : 'text-white/30'}`}
          >
              <LayoutGrid className="h-6 w-6" />
              <span className="text-[8px] font-black uppercase tracking-widest">Panel</span>
          </button>
          
          <div 
            onClick={toggleAvailability}
            className={`h-20 w-20 -mt-16 rounded-[40%] flex items-center justify-center shadow-2xl transition-all active:scale-90 cursor-pointer ${isAvailable ? 'bg-indigo-600 shadow-indigo-600/30' : 'bg-slate-800'}`}
          >
              <Bike className="h-9 w-9 text-white" />
          </div>

          <button 
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'history' ? 'text-indigo-500 scale-110' : 'text-white/30'}`}
          >
              <History className="h-6 w-6" />
              <span className="text-[8px] font-black uppercase tracking-widest">Viajes</span>
          </button>
      </nav>
    </div>
  );
};

export default DriverApp;
