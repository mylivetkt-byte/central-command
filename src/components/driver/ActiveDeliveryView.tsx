import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { MapStyleSwitcher, useMapStyle, MapStyle } from '@/components/MapStyleSwitcher';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Button } from "@/components/ui/button";
import {
  Phone, Navigation, ArrowUpRight, Target,
  XCircle, ChevronDown, User, Bike, Camera, WifiOff
} from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import { useDriverLocation } from "@/hooks/useDriverLocation";
import { useOffline } from "@/hooks/useOffline";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import ChatBubble from "@/components/ChatBubble";

interface Stop {
  type: 'pickup' | 'delivery';
  label: string;
  address: string;
  lat: number | null;
  lng: number | null;
  completed?: boolean;
}

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
  stops?: Stop[];
}

const CANCEL_REASONS = [
  "Cliente no responde",
  "Dirección errónea",
  "Paquete dañado",
  "Ubicación incorrecta",
  "Cliente canceló",
  "Otro",
];

const distMeters = (a: [number, number], b: [number, number]): number => {
  const R = 6371000;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

const calcSpeedKmh = (prev: { lat: number; lng: number; t: number } | null, curr: { lat: number; lng: number; t: number }): number | null => {
  if (!prev) return null;
  const dt = (curr.t - prev.t) / 1000;
  if (dt < 1) return null;
  const km = distMeters([prev.lng, prev.lat], [curr.lng, curr.lat]) / 1000;
  return Math.round(km / (dt / 3600));
};

interface ActiveDeliveryViewProps {
  delivery: Delivery;
  onPickedUp: (deliveryId: string) => void;
  onDelivered: (deliveryId: string) => void;
  allDeliveries?: Delivery[];
}

const fmt = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

const ActiveDeliveryView: React.FC<ActiveDeliveryViewProps> = ({ delivery: initialDelivery, onPickedUp, onDelivered, allDeliveries = [] }) => {
  const { user } = useAuth();
  const { currentLocation } = useDriverLocation();
  const { isOffline, cacheData, getCachedData } = useOffline();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const driverMarkerRef = useRef<maplibregl.Marker | null>(null);
  const stopMarkerRefs = useRef<maplibregl.Marker[]>([]);
  const [followMode, setFollowMode] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string; nextStreet: string; nextManeuver: string } | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelPhotos, setCancelPhotos] = useState<string[]>([]);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);
  const [speedKmh, setSpeedKmh] = useState<number | null>(null);
  const [traveledCoords, setTraveledCoords] = useState<[number, number][]>([]);
  const prevPosRef = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const [etaProgress, setEtaProgress] = useState(1);
  const { current: mapStyle, setStyle } = useMapStyle("dark");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [focusedDeliveryId, setFocusedDeliveryId] = useState(initialDelivery.id);

  useEffect(() => {
    if (initialDelivery?.id) {
      setFocusedDeliveryId(initialDelivery.id);
    }
  }, [initialDelivery?.id]);

  const delivery = allDeliveries.find(d => d.id === focusedDeliveryId) || initialDelivery;

  const isPickingUp = delivery.status === "aceptado";

  const stops: Stop[] = delivery.stops ?? [
    { type: 'pickup', label: 'Recoger', address: delivery.pickup_address || '', lat: delivery.pickup_lat, lng: delivery.pickup_lng, completed: !isPickingUp },
    { type: 'delivery', label: 'Entregar', address: delivery.delivery_address, lat: delivery.delivery_lat, lng: delivery.delivery_lng, completed: false },
  ];

  // Add all deliveries as additional stops for multi-stop view
  const multiStops: Stop[] = React.useMemo(() => {
    if (allDeliveries.length <= 1) return stops;
    const all: Stop[] = [];
    allDeliveries.forEach((d, i) => {
      const isPickComplete = d.status !== "aceptado";
      all.push({ type: 'pickup', label: `Recoger #${i + 1}`, address: d.pickup_address || '', lat: d.pickup_lat, lng: d.pickup_lng, completed: isPickComplete });
      all.push({ type: 'delivery', label: `Entregar #${i + 1}`, address: d.delivery_address, lat: d.delivery_lat, lng: d.delivery_lng, completed: d.status === "entregado" });
    });
    return all;
  }, [allDeliveries, stops]);

  const routeCacheKey = `route-${delivery.id}`;

  // Wake Lock
  useEffect(() => {
    const acquire = async () => {
      try { if ("wakeLock" in navigator) { const wl = await (navigator as any).wakeLock.request("screen"); setWakeLock(wl); } } catch {}
    };
    acquire();
    const h = () => { if (document.visibilityState === "visible") acquire(); };
    document.addEventListener("visibilitychange", h);

  return () => { document.removeEventListener("visibilitychange", h); wakeLock?.release().catch(() => {}); };
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    mapInstance.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle.url,
      center: currentLocation ? [currentLocation.lng, currentLocation.lat] : [delivery.pickup_lng || -73.1198, delivery.pickup_lat || 7.1193],
      zoom: 17,
      pitch: 65,
      bearing: currentLocation?.heading || 0
    });

    mapInstance.current.on('style.load', () => {
      setIsMapReady(true);
      const map = mapInstance.current;
      if (!map) return;
      try {
        map.addLayer({
          id: '3d-buildings',
          source: 'carto',
          'source-layer': 'building',
          type: 'fill-extrusion',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': '#d1d5db',
            'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
            'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
            'fill-extrusion-opacity': 0.5
          }
        });
      } catch {}
    });

    return () => { mapInstance.current?.remove(); mapInstance.current = null; };
  }, []);

  // Fetch Route (with offline fallback)
  const fetchRouteDetails = useCallback(async () => {
    if (!isMapReady || !mapInstance.current || !currentLocation) return;
    const map = mapInstance.current;

    // Build waypoints: current location + all stops
    let waypoints = `${currentLocation.lng},${currentLocation.lat}`;
    const allS = allDeliveries.length > 1 ? multiStops : stops;
    allS.forEach(s => {
      if (s.lat && s.lng) waypoints += `;${s.lng},${s.lat}`;
    });

    if (waypoints === `${currentLocation.lng},${currentLocation.lat}`) return;

    try {
      let data;
      if (isOffline) {
        const cached = getCachedData<any>(routeCacheKey);
        if (cached) data = cached;
        else return;
      } else {
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson&steps=true`);
        data = await response.json();
        cacheData(routeCacheKey, data);
      }

      if (data.routes?.[0]) {
        const route = data.routes[0];
        const coordinates: [number, number][] = route.geometry.coordinates;
        const sourceId = 'route-source';

        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } } });
          map.addSource('route-traveled', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } } });
          map.addLayer({ id: 'route-case', type: 'line', source: sourceId, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#a5b4fc', 'line-width': 10, 'line-opacity': 0.4 } });
          map.addLayer({ id: 'route-line', type: 'line', source: sourceId, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#4F46E5', 'line-width': 5, 'line-opacity': 1 } });
          map.addLayer({ id: 'route-traveled-line', type: 'line', source: 'route-traveled', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#94a3b8', 'line-width': 4, 'line-opacity': 0.5, 'line-dasharray': [3, 3] } });
        } else {
          (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } });
        }

        const driverPos: [number, number] = [currentLocation.lng, currentLocation.lat];
        const endpoint = coordinates[coordinates.length - 1];
        const distToNext = distMeters(driverPos, endpoint);
        setEtaProgress(Math.min(1, Math.max(0, distToNext / route.distance * 1.1)));

        const nextStep = route.legs[0].steps[1] || route.legs[0].steps[0];
        setRouteInfo({
          distance: (distToNext / 1000).toFixed(1) + " km",
          duration: Math.ceil(route.duration / 60) + " min",
          nextStreet: nextStep.name || "Continuar",
          nextManeuver: nextStep.distance < 1000 ? Math.round(nextStep.distance) + " m" : (nextStep.distance / 1000).toFixed(1) + " km"
        });
      }
    } catch {}
  }, [isMapReady, currentLocation, isOffline, routeCacheKey, stops, multiStops, allDeliveries]);

  useEffect(() => {
    fetchRouteDetails();
    const int = setInterval(fetchRouteDetails, 15000);
    return () => clearInterval(int);
  }, [fetchRouteDetails]);

  // Markers
  useEffect(() => {
    if (!isMapReady || !mapInstance.current || !currentLocation) return;
    const map = mapInstance.current;

    // Driver marker
    if (!driverMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'driver-nav-dot';
      el.innerHTML = `
        <div class="nav-dot-wrapper">
          <div class="nav-pulse"></div>
          <div class="nav-arrow" style="transform: rotate(${currentLocation.heading || 0}deg)">
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="22" cy="22" r="16" fill="#4F46E5" stroke="white" stroke-width="4"/>
              <path d="M22 9L28 26H16L22 9Z" fill="white"/>
            </svg>
          </div>
        </div>
      `;
      driverMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([currentLocation.lng, currentLocation.lat])
        .addTo(map);
    } else {
      driverMarkerRef.current.setLngLat([currentLocation.lng, currentLocation.lat]);
      const arrow = driverMarkerRef.current.getElement().querySelector('.nav-arrow') as HTMLElement;
      if (arrow) arrow.style.transform = `rotate(${currentLocation.heading || 0}deg)`;
    }

    // Clear old stop markers
    stopMarkerRefs.current.forEach(m => m.remove());
    stopMarkerRefs.current = [];

    // Stop markers (support multi-stop)
    const displayStops = allDeliveries.length > 1 ? multiStops : stops;
    displayStops.forEach((s, i) => {
      if (!s.lat || !s.lng) return;
      const color = s.type === 'pickup' ? '#10b981' : '#4F46E5';
      const emoji = s.type === 'pickup' ? '📦' : '🏠';
      const label = `${i + 1}`;
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.25))">
          <div style="width:40px;height:40px;border-radius:12px;background:${color};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:white;border:3px solid white;position:relative">
            ${label}
            ${s.completed ? '<div style="position:absolute;top:-4px;right:-4px;width:14px;height:14px;border-radius:50%;background:#22c55e;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:8px;color:white">✓</div>' : ''}
          </div>
          <div style="width:3px;height:6px;background:${color};border-radius:0 0 2px 2px"></div>
        </div>
      `;
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([s.lng, s.lat]).addTo(map);
      stopMarkerRefs.current.push(marker);
    });

    if (followMode) {
      map.easeTo({ center: [currentLocation.lng, currentLocation.lat], bearing: currentLocation.heading || 0, duration: 800 });
    }

    // Breadcrumb
    const pos: [number, number] = [currentLocation.lng, currentLocation.lat];
    setTraveledCoords(prev => [...prev, pos]);

    // Speed
    const curr = { lat: currentLocation.lat, lng: currentLocation.lng, t: Date.now() };
    const spd = calcSpeedKmh(prevPosRef.current, curr);
    if (spd !== null) setSpeedKmh(spd);
    prevPosRef.current = curr;
  }, [currentLocation, followMode, isMapReady, stops, multiStops, allDeliveries]);

  // Update breadcrumb
  useEffect(() => {
    if (!isMapReady || !mapInstance.current || traveledCoords.length < 2) return;
    const src = mapInstance.current.getSource('route-traveled');
    if (src) (src as maplibregl.GeoJSONSource).setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: traveledCoords } });
  }, [traveledCoords, isMapReady]);

  const openNav = (app: "google" | "waze") => {
    const dest = isPickingUp ? { lat: delivery.pickup_lat, lng: delivery.pickup_lng } : { lat: delivery.delivery_lat, lng: delivery.delivery_lng };
    const addr = isPickingUp ? delivery.pickup_address : delivery.delivery_address;
    if (app === "google") {
      window.open(dest?.lat ? `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=driving` : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr || "")}&travelmode=driving`, "_blank");
    } else {
      window.open(dest?.lat ? `https://waze.com/ul?ll=${dest.lat},${dest.lng}&navigate=yes` : `https://waze.com/ul?q=${encodeURIComponent(addr || "")}&navigate=yes`, "_blank");
    }
  };

  const handlePhotoCapture = () => fileInputRef.current?.click();

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) setCancelPhotos(prev => [...prev, ev.target!.result as string]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleCancelDelivery = async (reason: string) => {
    if (!user) { toast.error("Debes iniciar sesión"); return; }
    setCancelling(true);
    try {
      // Devolver el pedido a la bolsa: status pendiente y sin conductor
      const { error } = await (supabase.from("deliveries") as any)
        .update({
          status: "pendiente",
          driver_id: null,
          accepted_at: null,
          picked_up_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", delivery.id);
      if (error) throw error;
      await (supabase.from("delivery_audit_log") as any).insert({
        delivery_id: delivery.id,
        event: "Entrega rechazada por mensajero",
        details: `Motivo: ${reason}${cancelPhotos.length > 0 ? ` (${cancelPhotos.length} foto(s) adjunta(s))` : ''}`,
        performed_by: user.id
      });
      // Volver a difundir para que otros mensajeros lo vean al instante
      try {
        const ch = supabase.channel("dispatch-notifications");
        await ch.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await ch.send({ type: "broadcast", event: "new-order", payload: { id: delivery.id } });
            setTimeout(() => supabase.removeChannel(ch), 500);
          }
        });
      } catch {}
      toast.success("Pedido devuelto. Ya está disponible para otros mensajeros.");
      setShowCancel(false);
      window.location.reload();
    } catch (e: any) { toast.error("Error al cancelar: " + e.message); }
    finally { setCancelling(false); }
  };

  return (
    <div className="h-full w-full overflow-hidden relative font-sans bg-white">
      {/* Offline banner */}
      <AnimatePresence>
        {isOffline && (
          <motion.div initial={{ y: -40 }} animate={{ y: 0 }} className="absolute top-0 inset-x-0 z-[1003] bg-amber-500/90 backdrop-blur-md px-4 py-2 flex items-center gap-2">
            <WifiOff className="h-4 w-4 text-white shrink-0" />
            <span className="text-xs font-bold text-white">Sin conexión — mostrando datos en caché</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Banner */}
      <AnimatePresence>
        {routeInfo && (
          <motion.div initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`absolute top-0 inset-x-0 z-[1001] safe-top ${isOffline ? 'mt-10' : ''}`}>
            <div className="bg-indigo-600 mx-3 mt-3 rounded-2xl p-4 shadow-xl flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-xl">
                <ArrowUpRight className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-3xl font-black text-white leading-none tracking-tight">{routeInfo.nextManeuver}</span>
                <p className="text-sm font-semibold text-indigo-200 truncate mt-0.5">{routeInfo.nextStreet}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-white">{routeInfo.duration}</p>
                <p className="text-xs font-semibold text-indigo-200">{routeInfo.distance}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Speed badge */}
      {speedKmh !== null && (
        <div className="absolute top-28 left-4 z-[1001] bg-white rounded-xl shadow-lg px-3 py-2 flex items-baseline gap-1 border border-slate-100">
          <span className="text-xl font-black text-slate-800">{speedKmh}</span>
          <span className="text-[10px] font-bold text-slate-400">km/h</span>
        </div>
      )}

      <div ref={mapContainer} className="h-full w-full" />

      {/* Controls */}
      <div className="absolute right-3 bottom-52 z-[1001] flex flex-col gap-2">
        <Button
          variant="secondary" size="icon"
          className={`h-12 w-12 rounded-full shadow-lg transition-all border ${followMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200'}`}
          onClick={() => setFollowMode(!followMode)}
        >
          <Target className="h-5 w-5" />
        </Button>
      </div>

      {/* Nav buttons */}
      <div className="absolute right-3 bottom-[270px] z-[1001] flex flex-col gap-2">
        <button onClick={() => openNav("google")} className="h-10 px-3 rounded-full bg-white shadow-lg flex items-center gap-1.5 text-slate-700 font-bold text-[10px] uppercase tracking-wider border border-slate-100">
          <Navigation className="h-3.5 w-3.5 text-blue-600" /> Maps
        </button>
        <button onClick={() => openNav("waze")} className="h-10 px-3 rounded-full bg-[#33CCFF] shadow-lg flex items-center gap-1.5 text-white font-bold text-[10px] uppercase tracking-wider">
          <Navigation className="h-3.5 w-3.5" /> Waze
        </button>
      </div>

      {/* Bottom Sheet */}
      <motion.div
        drag="y" dragConstraints={{ top: -380, bottom: 0 }}
        animate={{ y: isExpanded ? -380 : 0 }}
        className="absolute bottom-0 inset-x-0 z-[1002] bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)] flex flex-col"
        style={{ height: '520px', marginBottom: '-380px' }}
      >
        <div className="w-full pt-3 pb-2" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto" />
        </div>

        <div className="px-6 pt-3 flex-1 flex flex-col overflow-y-auto">
          {/* Si hay múltiples pedidos, mostrar pestañas para seleccionar cuál ver/actualizar */}
          {allDeliveries.length > 1 && (
            <div className="flex gap-2 mb-4 bg-slate-100 p-1 rounded-xl">
              {allDeliveries.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setFocusedDeliveryId(d.id)}
                  className={`flex-1 py-2 text-center rounded-lg text-[10px] font-black uppercase transition-all ${
                    focusedDeliveryId === d.id
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Ped #{d.order_id.slice(-4).toUpperCase()} ({d.status === "aceptado" ? "Recoger" : "Entregar"})
                </button>
              ))}
            </div>
          )}

          {/* ETA bar */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-slate-900 tracking-tight">{routeInfo?.duration || "--"}</span>
              <span className="text-base font-bold text-slate-400">{routeInfo?.distance || "--"}</span>
            </div>
            <div className="bg-indigo-50 px-4 py-2 rounded-xl">
              <span className="text-sm font-black text-indigo-600">#{delivery.order_id.slice(-4).toUpperCase()}</span>
            </div>
          </div>

          <div className="w-full h-1 bg-slate-100 rounded-full mb-5 overflow-hidden">
            <div className="h-full bg-indigo-600 rounded-full transition-all duration-1000" style={{ width: `${Math.max(2, (1 - etaProgress) * 100)}%` }} />
          </div>

          {/* Multi-stop list */}
          {allDeliveries.length > 1 && (
            <div className="mb-3 space-y-1.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Paradas ({multiStops.length})</p>
              {multiStops.map((s, i) => (
                <div key={i} className="flex items-center gap-2 py-1">
                  <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-black text-white ${s.type === 'pickup' ? 'bg-emerald-500' : 'bg-indigo-600'}`}>
                    {i + 1}
                  </div>
                  <span className="text-[11px] font-semibold text-slate-700 truncate">{s.address}</span>
                </div>
              ))}
            </div>
          )}

          {/* Addresses */}
          <div className="space-y-3 mb-4">
            {allDeliveries.length <= 1 ? (
              <>
                <div className={`p-3 rounded-2xl border-2 ${isPickingUp ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-100 bg-slate-50'}`}>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-emerald-500 flex items-center justify-center text-sm">📦</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5">Recoger</p>
                      <p className="text-xs font-bold text-slate-800 truncate">{delivery.pickup_address}</p>
                    </div>
                  </div>
                </div>
                <div className={`p-3 rounded-2xl border-2 ${!isPickingUp ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-100 bg-slate-50'}`}>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center text-sm">🏠</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider mb-0.5">Entregar</p>
                      <p className="text-xs font-bold text-slate-800 truncate">{delivery.delivery_address}</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              multiStops.map((s, i) => (
                <div key={i} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white ${s.type === 'pickup' ? 'bg-emerald-500' : 'bg-indigo-600'}`}>
                      {s.completed ? '✓' : i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
                      <p className="text-[11px] font-semibold text-slate-700 truncate">{s.address}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Customer info */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl mb-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center"><User className="h-4 w-4 text-slate-500" /></div>
              <div>
                <p className="text-xs font-bold text-slate-900">{delivery.customer_name}</p>
                <p className="text-[10px] text-slate-400">Cliente</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {delivery.customer_phone && (
                <a href={`tel:${delivery.customer_phone}`} className="h-9 w-9 rounded-full bg-emerald-50 flex items-center justify-center">
                  <Phone className="h-4 w-4 text-emerald-600" />
                </a>
              )}
              <div className="text-right">
                <p className="text-sm font-black text-indigo-600">{fmt(delivery.amount || 0)}</p>
                <p className="text-[9px] text-slate-400">Por cobrar</p>
              </div>
            </div>
          </div>

          {/* Notes from Dispatch */}
          {delivery.notes && (
            <div className="mb-3 p-3 rounded-2xl bg-amber-50 border border-amber-200">
              <p className="text-[9px] font-bold text-amber-600 uppercase tracking-wider mb-1">Nota del despachador</p>
              <p className="text-xs font-medium text-amber-900 leading-relaxed">{delivery.notes}</p>
            </div>
          )}

          {/* Cancel / Report */}
          {!showCancel ? (
            <button onClick={() => setShowCancel(true)} className="flex items-center justify-center gap-2 text-slate-400 hover:text-red-500 transition-colors py-2">
              <XCircle className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Reportar Problema</span>
            </button>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 pb-3">
              <p className="text-xs font-bold text-slate-700">Selecciona el motivo:</p>
              <div className="flex flex-wrap gap-1.5">
                {CANCEL_REASONS.map(reason => (
                  <button
                    key={reason}
                    onClick={() => setCancelReason(reason)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${
                      cancelReason === reason
                        ? 'bg-red-500 text-white border-red-500'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              {/* Optional photo */}
              <div className="flex items-center gap-2">
                <button onClick={handlePhotoCapture} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-200 transition-colors">
                  <Camera className="h-3.5 w-3.5" />
                  {cancelPhotos.length > 0 ? `${cancelPhotos.length} foto(s)` : 'Agregar foto'}
                </button>
                {cancelPhotos.length > 0 && (
                  <div className="flex gap-1">
                    {cancelPhotos.map((photo, i) => (
                      <div key={i} className="relative">
                        <img src={photo} alt="evidence" className="h-10 w-10 rounded-lg object-cover border border-slate-200" />
                        <button onClick={() => setCancelPhotos(prev => prev.filter((_, j) => j !== i))} className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[8px] font-bold">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setShowCancel(false); setCancelReason(""); setCancelPhotos([]); }} className="flex-1 h-10 rounded-xl text-xs font-bold">Cerrar</Button>
                <Button variant="destructive" onClick={() => handleCancelDelivery(cancelReason)} disabled={cancelling || !cancelReason.trim()} className="flex-[2] h-10 rounded-xl text-xs font-bold">
                  {cancelling ? "Cancelando..." : "Liberar Pedido"}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Chat */}
          <div className="mb-2">
            {delivery.id && user && <ChatBubble deliveryId={delivery.id} currentUserId={user.id} isDriverView={true} />}
          </div>

          {/* Action Button */}
          <div className="mt-auto pb-8">
            {isPickingUp ? (
              <Button onClick={() => onPickedUp(delivery.id)} className="w-full h-16 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xl shadow-xl active:scale-[0.98] transition-all">
                YA RECOGÍ EL PEDIDO
              </Button>
            ) : (
              <Button onClick={() => onDelivered(delivery.id)} className="w-full h-16 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xl shadow-xl active:scale-[0.98] transition-all">
                PEDIDO ENTREGADO ✓
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      <style dangerouslySetInnerHTML={{ __html: `
        .maplibregl-ctrl { display: none !important; }
        ::-webkit-scrollbar { display: none; }
        .safe-top { padding-top: max(0.75rem, env(safe-area-inset-top)); }

        .nav-dot-wrapper {
          position: relative; width: 44px; height: 44px;
          display: flex; align-items: center; justify-content: center;
        }
        .nav-pulse {
          position: absolute; width: 56px; height: 56px; border-radius: 50%;
          background: rgba(79, 70, 229, 0.15);
          animation: navPulse 2s ease-out infinite;
        }
        .nav-arrow {
          position: relative; z-index: 2;
          transition: transform 0.5s ease;
          filter: drop-shadow(0 3px 8px rgba(79, 70, 229, 0.5));
        }
        @keyframes navPulse {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }
      `}} />
    </div>
  );
};

export default ActiveDeliveryView;
