import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Button } from "@/components/ui/button";
import { 
  Phone, 
  Package, 
  Navigation,
  ArrowUpRight,
  ExternalLink,
  Check,
  Bike,
  Target,
  XCircle,
  AlertCircle,
  ChevronDown,
  ArrowRight,
  CheckCircle,
  User
} from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import { useDriverLocation } from "@/hooks/useDriverLocation";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Delivery {
  id: string;
  order_id: string;
  status: string;
  customer_name: string;
  customer_phone?: string | null;
  pickup_address?: string;
  delivery_address: string;
  amount?: number;
  commission?: number;
  notes?: string | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  created_at?: string;
}

// Distancia euclidiana entre puntos [lng, lat]
const distMeters = (
  a: [number, number],
  b: [number, number],
): number => {
  const R = 6371000;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[1] * Math.PI) / 180) *
      Math.cos((b[1] * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

// Encuentra la distancia mínima de un punto a un segmento de línea
const distPointToSegment = (
  p: [number, number],
  a: [number, number],
  b: [number, number],
): number => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distMeters(p, a);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const proj: [number, number] = [a[0] + t * dx, a[1] + t * dy];
  return distMeters(p, proj);
};

// ¿Está el driver fuera de la ruta? (>200m del path)
const isOffRoute = (
  pos: [number, number],
  coords: [number, number][],
  thresholdM = 200,
): boolean => {
  for (let i = 0; i < coords.length - 1; i++) {
    if (distPointToSegment(pos, coords[i], coords[i + 1]) <= thresholdM)
      return false;
  }
  return true;
};

// Velocidad del GPS en km/h (usando haversine / dt)
const calcSpeedKmh = (
  prev: { lat: number; lng: number; t: number } | null,
  curr: { lat: number; lng: number; t: number },
): number | null => {
  if (!prev) return null;
  const dt = (curr.t - prev.t) / 1000;
  if (dt < 1) return null;
  const km = distMeters([prev.lng, prev.lat], [curr.lng, curr.lat]) / 1000;
  return Math.round(km / (dt / 3600));
};

interface ActiveDeliveryViewProps {
  delivery: Delivery;
  onPickedUp: () => void;
  onDelivered: () => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

const ActiveDeliveryView: React.FC<ActiveDeliveryViewProps> = ({ 
  delivery, 
  onPickedUp, 
  onDelivered 
}) => {
  const { user } = useAuth();
  const { currentLocation } = useDriverLocation();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const driverMarkerRef = useRef<maplibregl.Marker | null>(null);
  const pickupMarkerRef = useRef<maplibregl.Marker | null>(null);
  const deliveryMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [followMode, setFollowMode] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{
    distance: string;
    duration: string;
    nextStreet: string;
    nextManeuver: string;
  } | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);

  // ── Navigation enhancements ─────────────────────────────────────────────
  const [speedKmh, setSpeedKmh] = useState<number | null>(null);
  const [traveledCoords, setTraveledCoords] = useState<[number, number][]>([]);
  const prevPosRef = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const fullRouteRef = useRef<[number, number][]>([]);
  const [etaProgress, setEtaProgress] = useState(1); // 1 = inicio, 0 = entregado

  const isPickingUp = delivery.status === "aceptado";

  // ── Screen Wake Lock ──────────────────────────────────────────────────────
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
    const handleVisibility = () => { if (document.visibilityState === "visible") acquire(); };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      wakeLock?.release().catch(() => {});
    };
  }, []);

  // ── Initialize Map (MapLibre 3D) ───────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    mapInstance.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: currentLocation ? [currentLocation.lng, currentLocation.lat] : [delivery.pickup_lng || -73.1198, delivery.pickup_lat || 7.1193],
      zoom: 18,
      pitch: 75,
      bearing: currentLocation?.heading || 0,
      antialias: false
    });

    mapInstance.current.on('style.load', () => {
        setIsMapReady(true);
        const map = mapInstance.current;
        if (!map) return;

        // Realistic 3D Buildings
        map.addLayer({
            'id': '3d-buildings-realistic',
            'source': 'openfreemap',
            'source-layer': 'building',
            'type': 'fill-extrusion',
            'minzoom': 15,
            'paint': {
              'fill-extrusion-color': [
                'interpolate', ['linear'], ['get', 'render_height'],
                0, '#111827',
                50, '#1f2937'
              ],
              'fill-extrusion-height': ['get', 'render_height'],
              'fill-extrusion-base': ['get', 'render_min_height'],
              'fill-extrusion-opacity': 0.8
            }
        });
    });

    return () => { mapInstance.current?.remove(); mapInstance.current = null; };
  }, []);

  // ── Fetch Route (OSRM) ─────────────────────────────────────────────────────
  const fetchRouteDetails = useCallback(async () => {
    if (!isMapReady || !mapInstance.current || !currentLocation) return;
    const map = mapInstance.current;

    let points = `${currentLocation.lng},${currentLocation.lat};`;
    if (delivery.status === 'aceptado') {
        points += `${delivery.pickup_lng},${delivery.pickup_lat};${delivery.delivery_lng},${delivery.delivery_lat}`;
    } else {
        points += `${delivery.delivery_lng},${delivery.delivery_lat}`;
    }

    try {
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${points}?overview=full&geometries=geojson&steps=true`);
        const data = await response.json();

        if (data.routes && data.routes[0]) {
            const route = data.routes[0];
            const coordinates: [number, number][] = route.geometry.coordinates;
            fullRouteRef.current = coordinates;
            const sourceId = 'route-source';

            if (!map.getSource(sourceId)) {
                map.addSource(sourceId, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [coordinates[0], coordinates[coordinates.length - 1]] } } });
                // capa de ruta recorrida (gris)
                map.addSource('route-traveled', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } } });
                map.addLayer({ id: 'route-case', type: 'line', source: 'route-source', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 12, 'line-opacity': 1 } });
                map.addLayer({ id: 'route-line', type: 'line', source: 'route-source', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#6366f1', 'line-width': 6, 'line-opacity': 1 } });
                map.addLayer({ id: 'route-traveled-line', type: 'line', source: 'route-traveled', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#94a3b8', 'line-width': 6, 'line-opacity': 0.8, 'line-dasharray': [4, 4] } });
            } else {
                (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [coordinates[0], coordinates[coordinates.length - 1]] } });
            }

            // Calcular progreso: distancia restante vs total
            const totalDist = route.distance;
            const driverPos: [number, number] = [currentLocation.lng, currentLocation.lat];
            let distToNext = 0;
            // Usar el primer step como referencia
            const nextStep = route.legs[0].steps[1] || route.legs[0].steps[0];
            // Distancia del driver al punto final de la ruta
            const endpoint = coordinates[coordinates.length - 1];
            distToNext = distMeters(driverPos, endpoint);
            setEtaProgress(Math.min(1, Math.max(0, distToNext / totalDist * 1.1)));

            setRouteInfo({
                distance: (distToNext / 1000).toFixed(1) + " km",
                duration: Math.ceil(route.duration / 60) + " min",
                nextStreet: nextStep.name || "Continuar",
                nextManeuver: (nextStep.distance < 1000) ? Math.round(nextStep.distance) + " m" : (nextStep.distance/1000).toFixed(1) + " km"
            });
        }
    } catch (err) { }
  }, [isMapReady, currentLocation, delivery]);

  useEffect(() => {
    fetchRouteDetails();
    const int = setInterval(fetchRouteDetails, 15000);
    return () => clearInterval(int);
  }, [fetchRouteDetails]);

  // ── Markers management ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isMapReady || !mapInstance.current || !currentLocation) return;
    const map = mapInstance.current;

    // Advanced Moto Marker with Shadow
    if (!driverMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'driver-marker';
        el.innerHTML = `
          <div class="relative w-24 h-24 flex items-center justify-center pointer-events-none transform-gpu">
            <div class="absolute bottom-6 h-6 w-14 bg-black/40 rounded-full blur-md" style="transform: skewX(-20deg)"></div>
            <div class="bg-indigo-600 rounded-[28px] p-4 shadow-[0_15px_45px_rgba(99,102,241,0.7)] border-4 border-white transition-all duration-300">
               <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="drop-shadow-2xl"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>
            </div>
          </div>
        `;
        driverMarkerRef.current = new maplibregl.Marker({ 
            element: el, 
            anchor: 'bottom',
            rotationAlignment: 'map' 
        })
        .setLngLat([currentLocation.lng, currentLocation.lat])
        .addTo(map);
    } else {
        driverMarkerRef.current.setLngLat([currentLocation.lng, currentLocation.lat]);
        if (currentLocation.heading !== null) {
            const inner = driverMarkerRef.current.getElement().querySelector('div > div:nth-child(2)');
            if (inner) (inner as HTMLElement).style.transform = `rotate(${currentLocation.heading}deg)`;
        }
    }

    const updateDestinationMarker = (ref: any, lat: any, lng: any, emoji: string, bg: string, label: string) => {
        if (!lat || !lng) return;
        if (!ref.current) {
            const el = document.createElement('div');
            el.innerHTML = `<div class="h-14 w-14 ${bg} rounded-3xl flex items-center justify-center text-2xl shadow-2xl border-4 border-white">${emoji}</div>`;
            ref.current = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(map);
        } else ref.current.setLngLat([lng, lat]);
    };

    updateDestinationMarker(pickupMarkerRef, delivery.pickup_lat, delivery.pickup_lng, '📦', 'bg-emerald-500', 'Recogida');
    updateDestinationMarker(deliveryMarkerRef, delivery.delivery_lat, delivery.delivery_lng, '🏁', 'bg-indigo-600', 'Entrega');

    if (followMode) {
      map.easeTo({
        center: [currentLocation.lng, currentLocation.lat],
        bearing: currentLocation.heading || 0,
        duration: 1000
      });
    }

    // Actualizar marcador de ruta recorrida (breadcrumb)
    const pos: [number, number] = [currentLocation.lng, currentLocation.lat];
    setTraveledCoords(prev => {
      const all = [...prev, pos];
      return all;
    });

    // Velocidad calculada
    const prev = prevPosRef.current;
    const curr = { lat: currentLocation.lat, lng: currentLocation.lng, t: Date.now() };
    const spd = calcSpeedKmh(prev, curr);
    if (spd !== null) setSpeedKmh(spd);
    prevPosRef.current = curr;
  }, [currentLocation, followMode, isMapReady, delivery]);

  // ── Update breadcrumb line ─────────────────────────────────────────────
  useEffect(() => {
    if (!isMapReady || !mapInstance.current || traveledCoords.length < 2) return;
    const src = mapInstance.current.getSource('route-traveled');
    if (src) {
      (src as maplibregl.GeoJSONSource).setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: traveledCoords },
      });
    }
  }, [traveledCoords, isMapReady]);

  // ── Navigation external ────────────────────────────────────────────────────
  const openNav = (app: "google" | "waze") => {
    const dest = isPickingUp 
      ? { lat: delivery.pickup_lat, lng: delivery.pickup_lng }
      : { lat: delivery.delivery_lat, lng: delivery.delivery_lng };
    const addr = isPickingUp ? delivery.pickup_address : delivery.delivery_address;
    
    if (app === "google") {
      window.open(dest?.lat
        ? `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=driving`
        : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr || "")}&travelmode=driving`, "_blank");
    } else {
      window.open(dest?.lat
        ? `https://waze.com/ul?ll=${dest.lat},${dest.lng}&navigate=yes`
        : `https://waze.com/ul?q=${encodeURIComponent(addr || "")}&navigate=yes`, "_blank");
    }
  };

  const handleCancelDelivery = async () => {
    if (!user || !cancelReason.trim()) {
      toast.error("Describe el problema antes de cancelar");
      return;
    }
    setCancelling(true);
    try {
      const { error } = await supabase.from("deliveries").update({
        status: "cancelado",
        driver_id: null,
        cancelled_at: new Date().toISOString(),
      }).eq("id", delivery.id);
      if (error) throw error;

      await supabase.from("delivery_audit_log").insert({
        delivery_id: delivery.id,
        event: "Entrega cancelada por mensajero",
        details: cancelReason,
        performed_by: user.id,
      });

      toast.success("Entrega cancelada. El pedido volvió a estar disponible.");
      setShowCancel(false);
      window.location.reload(); // Quick way to reset state
    } catch (e: any) {
      toast.error("Error al cancelar: " + e.message);
    } finally { setCancelling(false); }
  };

  return (
    <div className="h-full w-full bg-[#020617] overflow-hidden relative font-sans">
      <AnimatePresence>
        {routeInfo && (
          <motion.div initial={{ y: -100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="absolute top-12 inset-x-4 z-[1001] pointer-events-none">
            <div className="bg-slate-900/90 backdrop-blur-3xl rounded-[35px] p-7 shadow-[0_25px_60px_rgba(0,0,0,0.6)] border border-white/10 flex items-center gap-7 max-w-sm mx-auto">
               <div className="bg-indigo-600 p-5 rounded-3xl shadow-lg shadow-indigo-500/50">
                  <ArrowUpRight className="h-10 w-10 text-white" />
               </div>
               <div className="flex flex-col">
                  <span className="text-5xl font-black text-white leading-none mb-1 tracking-tighter">{routeInfo.nextManeuver}</span>
                  <span className="text-sm font-bold text-indigo-400 capitalize truncate w-40">{routeInfo.nextStreet}</span>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={mapContainer} className="h-full w-full contrast-[1.2] brightness-[0.85] saturate-[1.1]" />

      {/* RECENTER BUTTON */}
      <div className="absolute right-6 bottom-52 z-[1001] flex flex-col gap-4">
          <Button 
            variant="secondary" 
            size="icon" 
            className={`h-16 w-16 rounded-[28px] shadow-[0_20px_40px_rgba(0,0,0,0.4)] transition-all ${followMode ? 'bg-indigo-600 text-white shadow-indigo-500/30' : 'bg-white text-slate-900'}`} 
            onClick={() => setFollowMode(!followMode)}
          >
            <Target className="h-8 w-8" />
          </Button>
      </div>

      {/* NAVIGATION QUICK BUTTONS */}
      <div className="absolute right-6 bottom-[280px] z-[1001] flex flex-col gap-3">
          <button onClick={() => openNav("google")} className="h-12 px-4 rounded-2xl bg-white/95 backdrop-blur-xl flex items-center gap-2 text-slate-900 font-black text-[10px] uppercase tracking-widest shadow-2xl border border-white">
             <Navigation className="h-4 w-4 text-blue-600" /> Google
          </button>
          <button onClick={() => openNav("waze")} className="h-12 px-4 rounded-2xl bg-[#05C8F7] flex items-center gap-2 text-white font-black text-[10px] uppercase tracking-widest shadow-2xl">
             <Navigation className="h-4 w-4" /> Waze
          </button>
      </div>

      <motion.div
        drag="y" dragConstraints={{ top: -450, bottom: 0 }}
        animate={{ y: isExpanded ? -450 : 0 }}
        className="absolute bottom-0 inset-x-0 z-[1002] bg-white rounded-t-[55px] shadow-[0_-40px_120px_rgba(0,0,0,0.7)] flex flex-col"
        style={{ height: '600px', marginBottom: '-460px' }}
      >
          <div className="w-full pt-5 pb-3 active:bg-slate-50 transition-colors" onClick={() => setIsExpanded(!isExpanded)}>
              <div className="w-24 h-2 bg-slate-200 rounded-full mx-auto" />
          </div>

          <div className="px-10 pt-6 flex-1 flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                      <span className="text-6xl font-black text-slate-900 tracking-tighter leading-none">{routeInfo?.duration || "--"}</span>
                      <div className="h-8 w-px bg-slate-200" />
                      <span className="text-xl font-bold text-slate-400 uppercase tracking-widest">{routeInfo?.distance || "--"}</span>
                  </div>
                  <div className="bg-indigo-50 px-6 py-3 rounded-2xl">
                    <span className="text-lg font-black text-indigo-600">#{delivery.order_id.slice(-4).toUpperCase()}</span>
                  </div>
              </div>

              {/* ETA PROGRESS BAR */}
              <div className="w-full h-1.5 bg-slate-100 rounded-full mb-4 overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.max(2, (1 - etaProgress) * 100)}%` }}
                />
              </div>

              {/* SPEED INDICATOR */}
              {speedKmh !== null && (
                <div className="bg-slate-50 rounded-2xl p-3 mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bike className="h-4 w-4 text-slate-400" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Velocidad</p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-slate-800">{speedKmh}</span>
                    <span className="text-[10px] font-bold text-slate-400">km/h</span>
                  </div>
                </div>
              )}

              <div className="space-y-4 mb-6">
                  <div className={`p-6 rounded-[35px] border-2 ${isPickingUp ? 'border-indigo-600 bg-indigo-50/20' : 'border-slate-50 bg-slate-50/50'}`}>
                      <div className="flex items-center gap-5">
                          <div className="h-14 w-14 rounded-2xl bg-emerald-500 flex items-center justify-center text-white text-2xl shadow-md">📦</div>
                          <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Punto de Recogida</p>
                              <p className="text-sm font-black text-slate-800 truncate">{delivery.pickup_address}</p>
                          </div>
                      </div>
                  </div>
                  <div className={`p-6 rounded-[35px] border-2 ${!isPickingUp ? 'border-indigo-600 bg-indigo-50/20' : 'border-slate-50 bg-slate-50/50'}`}>
                      <div className="flex items-center gap-5">
                          <div className="h-14 w-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-2xl shadow-md">🏠</div>
                          <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Entrega a</p>
                              <p className="text-sm font-black text-slate-800 truncate">{delivery.delivery_address}</p>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Order Details Mini */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-3xl mb-6">
                  <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center"><User className="h-5 w-5 text-slate-500" /></div>
                      <div>
                          <p className="text-xs font-black text-slate-900">{delivery.customer_name}</p>
                          <p className="text-[10px] font-bold text-slate-400">Cliente</p>
                      </div>
                  </div>
                  <div className="text-right">
                      <p className="text-base font-black text-indigo-600 leading-none">{fmt(delivery.amount || 0)}</p>
                      <p className="text-[10px] font-bold text-slate-400">Por cobrar</p>
                  </div>
              </div>

              {/* Cancel Button */}
              {!showCancel ? (
                <button onClick={() => setShowCancel(true)} className="flex items-center justify-center gap-2 text-slate-400 hover:text-red-500 transition-colors py-2 group">
                   <XCircle className="h-4 w-4" />
                   <span className="text-[10px] font-black uppercase tracking-widest">Reportar Problema</span>
                </button>
              ) : (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 pb-4">
                    <textarea 
                        value={cancelReason} 
                        onChange={e => setCancelReason(e.target.value)}
                        placeholder="Describe el problema..."
                        className="w-full rounded-2xl bg-slate-50 border-2 border-slate-100 p-4 text-sm font-bold placeholder:text-slate-300 focus:border-indigo-500 focus:outline-none transition-all"
                        rows={2}
                    />
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setShowCancel(false)} className="flex-1 h-12 rounded-2xl font-black text-[10px] uppercase">Cerrar</Button>
                        <Button 
                            variant="destructive" 
                            onClick={handleCancelDelivery} 
                            disabled={cancelling || !cancelReason.trim()}
                            className="flex-[2] h-12 rounded-2xl font-black text-[10px] uppercase"
                        >
                            {cancelling ? "Cancelando..." : "Liberar Pedido"}
                        </Button>
                    </div>
                </motion.div>
              )}

              <div className="mt-auto pb-12">
                {isPickingUp ? (
                    <Button onClick={onPickedUp} className="w-full h-22 rounded-[40px] bg-indigo-600 hover:bg-indigo-700 text-white font-black text-2xl shadow-2xl active:scale-95 transition-all">YA RECOGÍ</Button>
                ) : (
                    <Button onClick={onDelivered} className="w-full h-22 rounded-[40px] bg-emerald-500 hover:bg-emerald-600 text-white font-black text-2xl shadow-2xl active:scale-95 transition-all">ENTREGADO</Button>
                )}
              </div>
          </div>
      </motion.div>

      <style dangerouslySetInnerHTML={{ __html: `
        .maplibregl-ctrl { display: none !important; }
        ::-webkit-scrollbar { display: none; }
        .driver-marker { transition: transform 0.2s linear; }
      `}} />
    </div>
  );
};

export default ActiveDeliveryView;
