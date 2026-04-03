import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import {
  Package, History, Power, LogOut, Star,
  CheckCircle, Clock, DollarSign, ChevronRight,
  MapPin, Bike, Navigation, LayoutGrid
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
}

type Tab = "orders" | "history" | "stats";

const DriverApp = () => {
  const { user, signOut } = useAuth();
  const [pendingOrders, setPendingOrders] = useState<DeliveryOrder[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<DeliveryOrder | null>(null);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<Tab>("orders");
  const [isAvailable, setIsAvailable] = useState(false);
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const { isTracking, currentLocation, startTracking, stopTracking } = useDriverLocation();
  
  const notificationSound = useRef<HTMLAudioElement | null>(null);
  const arrivalSound = useRef<HTMLAudioElement | null>(null);
  const gpsAutoStarted = useRef(false);
  const prevPendingCount = useRef(0);
  const hasAnnouncedArrival = useRef(false);

  // Bloquear scroll del body para sentirlo como App
  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.overflow = "auto";
      document.body.style.overscrollBehavior = "auto";
    };
  }, []);

  // Sonidos
  useEffect(() => {
    notificationSound.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3");
    arrivalSound.current = new Audio("https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3");
  }, []);

  // Tracking de distancia
  useEffect(() => {
    if (!activeDelivery || !currentLocation) {
        hasAnnouncedArrival.current = false;
        return;
    }
    const targetPoint = activeDelivery.status === 'aceptado' 
        ? { lat: activeDelivery.pickup_lat, lng: activeDelivery.pickup_lng }
        : { lat: activeDelivery.delivery_lat, lng: activeDelivery.delivery_lng };

    if (!targetPoint.lat || !targetPoint.lng) return;

    const R = 6371;
    const dLat = (targetPoint.lat - currentLocation.lat) * Math.PI / 180;
    const dLng = (targetPoint.lng - currentLocation.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(currentLocation.lat * Math.PI / 180) * Math.cos(targetPoint.lat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;

    if (distanceKm < 0.1 && !hasAnnouncedArrival.current) {
        arrivalSound.current?.play().catch(() => {});
        toast.info("📍 ¡Estás llegando al destino!", { position: "top-center" });
        hasAnnouncedArrival.current = true;
    } else if (distanceKm > 0.15) {
        hasAnnouncedArrival.current = false;
    }
  }, [currentLocation, activeDelivery]);

  // GPS auto-start
  useEffect(() => {
    if (user && !gpsAutoStarted.current && !isTracking) {
      gpsAutoStarted.current = true;
      startTracking();
    }
  }, [user, isTracking, startTracking]);

  // Cargar perfil
  useEffect(() => {
    if (!user) return;
    supabase
      .from("driver_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const d = data as any;
        setDriverProfile(d);
        if (d) setIsAvailable(d.status === "activo" || d.status === "en_ruta");
      });
  }, [user]);

  // Toggle disponibilidad
  const toggleAvailability = async () => {
    if (!user || togglingAvailability) return;
    setTogglingAvailability(true);
    const newStatus = isAvailable ? "inactivo" : "activo";
    const { error } = await (supabase.from("driver_profiles") as any)
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) { toast.error("Error al cambiar disponibilidad"); setTogglingAvailability(false); return; }
    setIsAvailable(!isAvailable);
    setDriverProfile((prev: any) => prev ? { ...prev, status: newStatus } : prev);
    toast.success(isAvailable ? "Estás desconectado" : "¡Estás en línea!");

    if (isAvailable && isTracking) stopTracking();
    else if (!isAvailable && !isTracking) startTracking();
    setTogglingAvailability(false);
  };

  // Fetch pedidos
  useEffect(() => {
    if (!user) return;
    const fetchPending = async () => {
      if (!isAvailable) { setPendingOrders([]); return; }
      const { data, error } = await supabase.from("pending_delivery_offers").select("*").order("created_at", { ascending: false });
      if (error) return;

      const orders: DeliveryOrder[] = (data || []).map((d: any) => ({
        ...d,
        amount: Number(d.amount || 0),
        commission: Number(d.commission || 0),
        customer_name: "Cliente VIP",
      }));

      if (orders.length > prevPendingCount.current) {
        notificationSound.current?.play().catch(() => { });
        toast("🔔 ¡Nuevo pedido disponible!", { position: "top-center" });
      }
      prevPendingCount.current = orders.length;
      setPendingOrders(orders);
    };

    const fetchActive = async () => {
      const { data } = await supabase.from("deliveries").select("*").eq("driver_id", user.id).in("status", ["aceptado", "en_camino"]).maybeSingle();
      setActiveDelivery(data as any);
    };

    fetchPending();
    fetchActive();
    const channel = supabase.channel("driver-realtime-global")
      .on("postgres_changes", { 
        event: "*", 
        schema: "public", 
        table: "deliveries" 
      }, (payload) => {
        console.log("Realtime update received:", payload);
        fetchActive();
        // Cuando cambia el estado de un pedido (ej: se publica uno nuevo o alguien lo toma),
        // refrescamos la lista de pendientes.
        fetchPending();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, isAvailable]);

  // ACEPTAR PEDIDO (CONCURRENCIA CONTROLADA)
  const acceptOrder = async (order: DeliveryOrder) => {
    if (!user) return;
    
    // Solo permitimos aceptar si sigue "pendiente" y no tiene driver
    const { data, error } = await (supabase.from("deliveries") as any)
      .update({ 
        driver_id: user.id, 
        status: "aceptado",
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", order.id)
      .eq("status", "pendiente")
      .is("driver_id", null)
      .select();

    if (error) { toast.error("Error al aceptar pedido"); return; }
    if (!data || data.length === 0) {
      toast.error("¡Demasiado tarde! Otro mensajero ya tomó este pedido.");
      return;
    }

    toast.success("¡Pedido aceptado! Iniciando navegación.");
    setActiveDelivery(data[0] as any);
  };

  const updateDeliveryStatus = async (newStatus: string) => {
    if (!activeDelivery || !user) return;
    const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === "en_camino") updates.picked_up_at = new Date().toISOString();
    if (newStatus === "entregado") updates.delivered_at = new Date().toISOString();

    const { error } = await (supabase.from("deliveries") as any).update(updates).eq("id", activeDelivery.id);
    if (error) return;

    toast.success(newStatus === "entregado" ? "¡Entrega completada! 🎉" : "Estado actualizado");
    if (newStatus === "entregado") setActiveDelivery(null);
  };

  if (activeDelivery) {
    return (
      <div className="fixed inset-0 h-screen w-screen bg-background flex flex-col overflow-hidden">
        <header className="safe-top bg-card/95 backdrop-blur-xl border-b border-border/30 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary/20 p-1.5 rounded-lg">
                <Bike className="h-5 w-5 text-primary" />
            </div>
            <span className="text-base font-black tracking-tight">EN RUTA</span>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Estado GPS</span>
                <span className={`text-[10px] font-bold ${isTracking ? 'text-green-500' : 'text-destructive'}`}>
                    {isTracking ? 'CONECTADO' : 'ERROR GPS'}
                </span>
             </div>
             <div className={`h-2.5 w-2.5 rounded-full ${isTracking ? "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500"}`} />
          </div>
        </header>
        <div className="flex-1 overflow-hidden relative">
          <ActiveDeliveryView
            delivery={activeDelivery as any}
            currentLocation={currentLocation}
            onPickedUp={() => updateDeliveryStatus("en_camino")}
            onDelivered={() => updateDeliveryStatus("entregado")}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 h-screen w-screen bg-background flex flex-col overflow-hidden select-none">
      <header className="safe-top bg-card border-b border-border/30 px-6 pt-6 pb-4 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/60 p-[2px] shadow-lg">
                <div className="h-full w-full rounded-[14px] bg-card flex items-center justify-center font-black text-primary text-lg">
                    {user?.user_metadata?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "M"}
                </div>
            </div>
            <div>
              <h1 className="text-lg font-black leading-none">{user?.user_metadata?.full_name || "Mensajero"}</h1>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 font-medium">
                <LayoutGrid className="h-3 w-3" /> ID: {user?.id.slice(0, 8)}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => signOut()} className="rounded-xl h-11 w-11 bg-muted/50">
            <LogOut className="h-5 w-5 text-destructive" />
          </Button>
        </div>

        <div className={`flex items-center justify-between p-3 rounded-2xl transition-all duration-500 ${isAvailable ? 'bg-green-500/10 border border-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.05)]' : 'bg-muted/50 border border-transparent'}`}>
           <div className="flex items-center gap-3">
              <div className={`h-2.5 w-2.5 rounded-full shadow-lg ${isAvailable ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
              <span className={`text-sm font-bold ${isAvailable ? 'text-green-500' : 'text-muted-foreground'}`}>
                {isAvailable ? 'MODO: RECIBIENDO PEDIDOS' : 'MODO: DESCONECTADO'}
              </span>
           </div>
           <Switch
             checked={isAvailable}
             onCheckedChange={toggleAvailability}
             disabled={togglingAvailability}
             className="data-[state=checked]:bg-green-500"
           />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-32 space-y-4 bg-slate-50/30">
         <div className="flex items-center p-1 bg-muted/50 rounded-2xl">
            <button 
                onClick={() => setActiveTab('orders')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[14px] text-sm font-bold transition-all ${activeTab === 'orders' ? 'bg-card text-foreground shadow-lg' : 'text-muted-foreground'}`}
            >
                <Package className={`h-4 w-4 ${activeTab === 'orders' ? 'text-primary' : ''}`} /> Disponibles 
                <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === 'orders' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                    {pendingOrders.length}
                </span>
            </button>
            <button 
                onClick={() => setActiveTab('history')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[14px] text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-card text-foreground shadow-lg' : 'text-muted-foreground'}`}
            >
                <History className={`h-4 w-4 ${activeTab === 'history' ? 'text-primary' : ''}`} /> Historial
            </button>
         </div>

         <AnimatePresence mode="wait">
            {activeTab === 'orders' ? (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-4">
                    {pendingOrders.length === 0 ? (
                        <div className="text-center py-24 px-10">
                            <div className="w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Package className="h-10 w-10 text-muted-foreground/30" />
                            </div>
                            <p className="text-base font-bold text-muted-foreground/60">Buscando envíos cerca de ti...</p>
                            <p className="text-xs text-muted-foreground/40 mt-2">Los pedidos aparecerán aquí apenas sean publicados por la central</p>
                        </div>
                    ) : (
                        pendingOrders.map(order => (
                            <OrderCard 
                                key={order.id} 
                                order={order} 
                                onAccept={() => acceptOrder(order)}
                                onReject={() => toast.info("Pedido ocultado localmente.")}   
                            />
                        ))
                    )}
                </motion.div>
            ) : (
                <DeliveryHistory key="history" />
            )}
         </AnimatePresence>
      </main>

      {/* Tab Bar Estilo App */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-2xl border-t border-border/10 px-8 py-3 flex items-center justify-between z-50 transition-transform safe-bottom h-[85px]">
          <button 
            onClick={() => toast.info("Sistema de Premios próximamente")}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'stats' ? 'text-primary' : 'text-muted-foreground opacity-50'}`}
          >
              <Star className="h-6 w-6" />
              <span className="text-[10px] font-black uppercase tracking-tighter">Premios</span>
          </button>
          <div 
            onClick={() => setActiveTab('orders')}
            className="bg-primary p-4 rounded-3xl -mt-14 border-8 border-background shadow-[0_20px_40px_rgba(59,130,246,0.4)] relative active:scale-95 transition-transform cursor-pointer"
          >
              <Bike className="h-7 w-7 text-white" />
              {isAvailable && <div className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-green-500 rounded-full border-[3px] border-background animate-pulse" />}
          </div>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'history' ? 'text-primary' : 'text-muted-foreground opacity-50'}`}
          >
              <DollarSign className="h-6 w-6" />
              <span className="text-[10px] font-black uppercase tracking-tighter">Mis Ganancias</span>
          </button>
      </nav>
    </div>
  );
};

const Button = ({ children, variant, size, onClick, className, disabled }: any) => {
    const variants: any = {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-xl',
        ghost: 'hover:bg-accent/10 hover:text-accent-foreground',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    };
    const sizes: any = {
        sm: 'h-9 px-4 text-xs font-bold rounded-xl',
        icon: 'h-11 w-11 rounded-2xl',
    };
    return (
        <button 
            disabled={disabled}
            onClick={onClick} 
            className={`inline-flex items-center justify-center transition-all focus:outline-none disabled:opacity-50 active:scale-95 ${variants[variant || 'default']} ${sizes[size] || 'h-12 px-6 py-2 rounded-2xl'} ${className}`}
        >
            {children}
        </button>
    );
};

export default DriverApp;
