import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Package, History, Power, LogOut, Star,
  CheckCircle, Clock, DollarSign, ChevronRight,
  MapPin, Bike, Navigation, LayoutGrid, RotateCw,
  Search, Bell, Shield, Wallet, BarChart2, TrendingUp,
  X, Phone, AlertCircle, XCircle, ChevronUp, ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import L from "leaflet";
import DeliveryHistory from "@/components/driver/DeliveryHistory";
import NearbyOrdersMap from "@/components/driver/NearbyOrdersMap";
import ActiveDeliveryView from "@/components/driver/ActiveDeliveryView";

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
  notes: string | null;
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

const fmt = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

const DriverApp = () => {
  const { user, signOut } = useAuth();
  const [pendingOrders, setPendingOrders] = useState<DeliveryOrder[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<DeliveryOrder | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("orders");
  const [isAvailable, setIsAvailable] = useState(false);
  const [earningsToday, setEarningsToday] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"feed" | "map">("map");
  const [statsOpen, setStatsOpen] = useState(false);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const { isTracking, currentLocation, startTracking, stopTracking } = useDriverLocation();
  const notificationSound = useRef<HTMLAudioElement | null>(null);
  const prevPendingCount = useRef(0);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.body.style.backgroundColor = "#020617";
    notificationSound.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3");
    return () => { document.body.style.overflow = "auto"; };
  }, []);

  const refreshData = useCallback(async (silent = true) => {
    if (!user) return;
    if (!silent) setIsRefreshing(true);

    const { data: profile } = await supabase.from("driver_profiles").select("*").eq("id", user.id).maybeSingle();
    if (profile) {
      setDriverProfile(profile);
      setIsAvailable((profile as any).status === "activo" || (profile as any).status === "en_ruta");
    }

    // Activo
    const { data: active } = await supabase.from("deliveries")
      .select("*")
      .eq("driver_id", user.id)
      .in("status", ["aceptado", "en_camino"])
      .maybeSingle();
    setActiveDelivery(active as any);

    // Ganancias de hoy
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: earnings } = await supabase.from("deliveries")
      .select("commission")
      .eq("driver_id", user.id)
      .eq("status", "entregado")
      .gte("updated_at", today.toISOString());
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

  // Realtime con BROADCAST
  useEffect(() => {
    if (!user) return;
    
    refreshData();

    const tableChannel = supabase.channel("table-db-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, () => refreshData(true))
      .subscribe();

    const broadcastChannel = supabase.channel("dispatch-notifications")
      .on("broadcast", { event: "new-order" }, () => {
         console.log("Broadcast received: New order published!");
         refreshData(true);
      })
      .subscribe();

    const interval = setInterval(() => refreshData(true), 15000);

    return () => {
      supabase.removeChannel(tableChannel);
      supabase.removeChannel(broadcastChannel);
      clearInterval(interval);
    };
  }, [user, isAvailable, refreshData]);

  const toggleAvailability = async () => {
    if (!user) return;
    const newStatus = isAvailable ? "inactivo" : "activo";
    const { error } = await supabase.from("driver_profiles").update({ status: newStatus as any }).eq("id", user.id);
    if (error) { toast.error("Error al cambiar disponibilidad"); return; }
    
    setIsAvailable(!isAvailable);
    if (!isAvailable) {
      startTracking();
      toast.success("Ahora estás en línea");
    } else {
      stopTracking();
      toast.info("Te has desconectado");
    }
    refreshData(false);
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
    
    await supabase.from("delivery_audit_log").insert({
      delivery_id: order.id, event: "Pedido aceptado",
      details: "Aceptado por mensajero tras broadcast", performed_by: user.id,
    });
  };

  const updateStatus = async (s: string) => {
    if (!activeDelivery || !user) return;
    const updates: any = { status: s, updated_at: new Date().toISOString() };
    if (s === "en_camino") updates.picked_up_at = new Date().toISOString();
    if (s === "entregado") updates.delivered_at = new Date().toISOString();
    
    const { error } = await supabase.from("deliveries").update(updates).eq("id", activeDelivery.id);
    if (error) { toast.error("Error actualizando estado"); return; }

    if (s === "entregado") {
        setActiveDelivery(null);
        refreshData(false);
        toast.success("¡Entrega finalizada!", { description: "Buen trabajo." });
    } else {
        refreshData();
        toast.success("Estado actualizado");
    }

    await supabase.from("delivery_audit_log").insert({
      delivery_id: activeDelivery.id,
      event: s === "en_camino" ? "En camino" : (s === "entregado" ? "Entregado" : s),
      details: `Estado cambiado a ${s}`, performed_by: user.id,
    });
  };

  if (activeDelivery) {
    return (
      <div className="fixed inset-0 h-full w-full bg-slate-950 flex flex-col overflow-hidden z-[1000]">
        <ActiveDeliveryView 
            delivery={activeDelivery as any} 
            onPickedUp={() => updateStatus("en_camino")} 
            onDelivered={() => updateStatus("entregado")} 
        />
      </div>
    );
  }

  const profileInitials = (user?.user_metadata?.full_name || "M")
    .split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="fixed inset-0 h-full w-full bg-slate-950 flex flex-col overflow-hidden font-sans">
      
      {/* HEADER COMPACTO (Estilo DiDi/Uber) */}
      <header className={`safe-top bg-slate-900/40 backdrop-blur-3xl px-6 pt-6 transition-all duration-500 overflow-hidden ${viewMode === 'map' ? 'pb-2' : 'pb-4 border-b border-white/5'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-black text-white shadow-xl shadow-indigo-500/20 text-sm">
                    {profileInitials}
                </div>
                {isAvailable && <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />}
            </div>
            <div>
              <h1 className="text-sm font-black text-white tracking-tight">{user?.user_metadata?.full_name?.split(" ")[0] || "Mensajero"}</h1>
              <div className="flex items-center gap-1.5 mt-0.5" onClick={() => setStatsOpen(!statsOpen)}>
                 <p className={`text-[9px] font-black uppercase tracking-widest ${isAvailable ? 'text-emerald-400' : 'text-white/20'}`}>{isAvailable ? 'En Línea' : 'Desconectado'}</p>
                 <ChevronUp className={`h-2.5 w-2.5 text-white/30 transition-transform ${statsOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
              <div className="text-right">
                  <p className="text-[8px] font-black text-white/30 uppercase tracking-widest leading-none mb-1">Ganancia Hoy</p>
                  <p className="text-sm font-black text-white tracking-tighter leading-none">{fmt(earningsToday)}</p>
              </div>
              <button 
                onClick={toggleAvailability} 
                className={`h-10 w-10 rounded-xl flex items-center justify-center active:scale-95 transition-all ${isAvailable ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' : 'bg-white/5 text-white/30'}`}
              >
                <Power className="h-5 w-5" />
              </button>
          </div>
        </div>

        {/* FEED / MAP SWITCHER */}
        <div className="mt-4 pb-2 px-0">
          <div className="bg-white/5 p-1 rounded-2xl flex gap-1 border border-white/5 shadow-inner">
              <button 
                onClick={() => setViewMode("feed")}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'feed' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/30 hover:text-white/50'}`}
              >
                  Feed
              </button>
              <button 
                onClick={() => setViewMode("map")}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'map' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/30 hover:text-white/50'}`}
              >
                  Mapa
              </button>
          </div>
        </div>
      </header>

      {/* STATS OVERLAY QUICK PANEL */}
      <AnimatePresence>
        {statsOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-slate-900/60 backdrop-blur-3xl border-b border-white/5 px-6 pb-6 overflow-hidden"
          >
             <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                   <p className="text-[8px] font-black text-white/30 uppercase mb-1">Entregas</p>
                   <p className="text-lg font-black text-white">{driverProfile?.total_deliveries || 0}</p>
                </div>
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                   <p className="text-[8px] font-black text-white/30 uppercase mb-1">Rating</p>
                   <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                      <p className="text-lg font-black text-white">{driverProfile?.rating || "5.0"}</p>
                   </div>
                </div>
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                   <p className="text-[8px] font-black text-white/30 uppercase mb-1">Aceptación</p>
                   <p className="text-lg font-black text-white">{driverProfile?.acceptance_rate || 100}%</p>
                </div>
             </div>
             <button onClick={signOut} className="w-full mt-4 py-3 rounded-xl bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border border-red-500/20">
                <LogOut className="h-4 w-4" /> Cerrar Sesión
             </button>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 relative overflow-hidden">
         <AnimatePresence mode="wait">
            {activeTab === 'orders' ? (
                <motion.div 
                    key={viewMode}
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className="h-full w-full"
                >
                    {viewMode === "feed" ? (
                        <div className="h-full overflow-y-auto px-6 pt-6 pb-32 space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Servicios Cercanos</h2>
                                <span className="bg-indigo-600/20 text-indigo-400 font-black text-[9px] px-3 py-1 rounded-full border border-indigo-600/30">{pendingOrders.length} DISPONIBLES</span>
                            </div>
                            {pendingOrders.length === 0 ? (
                                <div className="text-center py-24 px-10 flex flex-col items-center">
                                    <div className="h-24 w-24 bg-white/5 rounded-[40px] flex items-center justify-center mb-6 border border-white/5">
                                        <Package className="h-12 w-12 text-white/10" />
                                    </div>
                                    <p className="text-xs font-black text-white/20 uppercase tracking-widest">Buscando rutas...</p>
                                </div>
                            ) : (
                                pendingOrders.map(order => (
                                    <motion.div 
                                      key={order.id}
                                      initial={{ y: 20, opacity: 0 }}
                                      animate={{ y: 0, opacity: 1 }}
                                      className="bg-slate-900 border border-white/5 rounded-[35px] p-6 shadow-2xl relative overflow-hidden group"
                                    >
                                       <div className="flex justify-between items-start mb-6">
                                          <div>
                                             <div className="flex items-center gap-2 mb-1">
                                                <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
                                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Nueva Solicitud</span>
                                             </div>
                                             <h3 className="text-xl font-black text-white tracking-tighter">{order.customer_name}</h3>
                                          </div>
                                          <div className="text-right">
                                             <p className="text-[10px] font-black text-white/30 uppercase mb-1 tracking-widest">Ganancia</p>
                                             <p className="text-2xl font-black text-indigo-400 tracking-tighter">{fmt(order.commission)}</p>
                                          </div>
                                       </div>

                                       <div className="space-y-4 mb-8">
                                          <div className="flex gap-4">
                                             <div className="flex flex-col items-center">
                                                <div className="h-4 w-4 bg-emerald-500 rounded-full border-2 border-slate-900 z-10" />
                                                <div className="w-[2px] flex-1 bg-gradient-to-b from-emerald-500 to-indigo-600 my-1" />
                                                <div className="h-4 w-4 bg-indigo-600 rounded-full border-2 border-slate-900 z-10" />
                                             </div>
                                             <div className="flex-1 space-y-5">
                                                <div>
                                                   <p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">Recoger en</p>
                                                   <p className="text-xs font-bold text-white leading-tight">{order.pickup_address}</p>
                                                </div>
                                                <div>
                                                   <p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">Entregar en</p>
                                                   <p className="text-xs font-bold text-white leading-tight">{order.delivery_address}</p>
                                                </div>
                                             </div>
                                          </div>
                                       </div>

                                       <Button 
                                          onClick={() => acceptOrder(order)}
                                          className="w-full h-16 rounded-3xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-lg shadow-xl shadow-indigo-600/30 grow-animation active:scale-95 transition-all"
                                       >
                                          ACEPTAR PEDIDO
                                       </Button>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="h-full w-full relative">
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
            ) : (
              <div className="h-full overflow-y-auto pt-4 pb-32">
                <DeliveryHistory />
              </div>
            )}
         </AnimatePresence>
      </main>

      {/* BOTTOM NAVIGATION GLASS */}
      <nav className="fixed bottom-0 inset-x-0 h-24 bg-slate-950/80 backdrop-blur-3xl border-t border-white/5 px-10 flex items-center justify-between z-[100] safe-bottom shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
          <button 
            onClick={() => setActiveTab('orders')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'orders' ? 'text-indigo-500 scale-110' : 'text-white/30'}`}
          >
              <LayoutGrid className="h-6 w-6" />
              <span className="text-[8px] font-black uppercase tracking-widest tracking-tighter">Panel</span>
          </button>
          
          <div 
            onClick={toggleAvailability}
            className={`h-20 w-20 -mt-14 rounded-[40%] flex items-center justify-center shadow-2xl transition-all active:scale-90 cursor-pointer border-4 border-slate-950 ${isAvailable ? 'bg-indigo-600 shadow-indigo-600/30' : 'bg-slate-800'}`}
          >
              <Bike className="h-9 w-9 text-white" />
          </div>

          <button 
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'history' ? 'text-indigo-500 scale-110' : 'text-white/30'}`}
          >
              <History className="h-6 w-6" />
              <span className="text-[8px] font-black uppercase tracking-widest tracking-tighter">Viajes</span>
          </button>
      </nav>

      {/* CSS Utilities for premium feel */}
      <style dangerouslySetInnerHTML={{ __html: `
        .safe-top { padding-top: max(1.5rem, env(safe-area-inset-top)); }
        .safe-bottom { padding-bottom: max(1.5rem, env(safe-area-inset-bottom)); }
        @keyframes grow {
          0% { transform: scale(1); }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
        .grow-animation { animation: grow 3s infinite ease-in-out; }
      `}} />
    </div>
  );
};

export default DriverApp;
