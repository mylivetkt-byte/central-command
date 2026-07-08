import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapStyleSwitcher, useMapStyle, MapStyle } from '@/components/MapStyleSwitcher';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Target, TrendingUp, X, MapPin, Navigation, Bike, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface Order {
  id: string;
  order_id: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  amount: number;
  commission: number;
  pickup_address?: string;
  delivery_address?: string;
}

interface HotZone {
  name: string;
  lat: number;
  lng: number;
  intensity: number; // 0-1
  orderCount: number;
}

interface NearbyOrdersMapProps {
  orders: Order[];
  currentLocation: { lat: number; lng: number; heading?: number | null } | null;
  onAcceptOrder: (id: string) => void;
  hotZones?: HotZone[];
}

const DEFAULT_HOT_ZONES: HotZone[] = [
  { name: "Norte", lat: 4.68, lng: -74.06, intensity: 0.8, orderCount: 12 },
  { name: "Centro", lat: 4.6, lng: -74.08, intensity: 0.6, orderCount: 8 },
  { name: "Occidente", lat: 4.64, lng: -74.12, intensity: 0.4, orderCount: 5 },
  { name: "Sur", lat: 4.54, lng: -74.1, intensity: 0.7, orderCount: 10 },
];

const fmt = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

const NearbyOrdersMap: React.FC<NearbyOrdersMapProps> = ({ orders, currentLocation, onAcceptOrder, hotZones = DEFAULT_HOT_ZONES }) => {
  const { current: mapStyle, setStyle } = useMapStyle("dark");
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const driverMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [showHotZones, setShowHotZones] = useState(true);
  const heatLayerRef = useRef<any>(null);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

  const recenter = () => {
    if (!mapInstance.current || !currentLocation) return;
    mapInstance.current.easeTo({
      center: [currentLocation.lng, currentLocation.lat],
      zoom: 16,
      pitch: 55,
      bearing: currentLocation.heading || 0,
      duration: 1200
    });
  };

  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    mapInstance.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle.url,
      center: currentLocation ? [currentLocation.lng, currentLocation.lat] : [-73.1198, 7.1193],
      zoom: 16,
      pitch: 55,
    });

    mapInstance.current.on('style.load', () => {
      if (!mapInstance.current) return;
      const map = mapInstance.current;
      try {
        map.addLayer({
          id: '3d-buildings',
          source: 'carto',
          'source-layer': 'building',
          type: 'fill-extrusion',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': '#e2e8f0',
            'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
            'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
            'fill-extrusion-opacity': 0.6
          }
        });
      } catch {}

      // Add empty source for preview route
      if (!map.getSource('preview-route')) {
        map.addSource('preview-route', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } }
        });
        map.addLayer({
          id: 'preview-route-case',
          type: 'line',
          source: 'preview-route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#a5b4fc', 'line-width': 8, 'line-opacity': 0.4 }
        });
        map.addLayer({
          id: 'preview-route-line',
          type: 'line',
          source: 'preview-route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#4F46E5', 'line-width': 4, 'line-opacity': 1 }
        });
      }
    });

    return () => { mapInstance.current?.remove(); mapInstance.current = null; };
  }, []);

  // Hot zones overlay
  useEffect(() => {
    if (!mapInstance.current || !showHotZones) return;
    const map = mapInstance.current;

    // Remove old hot zone markers
    if (heatLayerRef.current) {
      heatLayerRef.current.forEach((m: maplibregl.Marker) => m.remove());
    }
    heatLayerRef.current = [];

    hotZones.forEach((zone) => {
      const el = document.createElement('div');
      const size = 60 + zone.intensity * 60;
      el.innerHTML = `
        <div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;pointer-events:none">
          <div style="position:absolute;width:100%;height:100%;border-radius:50%;background:rgba(244,63,94,${0.12 + zone.intensity * 0.18});animation:hotPulse ${2.5 - zone.intensity * 1.2}s ease-in-out infinite"></div>
          <div style="position:absolute;width:65%;height:65%;border-radius:50%;background:rgba(244,63,94,${0.2 + zone.intensity * 0.25});backdrop-filter:blur(2px);display:flex;flex-direction:column;align-items:center;justify-content:center;border:2px solid rgba(244,63,94,0.5)">
            <span style="font-size:${10 + zone.intensity * 4}px;font-weight:900;color:white;line-height:1;text-shadow:0 1px 4px rgba(0,0,0,0.5)">${zone.orderCount}</span>
            <span style="font-size:6px;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.5px">pedidos</span>
          </div>
        </div>
      `;
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([zone.lng, zone.lat])
        .addTo(map);
      heatLayerRef.current.push(marker);
    });
  }, [hotZones, showHotZones]);

  // Order marker placement & Driver marker tracking
  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (currentLocation) {
      const heading = currentLocation.heading || 0;
      if (!driverMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'driver-nav-marker';
        el.innerHTML = `
          <div class="driver-dot-wrapper">
            <div class="driver-pulse"></div>
            <div class="driver-accuracy"></div>
            <div class="driver-arrow" style="transform: rotate(${heading}deg)">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="24" cy="24" r="18" fill="#4F46E5" stroke="white" stroke-width="4"/>
                <path d="M24 12L30 28H18L24 12Z" fill="white"/>
              </svg>
            </div>
          </div>
        `;
        driverMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([currentLocation.lng, currentLocation.lat])
          .addTo(map);
      } else {
        driverMarkerRef.current.setLngLat([currentLocation.lng, currentLocation.lat]);
        const arrow = driverMarkerRef.current.getElement().querySelector('.driver-arrow') as HTMLElement;
        if (arrow) arrow.style.transform = `rotate(${heading}deg)`;
      }
    }

    orders.forEach(order => {
      if (!order.pickup_lat || !order.pickup_lng) return;
      const el = document.createElement('div');
      el.className = 'order-pickup-marker';
      el.innerHTML = `
        <div class="order-marker-pin">
          <div class="order-marker-inner">
            <span class="order-marker-price">$${(order.commission / 1000).toFixed(0)}k</span>
          </div>
          <div class="order-marker-stem"></div>
        </div>
      `;
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([order.pickup_lng, order.pickup_lat])
        .addTo(map);

      el.onclick = () => {
        setSelectedOrder(order);
        map.easeTo({
          center: [order.pickup_lng!, order.pickup_lat!],
          zoom: 17,
          pitch: 60,
          duration: 1000
        });
      };
      markersRef.current.push(marker);
    });
  }, [orders, currentLocation]);

  // Route preview fetcher
  useEffect(() => {
    if (!mapInstance.current || !selectedOrder || !currentLocation) {
      if (mapInstance.current) {
        const src = mapInstance.current.getSource('preview-route') as maplibregl.GeoJSONSource;
        if (src) src.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } });
      }
      setRouteInfo(null);
      return;
    }
    const map = mapInstance.current;
    setLoadingRoute(true);

    const waypoints = `${currentLocation.lng},${currentLocation.lat};${selectedOrder.pickup_lng},${selectedOrder.pickup_lat}`;
    fetch(`https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`)
      .then(res => res.json())
      .then(data => {
        setLoadingRoute(false);
        if (data.routes?.[0]) {
          const route = data.routes[0];
          const coordinates = route.geometry.coordinates;
          const src = map.getSource('preview-route') as maplibregl.GeoJSONSource;
          if (src) {
            src.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } });
          }

          // Calculate bounding box to fit route
          const lats = [currentLocation.lat, selectedOrder.pickup_lat!];
          const lngs = [currentLocation.lng, selectedOrder.pickup_lng!];
          map.fitBounds([
            [Math.min(...lngs) - 0.002, Math.min(...lats) - 0.002],
            [Math.max(...lngs) + 0.002, Math.max(...lats) + 0.002]
          ], { padding: 80, duration: 1000 });

          setRouteInfo({
            distance: (route.distance / 1000).toFixed(1) + " km",
            duration: Math.ceil(route.duration / 60) + " min"
          });
        }
      })
      .catch(() => {
        setLoadingRoute(false);
      });
  }, [selectedOrder, currentLocation]);

  const handleStyleChange = useCallback((style: MapStyle) => {
    setStyle(style.id);
    mapInstance.current?.setStyle(style.url);
  }, [setStyle]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div ref={mapContainer} className="w-full h-full" />

      <MapStyleSwitcher 
        current={mapStyle} 
        onSelect={handleStyleChange} 
        position="top-right"
        dark={mapStyle.id === 'dark'}
      />

      {/* Hot zones toggle */}
      <div className="absolute right-4 bottom-40 z-[1001]">
        <Button
          variant="secondary"
          size="icon"
          className={`h-12 w-12 rounded-full shadow-lg border active:scale-90 transition-all ${showHotZones ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-700 border-slate-200'}`}
          onClick={() => setShowHotZones(!showHotZones)}
        >
          <TrendingUp className="h-5 w-5" />
        </Button>
      </div>

      {/* Recenter */}
      <div className="absolute right-4 bottom-28 z-[1001]">
        <Button
          variant="secondary"
          size="icon"
          className="h-12 w-12 rounded-full bg-white shadow-lg border border-slate-200 text-slate-700 active:scale-90 transition-all"
          onClick={recenter}
        >
          <Target className="h-5 w-5" />
        </Button>
      </div>

      {/* Status pill */}
      <div className="absolute top-4 left-4 z-[1001] pointer-events-none">
        <div className="bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-full flex items-center gap-2.5 shadow-lg border border-slate-100">
          <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-xs font-bold text-slate-700">En línea</span>
          <span className="text-[10px] text-slate-400 font-semibold">{orders.length} disponibles</span>
        </div>
      </div>

      {/* Selected Order Bottom Preview Card */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div
            initial={{ y: 200, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 200, opacity: 0 }}
            className="absolute bottom-6 inset-x-4 z-[1002] bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex flex-col gap-4"
          >
            {/* Header / Earnings */}
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <Bike className="h-4 w-4 text-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Vista Previa de Ruta</span>
                </div>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">ID: #{selectedOrder.order_id.slice(-4).toUpperCase()}</p>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider leading-none mb-0.5">Ganancia</span>
                <span className="text-2xl font-black text-indigo-600">{fmt(selectedOrder.commission)}</span>
              </div>
            </div>

            {/* OSRM Route Stats */}
            {routeInfo && (
              <div className="flex gap-4 bg-slate-50 border border-slate-100 p-3 rounded-2xl">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Navigation className="h-4 w-4 text-indigo-500" />
                  <span className="text-xs font-black">{routeInfo.distance} de trayecto</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Clock className="h-4 w-4 text-indigo-500" />
                  <span className="text-xs font-black">~{routeInfo.duration} est.</span>
                </div>
              </div>
            )}

            {/* Addresses */}
            <div className="relative space-y-3 pl-1">
              <div className="absolute left-[7px] top-2 bottom-2 w-[1.5px] bg-slate-100" />
              <div className="flex gap-3 relative">
                <div className="h-3 w-3 rounded-full bg-emerald-500 border-2 border-white mt-1 shadow-sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-[8px] font-black text-emerald-600 uppercase tracking-wider mb-0.5">Punto de Recogida</p>
                  <p className="text-xs font-bold text-slate-800 truncate">{selectedOrder.pickup_address || "Dirección de Recogida"}</p>
                </div>
              </div>
              <div className="flex gap-3 relative">
                <div className="h-3 w-3 rounded-full bg-indigo-500 border-2 border-white mt-1 shadow-sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-[8px] font-black text-indigo-600 uppercase tracking-wider mb-0.5">Punto de Entrega</p>
                  <p className="text-xs font-bold text-slate-800 truncate">{selectedOrder.delivery_address || "Dirección de Entrega"}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedOrder(null)}
                className="flex-1 h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <X className="h-4 w-4" /> Cancelar
              </button>
              <button
                onClick={() => {
                  onAcceptOrder(selectedOrder.id);
                  setSelectedOrder(null);
                }}
                className="flex-[2] h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <Bike className="h-5 w-5" /> Aceptar Pedido
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        .maplibregl-ctrl-bottom-left, .maplibregl-ctrl-bottom-right, .maplibregl-ctrl-top-right { display: none !important; }

        .driver-dot-wrapper {
          position: relative;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .driver-pulse {
          position: absolute;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: rgba(79, 70, 229, 0.15);
          animation: driverPulse 2s ease-out infinite;
        }
        .driver-accuracy {
          position: absolute;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(79, 70, 229, 0.08);
        }
        .driver-arrow {
          position: relative;
          z-index: 2;
          transition: transform 0.6s ease;
          filter: drop-shadow(0 4px 12px rgba(79, 70, 229, 0.5));
        }
        @keyframes driverPulse {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes hotPulse {
          0% { transform: scale(0.85); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(0.85); opacity: 0.6; }
        }

        .order-pickup-marker {
          cursor: pointer;
        }
        .order-marker-pin {
          display: flex;
          flex-direction: column;
          align-items: center;
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.15));
          cursor: pointer;
          transition: transform 0.2s;
        }
        .order-marker-pin:hover { transform: scale(1.15); }
        .order-marker-inner {
          background: #10b981;
          color: white;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 800;
          border: 3px solid white;
          line-height: 1;
        }
        .order-marker-stem {
          width: 3px;
          height: 10px;
          background: #10b981;
          border-radius: 0 0 2px 2px;
        }
        .order-marker-price { font-family: system-ui, -apple-system, sans-serif; }
      `}} />
    </div>
  );
};

export default NearbyOrdersMap;
