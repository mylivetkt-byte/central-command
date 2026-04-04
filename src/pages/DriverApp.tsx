import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Bike, LogOut, Package, History, Power,
  TrendingUp, User, Star, CheckCircle,
  BarChart2, X, Phone, Navigation,
  AlertCircle, XCircle, ChevronUp, ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import L from "leaflet";
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

type View = "map" | "history";

const SELECT_FIELDS =
  "id,order_id,customer_name,customer_phone,pickup_address,delivery_address,amount,commission,estimated_time,status,zone,pickup_lat,pickup_lng,delivery_lat,delivery_lng,notes";

const fmt = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

const geocode = async (address: string) => {
  try {
    const q = encodeURIComponent(`${address}, Bucaramanga, Colombia`);
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`);
    const d = await r.json();
    if (!d[0]) return null;
    return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
  } catch { return null; }
};

const fetchRoute = async (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.[0]) return null;
    const r = data.routes[0];
    return {
      coords: r.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]),
      distanceKm: r.distance / 1000,
      durationMin: Math.round(r.duration / 60),
    };
  } catch { return null; }
};

// ── DRIVER APP ──────────────────────────────────────────────────────────────
const DriverApp = () => {
  const { user, signOut } = useAuth();
  const { isTracking, currentLocation, startTracking, stopTracking } = useDriverLocation();

  const [pendingOrders, setPendingOrders] = useState<DeliveryOrder[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<DeliveryOrder | null>(null);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [currentView, setCurrentView] = useState<View>("map");
  const [statsOpen, setStatsOpen] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [pendingCardExpanded, setPendingCardExpanded] = useState(true);

  const notificationSound = useRef<HTMLAudioElement | null>(null);
  const gpsAutoStarted = useRef(false);
  const prevPendingCount = useRef(0);

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const deliveryMarkerRef = useRef<L.Marker | null>(null);
  const lastRouteFetchRef = useRef<number>(0);

  const isPickingUp = activeDelivery?.status === "aceptado";

  // ── Init sound ────────────────────────────────────────────────────────────
  useEffect(() => {
    notificationSound.current = new Audio(
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJavm66LcF93h5ammJZxX2V/k6Wlm4t0ZHaHlaOdlIBvZHOFk56cloR0aXWFlJ2bln95bnSEk5yblYJ5b3WEk5uZlIF5cHaDkpqYkoB5cXeDkpmXkX94cXeDkpmXkYB4"
    );
  }, []);

  // ── Auto-start GPS ────────────────────────────────────────────────────────
  useEffect(() => {
    if (user && !gpsAutoStarted.current && !isTracking) {
      gpsAutoStarted.current = true;
      startTracking();
    }
  }, [user, isTracking, startTracking]);

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
      center: [7.12, -73.12], // Bucaramanga default
      zoom: 15,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // ── Load profile & earnings ───────────────────────────────────────────────
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

  // ── Toggle availability ───────────────────────────────────────────────────
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

  // ── Fetch pending orders ──────────────────────────────────────────────────
  const fetchPending = useCallback(async () => {
    if (!isAvailable) { setPendingOrders([]); return; }
    const { data } = await supabase
      .from("deliveries").select(SELECT_FIELDS)
      .eq("status", "pendiente").is("driver_id", null)
      .order("created_at", { ascending: false });
    const orders = (data || []) as DeliveryOrder[];
    if (orders.length > prevPendingCount.current) notificationSound.current?.play().catch(() => { });
    prevPendingCount.current = orders.length;
    setPendingOrders(orders);
  }, [isAvailable]);

  // ── Fetch active delivery ─────────────────────────────────────────────────
  const fetchActive = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("deliveries").select(SELECT_FIELDS)
      .eq("driver_id", user.id).in("status", ["aceptado", "en_camino"]).maybeSingle();
    setActiveDelivery(data as DeliveryOrder | null);
  }, [user]);

  // ── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    fetchPending(); fetchActive();
    const ch = supabase.channel("driver-deliveries-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, () => {
        fetchPending(); fetchActive();
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, isAvailable, fetchPending, fetchActive]);

  // ── Accept order ──────────────────────────────────────────────────────────
  const acceptOrder = async (delivery: DeliveryOrder) => {
    if (!user || accepting) return;
    setAccepting(delivery.id);
    try {
      const { error } = await supabase
        .from("deliveries")
        .update({ driver_id: user.id, status: "aceptado" as any, accepted_at: new Date().toISOString() })
        .eq("id", delivery.id)
        .eq("status", "pendiente")
        .is("driver_id", null);
      if (error) { toast.error("No se pudo tomar el pedido"); return; }
      toast.success("¡Pedido tomado!");
      await supabase.from("delivery_audit_log").insert({
        delivery_id: delivery.id, event: "Pedido aceptado",
        details: "Aceptado por mensajero", performed_by: user.id,
      });
    } finally {
      setAccepting(null);
    }
  };

  // ── Update delivery status ────────────────────────────────────────────────
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
    if (newStatus === "entregado") {
      setTodayEarnings(e => e + Number(activeDelivery.commission));
    }
  };

  // ── Cancel delivery ───────────────────────────────────────────────────────
  const handleCancelDelivery = async () => {
    if (!user || !activeDelivery || !cancelReason.trim()) {
      toast.error("Describe el problema antes de cancelar");
      return;
    }
    setCancelling(true);
    try {
      await supabase.from("deliveries").update({
        status: "cancelado" as any, driver_id: null,
        cancelled_at: new Date().toISOString(),
      }).eq("id", activeDelivery.id);
      await supabase.from("delivery_audit_log").insert({
        delivery_id: activeDelivery.id, event: "Cancelada por mensajero",
        details: cancelReason, performed_by: user.id,
      });
      toast.success("Entrega cancelada");
      setShowCancel(false);
      setCancelReason("");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    } finally { setCancelling(false); }
  };

  // ── Update map markers & route for active delivery ────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeDelivery) return;

    const resolve = async () => {
      let pickup = activeDelivery.pickup_lat && activeDelivery.pickup_lng
        ? { lat: activeDelivery.pickup_lat, lng: activeDelivery.pickup_lng } : null;
      let del = activeDelivery.delivery_lat && activeDelivery.delivery_lng
        ? { lat: activeDelivery.delivery_lat, lng: activeDelivery.delivery_lng } : null;

      if (!pickup) pickup = await geocode(activeDelivery.pickup_address);
      if (!del) del = await geocode(activeDelivery.delivery_address);

      // Clear old markers
      if (pickupMarkerRef.current) { map.removeLayer(pickupMarkerRef.current); pickupMarkerRef.current = null; }
      if (deliveryMarkerRef.current) { map.removeLayer(deliveryMarkerRef.current); deliveryMarkerRef.current = null; }
      if (routeLayerRef.current) { map.removeLayer(routeLayerRef.current); routeLayerRef.current = null; }

      const makeIcon = (color: string, emoji: string) => L.divIcon({
        className: "",
        html: `<div style="width:36px;height:36px;background:${color};border-radius:50%;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:16px;">${emoji}</div>`,
        iconSize: [36, 36], iconAnchor: [18, 18],
      });

      if (pickup) {
        pickupMarkerRef.current = L.marker([pickup.lat, pickup.lng], {
          icon: makeIcon("#22c55e", "📦")
        }).addTo(map);
      }
      if (del) {
        deliveryMarkerRef.current = L.marker([del.lat, del.lng], {
          icon: makeIcon("#3b82f6", "🏠")
        }).addTo(map);
      }

      // Route from driver/pickup to destination
      const dest = isPickingUp ? pickup : del;
      const origin = currentLocation ? { lat: currentLocation.lat, lng: currentLocation.lng } : (isPickingUp ? null : pickup);

      if (origin && dest) {
        const route = await fetchRoute(origin, dest);
        if (route) {
          setRouteInfo({ distanceKm: route.distanceKm, durationMin: route.durationMin });
          routeLayerRef.current = L.polyline(route.coords, {
            color: isPickingUp ? "#22c55e" : "#3b82f6",
            weight: 6, opacity: 0.9, lineCap: "round", lineJoin: "round",
          }).addTo(map);
          map.fitBounds(routeLayerRef.current.getBounds(), { padding: [80, 80] });
        }
      } else if (dest) {
        map.setView([dest.lat, dest.lng], 15);
      }

      lastRouteFetchRef.current = Date.now();
    };

    resolve();
  }, [activeDelivery?.id, activeDelivery?.status]);

  // ── Update driver marker on location change ───────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentLocation) return;

    if (driverMarkerRef.current) map.removeLayer(driverMarkerRef.current);
    driverMarkerRef.current = L.marker([currentLocation.lat, currentLocation.lng], {
      icon: L.divIcon({
        className: "",
        html: `<div style="width:20px;height:20px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(59,130,246,.5);"><div style="width:6px;height:6px;background:white;border-radius:50%;margin:4px auto;"></div></div>`,
        iconSize: [20, 20], iconAnchor: [10, 10],
      }),
      zIndexOffset: 1000,
    }).addTo(map);

    // Center on driver if no active delivery
    if (!activeDelivery) {
      map.setView([currentLocation.lat, currentLocation.lng], map.getZoom() < 14 ? 15 : map.getZoom());
    }

    // Refresh route periodically
    if (activeDelivery && Date.now() - lastRouteFetchRef.current > 30_000) {
      // Trigger route update by re-setting the delivery
      lastRouteFetchRef.current = Date.now();
    }
  }, [currentLocation]);

  // ── Clear map when no active delivery ─────────────────────────────────────
  useEffect(() => {
    if (activeDelivery) return;
    const map = mapRef.current;
    if (!map) return;
    if (pickupMarkerRef.current) { map.removeLayer(pickupMarkerRef.current); pickupMarkerRef.current = null; }
    if (deliveryMarkerRef.current) { map.removeLayer(deliveryMarkerRef.current); deliveryMarkerRef.current = null; }
    if (routeLayerRef.current) { map.removeLayer(routeLayerRef.current); routeLayerRef.current = null; }
    setRouteInfo(null);
  }, [activeDelivery]);

  // ── Navigation helpers ────────────────────────────────────────────────────
  const openNav = (app: "google" | "waze") => {
    if (!activeDelivery) return;
    const dest = isPickingUp
      ? (activeDelivery.pickup_lat ? { lat: activeDelivery.pickup_lat, lng: activeDelivery.pickup_lng! } : null)
      : (activeDelivery.delivery_lat ? { lat: activeDelivery.delivery_lat, lng: activeDelivery.delivery_lng! } : null);
    const addr = isPickingUp ? activeDelivery.pickup_address : activeDelivery.delivery_address;
    if (app === "google") {
      window.open(dest
        ? `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=driving`
        : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}&travelmode=driving`, "_blank");
    } else {
      window.open(dest
        ? `https://waze.com/ul?ll=${dest.lat},${dest.lng}&navigate=yes`
        : `https://waze.com/ul?q=${encodeURIComponent(addr)}&navigate=yes`, "_blank");
    }
  };

  const profileInitials = (user?.user_metadata?.full_name || "M")
    .split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  const currentPending = pendingOrders[0]; // Show first pending order as card

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="h-[100dvh] flex flex-col bg-background relative overflow-hidden">

      {/* ── FULL-SCREEN MAP ─────────────────────────────────────────────── */}
      <div className="absolute inset-0 z-0">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* ── FLOATING HEADER ─────────────────────────────────────────────── */}
      <div className="relative z-20 safe-area-top">
        <div className="mx-3 mt-3 flex items-center gap-2">

          {/* Avatar */}
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm font-bold text-primary-foreground shrink-0 shadow-lg">
            {profileInitials}
          </div>

          {/* Availability toggle */}
          <div className="flex items-center gap-2 bg-card/95 backdrop-blur-xl border border-border/40 rounded-2xl px-3 py-2 shadow-lg">
            <Power className={`h-4 w-4 shrink-0 ${isAvailable ? "text-accent" : "text-muted-foreground"}`} />
            <Switch
              checked={isAvailable}
              onCheckedChange={toggleAvailability}
              className="data-[state=checked]:bg-accent scale-90"
            />
            <span className="text-xs font-semibold text-foreground">
              {isAvailable ? "En línea" : "Desconectado"}
            </span>
          </div>

          <div className="flex-1" />

          {/* GPS indicator */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl shadow-lg text-[10px] font-semibold ${isTracking ? "bg-accent/90 text-white" : "bg-card/95 text-muted-foreground border border-border/40"
            }`}>
            <span className={`h-2 w-2 rounded-full ${isTracking ? "bg-white animate-pulse" : "bg-muted-foreground"}`} />
            GPS
          </div>

          {/* Stats button */}
          <button
            onClick={() => setStatsOpen(v => !v)}
            className={`h-10 w-10 rounded-full flex items-center justify-center shadow-lg transition-colors ${statsOpen ? "bg-primary text-primary-foreground" : "bg-card/95 backdrop-blur-xl text-muted-foreground border border-border/40"
              }`}
          >
            <BarChart2 className="h-4 w-4" />
          </button>

          {/* Logout */}
          <button
            onClick={signOut}
            className="h-10 w-10 rounded-full bg-card/95 backdrop-blur-xl flex items-center justify-center text-muted-foreground border border-border/40 shadow-lg hover:text-destructive transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── STATS PANEL ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {statsOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setStatsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute right-3 top-16 z-40 w-72 bg-card border border-border/60 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <p className="text-sm font-bold text-foreground">Mis estadísticas</p>
                <button onClick={() => setStatsOpen(false)} className="h-7 w-7 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="px-4 pb-4 space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/10 border border-accent/20">
                  <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-xl font-extrabold text-accent leading-none">{fmt(todayEarnings)}</p>
                    <p className="text-[11px] text-muted-foreground">Ganancias hoy</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2.5 rounded-xl bg-muted/50 border border-border/30">
                    <p className="text-lg font-extrabold text-foreground">{driverProfile?.total_deliveries ?? 0}</p>
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Entregas</p>
                  </div>
                  <div className="text-center p-2.5 rounded-xl bg-muted/50 border border-border/30">
                    <div className="flex items-center justify-center gap-0.5">
                      <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                      <p className="text-lg font-extrabold text-foreground">{driverProfile?.rating ?? "0.0"}</p>
                    </div>
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Rating</p>
                  </div>
                  <div className="text-center p-2.5 rounded-xl bg-muted/50 border border-border/30">
                    <p className="text-lg font-extrabold text-foreground">{driverProfile?.acceptance_rate ?? 100}%</p>
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Acepta.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── ACTIVE DELIVERY: PHASE BADGE ────────────────────────────────── */}
      {activeDelivery && (
        <div className="absolute top-20 left-3 z-20">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl shadow-lg font-bold text-sm ${isPickingUp ? "bg-amber-500 text-white" : "bg-blue-600 text-white"
            }`}>
            {isPickingUp ? <><Package className="h-4 w-4" /> Ir a recoger</> : <><Bike className="h-4 w-4" /> En camino al cliente</>}
          </div>
        </div>
      )}

      {/* ── ACTIVE DELIVERY: ETA BADGE ──────────────────────────────────── */}
      {activeDelivery && routeInfo && (
        <div className="absolute top-20 right-3 z-20">
          <div className="bg-card/95 backdrop-blur-xl rounded-2xl px-4 py-2 shadow-lg border border-border/30 text-right">
            <p className="text-2xl font-extrabold text-foreground leading-none">
              {routeInfo.durationMin} <span className="text-sm font-normal text-muted-foreground">min</span>
            </p>
            <p className="text-xs text-muted-foreground">{routeInfo.distanceKm.toFixed(1)} km</p>
          </div>
        </div>
      )}

      {/* ── NAVIGATION BUTTONS (active delivery) ───────────────────────── */}
      {activeDelivery && (
        <div className="absolute right-3 bottom-[280px] z-20 flex flex-col gap-2">
          <button onClick={() => openNav("google")}
            className="flex items-center gap-2 bg-white text-gray-800 font-semibold text-xs px-3 py-2.5 rounded-xl shadow-lg border border-gray-200">
            <Navigation className="h-4 w-4 text-blue-600" /> Google Maps
          </button>
          <button onClick={() => openNav("waze")}
            className="flex items-center gap-2 bg-[#05C8F7] text-white font-semibold text-xs px-3 py-2.5 rounded-xl shadow-lg">
            <Navigation className="h-4 w-4" /> Waze
          </button>
        </div>
      )}

      {/* ── BOTTOM PANEL ────────────────────────────────────────────────── */}
      <div className="relative z-20 mt-auto">

        {/* ── ACTIVE DELIVERY PANEL ───────────────────────────────────── */}
        {activeDelivery && (
          <div className="bg-card rounded-t-3xl border-t border-border/50 shadow-2xl" style={{ marginTop: "-1rem" }}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="px-5 pb-6 space-y-3 max-h-[45vh] overflow-y-auto">
              {/* Current destination */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {isPickingUp ? "Ir a recoger en" : "Entregar en"}
                </p>
                <p className="text-base font-bold text-foreground leading-snug">
                  {isPickingUp ? activeDelivery.pickup_address : activeDelivery.delivery_address}
                </p>
              </div>

              {/* Route summary */}
              <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="h-2.5 w-2.5 rounded-full bg-accent shrink-0" />
                  <span className="text-xs text-muted-foreground truncate">{activeDelivery.pickup_address}</span>
                </div>
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
                  <span className="text-xs text-muted-foreground truncate">{activeDelivery.delivery_address}</span>
                </div>
              </div>

              {/* Customer + payment */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-accent/10 border border-accent/20">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{activeDelivery.customer_name}</p>
                    <p className="text-[10px] text-muted-foreground">#{activeDelivery.order_id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-base font-extrabold text-foreground">{fmt(Number(activeDelivery.amount))}</p>
                    <p className="text-[10px] text-muted-foreground">Cobrar</p>
                  </div>
                  <div className="text-right border-l border-accent/30 pl-3">
                    <p className="text-base font-extrabold text-accent">{fmt(Number(activeDelivery.commission))}</p>
                    <p className="text-[10px] text-muted-foreground">Tu ganancia</p>
                  </div>
                </div>
              </div>

              {/* Call customer */}
              {activeDelivery.customer_phone && (
                <a href={`tel:${activeDelivery.customer_phone}`}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                  <div className="h-9 w-9 rounded-full bg-accent/20 flex items-center justify-center">
                    <Phone className="h-4 w-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Llamar al cliente</p>
                    <p className="text-xs text-muted-foreground">{activeDelivery.customer_phone}</p>
                  </div>
                </a>
              )}

              {/* Notes */}
              {activeDelivery.notes && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">{activeDelivery.notes}</p>
                </div>
              )}

              {/* Action button */}
              {isPickingUp && (
                <Button onClick={() => updateDeliveryStatus("en_camino")}
                  className="w-full h-14 rounded-2xl bg-amber-500 hover:bg-amber-500/90 text-white font-bold text-base shadow-lg">
                  <Package className="h-5 w-5 mr-2" /> Ya recogí el pedido
                </Button>
              )}
              {activeDelivery.status === "en_camino" && (
                <Button onClick={() => updateDeliveryStatus("entregado")}
                  className="w-full h-14 rounded-2xl bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-base shadow-lg">
                  <CheckCircle className="h-5 w-5 mr-2" /> Entrega completada ✓
                </Button>
              )}

              {/* Cancel */}
              <button onClick={() => setShowCancel(!showCancel)}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors py-1">
                <XCircle className="h-3.5 w-3.5" />
                {showCancel ? "Cerrar" : "Reportar problema"}
              </button>
              <AnimatePresence>
                {showCancel && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="space-y-2">
                      <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                        placeholder="Describe el problema..." rows={2}
                        className="w-full rounded-xl bg-muted/50 border border-border/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/50 resize-none" />
                      <Button variant="destructive" onClick={handleCancelDelivery} disabled={cancelling || !cancelReason.trim()}
                        className="w-full h-11 rounded-xl font-semibold">
                        {cancelling ? "Cancelando..." : "Cancelar y liberar pedido"}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* ── PENDING ORDER CARD (slide-up, like DiDi) ────────────────── */}
        {!activeDelivery && currentPending && isAvailable && (
          <AnimatePresence>
            <motion.div
              key={currentPending.id}
              initial={{ y: 300, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 300, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-card rounded-t-3xl border-t border-border/50 shadow-2xl"
            >
              <div className="flex justify-center pt-3 pb-1 cursor-pointer" onClick={() => setPendingCardExpanded(v => !v)}>
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>

              <div className="px-5 pb-5 space-y-3">
                {/* Header: new order notification */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-accent animate-pulse" />
                    <span className="text-sm font-bold text-foreground">Nuevo pedido disponible</span>
                  </div>
                  {pendingOrders.length > 1 && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
                      +{pendingOrders.length - 1} más
                    </span>
                  )}
                </div>

                {/* Commission highlight */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-accent/10 border border-accent/20">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-2xl font-extrabold text-accent leading-none">{fmt(Number(currentPending.commission))}</p>
                      <p className="text-[10px] text-muted-foreground">Tu ganancia</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-foreground">{fmt(Number(currentPending.amount))}</p>
                    <p className="text-[10px] text-muted-foreground">Cliente paga</p>
                  </div>
                </div>

                <AnimatePresence>
                  {pendingCardExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-3 overflow-hidden"
                    >
                      {/* Route */}
                      <div className="relative pl-5 space-y-2.5">
                        <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-gradient-to-b from-accent to-primary" />
                        <div className="relative">
                          <div className="absolute -left-5 top-1 h-3.5 w-3.5 rounded-full bg-accent flex items-center justify-center">
                            <div className="h-1.5 w-1.5 rounded-full bg-white" />
                          </div>
                          <p className="text-[10px] uppercase tracking-wider text-accent font-semibold">Recoger</p>
                          <p className="text-sm text-foreground leading-tight">{currentPending.pickup_address}</p>
                        </div>
                        <div className="relative">
                          <div className="absolute -left-5 top-1 h-3.5 w-3.5 rounded-full bg-primary flex items-center justify-center">
                            <div className="h-1.5 w-1.5 rounded-full bg-white" />
                          </div>
                          <p className="text-[10px] uppercase tracking-wider text-primary font-semibold">Entregar</p>
                          <p className="text-sm text-foreground leading-tight">{currentPending.delivery_address}</p>
                        </div>
                      </div>

                      {/* Customer */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{currentPending.customer_name}</span>
                        <span>~{currentPending.estimated_time ?? "?"} min • {currentPending.zone || "Sin zona"}</span>
                      </div>

                      {currentPending.notes && (
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-700 dark:text-amber-400">{currentPending.notes}</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setPendingOrders(prev => prev.filter(o => o.id !== currentPending.id))}
                    disabled={!!accepting}
                    className="flex-1 h-14 rounded-2xl text-destructive border-destructive/30 hover:bg-destructive/10 font-semibold text-base">
                    Rechazar
                  </Button>
                  <Button onClick={() => acceptOrder(currentPending)}
                    disabled={!!accepting}
                    className="flex-[2] h-14 rounded-2xl bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-base shadow-lg">
                    {accepting === currentPending.id
                      ? <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Tomando...</span>
                      : `Aceptar pedido`
                    }
                  </Button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── IDLE STATE (no orders, no active) ──────────────────────── */}
        {!activeDelivery && !currentPending && (
          <div className="bg-card/95 backdrop-blur-xl rounded-t-3xl border-t border-border/50 shadow-2xl px-5 py-6">
            {isAvailable ? (
              <div className="text-center">
                <div className="h-12 w-12 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-2">
                  <Bike className="h-6 w-6 text-accent" />
                </div>
                <p className="text-sm font-semibold text-foreground">Esperando pedidos...</p>
                <p className="text-xs text-muted-foreground mt-1">Te notificaremos cuando haya uno nuevo</p>
                {todayEarnings > 0 && (
                  <p className="text-xs text-accent font-semibold mt-2">Hoy llevas {fmt(todayEarnings)}</p>
                )}
              </div>
            ) : (
              <div className="text-center">
                <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-2">
                  <Power className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-muted-foreground">Estás desconectado</p>
                <p className="text-xs text-muted-foreground/60 mt-1 mb-3">Activa para recibir pedidos</p>
                <Button onClick={toggleAvailability}
                  className="rounded-xl bg-accent text-accent-foreground font-bold px-6">
                  <Power className="h-4 w-4 mr-2" /> Conectarme
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── BOTTOM TAB BAR ─────────────────────────────────────────── */}
        <div className="bg-card border-t border-border/30 flex safe-area-bottom">
          <button
            onClick={() => setCurrentView("map")}
            className={`flex-1 flex flex-col items-center gap-1 py-3 ${currentView === "map" ? "text-primary" : "text-muted-foreground"}`}
          >
            <Navigation className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Mapa</span>
          </button>
          <button
            onClick={() => setCurrentView("history")}
            className={`flex-1 flex flex-col items-center gap-1 py-3 ${currentView === "history" ? "text-primary" : "text-muted-foreground"}`}
          >
            <History className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Historial</span>
          </button>
        </div>
      </div>

      {/* ── HISTORY OVERLAY ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {currentView === "history" && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute inset-0 z-30 bg-background overflow-y-auto"
          >
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border/30 px-4 py-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Historial de entregas</h2>
              <button onClick={() => setCurrentView("map")}
                className="h-8 w-8 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">
              <DeliveryHistory />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DriverApp;
