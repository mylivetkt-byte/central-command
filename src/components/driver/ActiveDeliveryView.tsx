import { motion, AnimatePresence } from "framer-motion";
import {
  Phone, Navigation, CheckCircle,
  Bike, Package, User, ArrowRight,
  AlertCircle, XCircle, ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Delivery {
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
}

interface Props {
  delivery: Delivery;
  onPickedUp: () => void;
  onDelivered: () => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

const fetchRoute = async (from: {lat:number;lng:number}, to: {lat:number;lng:number}) => {
  try {
    const res  = await fetch(`https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.[0]) return null;
    const r = data.routes[0];
    return {
      coords:      r.geometry.coordinates.map(([lng,lat]: [number,number]) => [lat,lng] as [number,number]),
      distanceKm:  r.distance / 1000,
      durationMin: Math.round(r.duration / 60),
    };
  } catch { return null; }
};

const geocode = async (address: string) => {
  try {
    const q = encodeURIComponent(`${address}, Bucaramanga, Colombia`);
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`);
    const d = await r.json();
    if (!d[0]) return null;
    return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
  } catch { return null; }
};

const ActiveDeliveryView = ({ delivery, onPickedUp, onDelivered }: Props) => {
  const { user }             = useAuth();
  const { currentLocation }  = useDriverLocation();
  const [expanded, setExpanded]   = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{distanceKm:number;durationMin:number}|null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);

  const isPickingUp = delivery.status === "aceptado";

  const mapRef          = useRef<L.Map|null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const driverMarkerRef = useRef<L.Marker|null>(null);
  const routeLayerRef   = useRef<L.Polyline|null>(null);
  const pickupMarkerRef = useRef<L.Marker|null>(null);
  const deliveryMarkerRef = useRef<L.Marker|null>(null);
  const lastRouteFetchRef = useRef<number>(0);

  const [coords, setCoords] = useState<{
    pickup: {lat:number;lng:number}|null;
    delivery: {lat:number;lng:number}|null;
  }>({ pickup: null, delivery: null });

  // ── Screen Wake Lock — evita que la pantalla se apague mientras conduce ──
  useEffect(() => {
    const acquire = async () => {
      try {
        if ("wakeLock" in navigator) {
          const wl = await (navigator as any).wakeLock.request("screen");
          setWakeLock(wl);
        }
      } catch {}
    };
    acquire();

    // Re-adquirir si el tab vuelve a estar visible
    const handleVisibility = () => {
      if (document.visibilityState === "visible") acquire();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      wakeLock?.release().catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Resolver coordenadas ──────────────────────────────────────────────────
  useEffect(() => {
    const p = delivery.pickup_lat && delivery.pickup_lng
      ? { lat: delivery.pickup_lat, lng: delivery.pickup_lng } : null;
    const d = delivery.delivery_lat && delivery.delivery_lng
      ? { lat: delivery.delivery_lat, lng: delivery.delivery_lng } : null;

    if (p && d) { setCoords({ pickup: p, delivery: d }); return; }

    setGeocoding(true);
    Promise.all([
      p ?? geocode(delivery.pickup_address),
      d ?? geocode(delivery.delivery_address),
    ]).then(([pickup, del]) => {
      setCoords({ pickup, delivery: del });
      setGeocoding(false);
    });
  }, [delivery.id]);

  // ── Inicializar mapa ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    mapRef.current = L.map(mapContainerRef.current, { zoomControl: false, attributionControl: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(mapRef.current);
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  // ── Actualizar ruta ──────────────────────────────────────────────────────
  const updateRoute = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const dest   = isPickingUp ? coords.pickup : coords.delivery;
    const origin = currentLocation ? { lat: currentLocation.lat, lng: currentLocation.lng } : coords.pickup;
    if (!dest || !origin) return;
    const now = Date.now();
    if (now - lastRouteFetchRef.current < 30_000) return;
    lastRouteFetchRef.current = now;

    const route = await fetchRoute(origin, dest);
    if (routeLayerRef.current) { map.removeLayer(routeLayerRef.current); routeLayerRef.current = null; }
    if (route) {
      setRouteInfo({ distanceKm: route.distanceKm, durationMin: route.durationMin });
      routeLayerRef.current = L.polyline(route.coords, {
        color: isPickingUp ? "#22c55e" : "#3b82f6",
        weight: 5, opacity: 0.85, lineCap: "round", lineJoin: "round",
      }).addTo(map);
    }
    map.fitBounds([[origin.lat, origin.lng], [dest.lat, dest.lng]] as L.LatLngBoundsExpression, { padding: [60,60] });
  }, [currentLocation, coords, isPickingUp]);

  // ── Marcadores ───────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const makeIcon = (color: string, svg: string) => L.divIcon({
      className: "",
      html: `<div style="width:32px;height:32px;background:${color};border-radius:50%;border:3px solid white;box-shadow:0 3px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;">${svg}</div>`,
      iconSize: [32,32], iconAnchor: [16,16],
    });
    if (pickupMarkerRef.current) map.removeLayer(pickupMarkerRef.current);
    if (coords.pickup)
      pickupMarkerRef.current = L.marker([coords.pickup.lat, coords.pickup.lng], {
        icon: makeIcon("#22c55e", `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`)
      }).bindTooltip("📦 Recogida").addTo(map);

    if (deliveryMarkerRef.current) map.removeLayer(deliveryMarkerRef.current);
    if (coords.delivery)
      deliveryMarkerRef.current = L.marker([coords.delivery.lat, coords.delivery.lng], {
        icon: makeIcon("#3b82f6", `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`)
      }).bindTooltip(`🏠 ${delivery.customer_name}`).addTo(map);

    lastRouteFetchRef.current = 0;
    updateRoute();
  }, [coords]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentLocation) return;
    if (driverMarkerRef.current) map.removeLayer(driverMarkerRef.current);
    driverMarkerRef.current = L.marker([currentLocation.lat, currentLocation.lng], {
      icon: L.divIcon({
        className: "",
        html: `<div style="width:26px;height:26px;background:#f59e0b;border-radius:50%;border:3px solid white;box-shadow:0 3px 8px rgba(0,0,0,.4);"></div>`,
        iconSize: [26,26], iconAnchor: [13,13],
      }),
      zIndexOffset: 1000,
    }).addTo(map);
    updateRoute();
  }, [currentLocation]);

  const openNav = (app: "google"|"waze") => {
    const dest = isPickingUp ? coords.pickup : coords.delivery;
    const addr = isPickingUp ? delivery.pickup_address : delivery.delivery_address;
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

  // ── Cancelar entrega activa ───────────────────────────────────────────────
  const handleCancelDelivery = async () => {
    if (!user || !cancelReason.trim()) {
      toast.error("Describe el problema antes de cancelar");
      return;
    }
    setCancelling(true);
    try {
      const { error } = await supabase.from("deliveries").update({
        status:       "cancelado",
        driver_id:    null,
        cancelled_at: new Date().toISOString(),
      }).eq("id", delivery.id);
      if (error) throw error;

      await supabase.from("delivery_audit_log").insert({
        delivery_id:  delivery.id,
        event:        "Entrega cancelada por mensajero",
        details:      cancelReason,
        performed_by: user.id,
      });

      toast.success("Entrega cancelada. El pedido volvió a estar disponible.");
      setShowCancel(false);
    } catch (e: any) {
      toast.error("Error al cancelar: " + e.message);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full">

      {/* ── MAPA ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative bg-muted min-h-[45vh]">
        <div ref={mapContainerRef} className="absolute inset-0" />

        <AnimatePresence>
          {geocoding && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-[500] flex items-center justify-center bg-background/60 backdrop-blur-sm">
              <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-xl shadow-lg">
                <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium">Calculando ruta...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fase actual */}
        <div className="absolute top-4 left-4 z-[400]">
          <Badge className={`px-3 py-1.5 text-xs font-bold rounded-xl shadow-lg ${
            isPickingUp ? "bg-amber-500/95 text-white" : "bg-blue-600/95 text-white"
          }`}>
            {isPickingUp
              ? <><Package className="h-3.5 w-3.5 mr-1.5 inline" />Recogiendo</>
              : <><Bike className="h-3.5 w-3.5 mr-1.5 inline" />En camino a cliente</>
            }
          </Badge>
        </div>

        {/* ETA */}
        {routeInfo && (
          <div className="absolute top-4 right-4 z-[400]">
            <div className="bg-card/95 backdrop-blur-xl rounded-2xl px-4 py-2 shadow-lg border border-border/30 text-right">
              <p className="text-xl font-extrabold text-foreground leading-none">
                {routeInfo.durationMin} <span className="text-sm font-normal text-muted-foreground">min</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{routeInfo.distanceKm.toFixed(1)} km</p>
            </div>
          </div>
        )}

        {/* Sin coordenadas */}
        {!geocoding && !coords.pickup && !coords.delivery && (
          <div className="absolute bottom-24 left-4 right-4 z-[400]">
            <div className="flex items-center gap-2 bg-amber-500/90 text-white rounded-xl px-3 py-2 text-xs font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              No se pudo calcular la ruta. Usa Google Maps o Waze.
            </div>
          </div>
        )}

        {/* Botones navegación */}
        <div className="absolute bottom-4 right-4 z-[400] flex flex-col gap-2">
          <button onClick={() => openNav("google")}
            className="flex items-center gap-2 bg-white text-gray-800 font-semibold text-xs px-3 py-2 rounded-xl shadow-lg border border-gray-200">
            <Navigation className="h-4 w-4 text-blue-600" /> Google Maps
          </button>
          <button onClick={() => openNav("waze")}
            className="flex items-center gap-2 bg-[#05C8F7] text-white font-semibold text-xs px-3 py-2 rounded-xl shadow-lg">
            <Navigation className="h-4 w-4" /> Waze
          </button>
        </div>

        {/* GPS status */}
        <div className="absolute bottom-4 left-4 z-[400]">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium ${
            currentLocation ? "bg-accent/20 text-accent" : "bg-muted/80 text-muted-foreground"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${currentLocation ? "bg-accent animate-pulse" : "bg-muted-foreground"}`} />
            {currentLocation ? "GPS activo" : "Sin GPS"}
          </div>
        </div>
      </div>

      {/* ── PANEL INFERIOR ───────────────────────────────────────────────── */}
      <div className="bg-card rounded-t-3xl border-t border-border/50 shadow-2xl relative z-10" style={{ marginTop: "-1.5rem" }}>
        <div className="flex justify-center pt-3 pb-1 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="px-5 pb-6 space-y-3">
          {/* Destino actual */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              {isPickingUp ? "Ir a recoger" : "Ir a entregar"}
            </p>
            <p className="text-base font-bold text-foreground leading-snug">
              {isPickingUp ? delivery.pickup_address : delivery.delivery_address}
            </p>
          </div>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-3 overflow-hidden"
              >
                {/* Ruta completa */}
                <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="h-2.5 w-2.5 rounded-full bg-accent shrink-0" />
                    <span className="text-xs text-muted-foreground truncate">{delivery.pickup_address}</span>
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
                    <span className="text-xs text-muted-foreground truncate">{delivery.delivery_address}</span>
                  </div>
                </div>

                {/* Cliente + pago */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-accent/10 border border-accent/20">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{delivery.customer_name}</p>
                      <p className="text-[10px] text-muted-foreground">#{delivery.order_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-base font-extrabold text-foreground">{fmt(Number(delivery.amount))}</p>
                      <p className="text-[10px] text-muted-foreground">Cliente paga</p>
                    </div>
                    <div className="text-right border-l border-accent/30 pl-3">
                      <p className="text-base font-extrabold text-accent">{fmt(Number(delivery.commission))}</p>
                      <p className="text-[10px] text-muted-foreground">Tu ganancia</p>
                    </div>
                  </div>
                </div>

                {/* Notas del admin */}
                {delivery.notes && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-400 leading-snug">{delivery.notes}</p>
                  </div>
                )}

                {/* Llamar al cliente */}
                {delivery.customer_phone && (
                  <a href={`tel:${delivery.customer_phone}`}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                    <div className="h-9 w-9 rounded-full bg-accent/20 flex items-center justify-center">
                      <Phone className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Llamar al cliente</p>
                      <p className="text-xs text-muted-foreground">{delivery.customer_phone}</p>
                    </div>
                  </a>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Botón acción principal */}
          {isPickingUp && (
            <Button onClick={onPickedUp}
              className="w-full h-14 rounded-2xl bg-amber-500 hover:bg-amber-500/90 text-white font-bold text-base shadow-lg shadow-amber-500/25">
              <Package className="h-5 w-5 mr-2" /> Ya recogí el pedido
            </Button>
          )}
          {delivery.status === "en_camino" && (
            <Button onClick={onDelivered}
              className="w-full h-14 rounded-2xl bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-base shadow-lg shadow-accent/20">
              <CheckCircle className="h-5 w-5 mr-2" /> Entrega completada ✓
            </Button>
          )}

          {/* Botón cancelar / reportar problema */}
          <button onClick={() => setShowCancel(!showCancel)}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors py-1">
            <XCircle className="h-3.5 w-3.5" />
            {showCancel ? "Cerrar" : "Reportar problema / cancelar"}
            <ChevronDown className={`h-3 w-3 transition-transform ${showCancel ? "rotate-180" : ""}`} />
          </button>

          <AnimatePresence>
            {showCancel && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="space-y-2 pt-1">
                  <p className="text-xs text-muted-foreground">Describe el problema:</p>
                  <textarea
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
                    placeholder="Ej: dirección incorrecta, cliente no responde, accidente..."
                    rows={2}
                    className="w-full rounded-xl bg-muted/50 border border-border/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/50 resize-none"
                  />
                  <Button variant="destructive" onClick={handleCancelDelivery} disabled={cancelling || !cancelReason.trim()}
                    className="w-full h-11 rounded-xl font-semibold">
                    {cancelling
                      ? <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Cancelando...</span>
                      : <><XCircle className="h-4 w-4 mr-1.5" />Cancelar y liberar pedido</>
                    }
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default ActiveDeliveryView;
