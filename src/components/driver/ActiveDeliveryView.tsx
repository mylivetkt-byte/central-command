import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Phone, 
  Clock, 
  Package, 
  CheckCircle2, 
  Loader2,
  Navigation2,
  Target,
  ArrowUpRight,
  ChevronUp,
  MapPin,
  ExternalLink,
  MessageSquare,
  Navigation
} from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';

interface Delivery {
  id: string;
  order_id: string;
  status: string;
  customer_name: string;
  customer_phone?: string | null;
  pickup_address?: string;
  delivery_address: string;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  created_at?: string;
}

interface ActiveDeliveryViewProps {
  delivery: Delivery;
  currentLocation: { lat: number; lng: number; heading: number | null } | null;
  onPickedUp: () => void;
  onDelivered: () => void;
}

const ActiveDeliveryView: React.FC<ActiveDeliveryViewProps> = ({ 
  delivery, 
  currentLocation, 
  onPickedUp, 
  onDelivered 
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const driverMarkerRef = useRef<maplibregl.Marker | null>(null);
  const pickupMarkerRef = useRef<maplibregl.Marker | null>(null);
  const deliveryMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [followMode, setFollowMode] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string; nextStreet: string; nextManeuver: string } | null>(null);

  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    mapInstance.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: currentLocation ? [currentLocation.lng, currentLocation.lat] : [delivery.pickup_lng || -73.1198, delivery.pickup_lat || 7.1193],
      zoom: 17,
      pitch: 65,
      bearing: currentLocation?.heading || 0
    });

    mapInstance.current.on('load', () => setIsMapReady(true));
    return () => { mapInstance.current?.remove(); mapInstance.current = null; };
  }, []);

  const fetchRoute = async () => {
    if (!isMapReady || !mapInstance.current || !currentLocation) return;
    const map = mapInstance.current;

    // Ruta de 2 segmentos: Conductor -> Recogida -> Entrega
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
            const coordinates = route.geometry.coordinates;
            
            const routeSource = 'route-source';
            if (map.getSource(routeSource)) {
                (map.getSource(routeSource) as maplibregl.GeoJSONSource).setData({ 
                    type: 'Feature', 
                    properties: {}, 
                    geometry: { type: 'LineString', coordinates } 
                });
            } else {
                map.addSource(routeSource, { 
                    type: 'geojson', 
                    data: { 
                        type: 'Feature', 
                        properties: {}, 
                        geometry: { type: 'LineString', coordinates } 
                    } 
                });
                map.addLayer({ id: 'route-line-casing', type: 'line', source: routeSource, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 10, 'line-opacity': 1 } });
                map.addLayer({ id: 'route-line', type: 'line', source: routeSource, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#6366f1', 'line-width': 6, 'line-opacity': 1 } });
            }

            const nextStep = route.legs[0].steps[1] || route.legs[0].steps[0];
            setRouteInfo({
                distance: (route.distance / 1000).toFixed(1) + " km",
                duration: Math.ceil(route.duration / 60) + " min",
                nextStreet: nextStep.name || "Continuar",
                nextManeuver: (nextStep.distance < 1000) ? Math.round(nextStep.distance) + " m" : (nextStep.distance/1000).toFixed(1) + " km"
            });
        }
    } catch (err) { console.error("OSRM Error:", err); }
  };

  useEffect(() => {
    fetchRoute();
    const int = setInterval(fetchRoute, 5000);
    return () => clearInterval(int);
  }, [isMapReady, currentLocation?.lat, delivery.status]);

  useEffect(() => {
    if (!isMapReady || !mapInstance.current || !currentLocation) return;
    const map = mapInstance.current;

    // Conductor
    if (!driverMarkerRef.current) {
        const el = document.createElement('div');
        el.innerHTML = `<div class="relative w-12 h-12 flex items-center justify-center"><div class="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping"></div><div class="bg-indigo-600 rounded-full p-2 shadow-2xl border-4 border-white"><svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M12 2L19 21L12 17L5 21L12 2Z" /></svg></div></div>`;
        driverMarkerRef.current = new maplibregl.Marker({ element: el, rotationAlignment: 'map' }).setLngLat([currentLocation.lng, currentLocation.lat]).addTo(map);
    } else {
        driverMarkerRef.current.setLngLat([currentLocation.lng, currentLocation.lat]);
        if (currentLocation.heading !== null) driverMarkerRef.current.setRotation(currentLocation.heading);
    }

    const addMarker = (ref: any, lat: any, lng: any, emoji: string, color: string) => {
        if (!lat || !lng) return;
        if (!ref.current) {
            const el = document.createElement('div');
            el.innerHTML = `<div class="bg-${color} text-white p-2 rounded-2xl shadow-2xl border-2 border-white flex items-center justify-center text-lg">${emoji}</div>`;
            ref.current = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
        } else ref.current.setLngLat([lng, lat]);
    };

    addMarker(pickupMarkerRef, delivery.pickup_lat, delivery.pickup_lng, '🏠', 'emerald-500');
    addMarker(deliveryMarkerRef, delivery.delivery_lat, delivery.delivery_lng, '🏁', 'indigo-600');

    if (followMode) {
      map.easeTo({ center: [currentLocation.lng, currentLocation.lat], bearing: currentLocation.heading || 0, pitch: 65, zoom: 18, duration: 1000 });
    }
  }, [currentLocation, followMode, isMapReady, delivery]);

  return (
    <div className="h-full w-full bg-[#020617] overflow-hidden relative font-sans text-white">
      <AnimatePresence>
        {routeInfo && (
          <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="absolute top-4 inset-x-4 z-50 pointer-events-none">
            <div className="bg-slate-900/95 backdrop-blur-2xl rounded-[32px] p-6 shadow-2xl border border-white/5 flex items-center gap-6 max-w-sm mx-auto">
               <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-500/30"><ArrowUpRight className="h-8 w-8 text-white stroke-[3px]" /></div>
               <div className="flex flex-col">
                  <span className="text-4xl font-black text-white leading-none mb-1">{routeInfo.nextManeuver}</span>
                  <span className="text-base font-bold text-indigo-400 capitalize">{routeInfo.nextStreet}</span>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={mapContainer} className="h-full w-full contrast-[1.1] brightness-[0.9]" />

      <div className="absolute right-4 bottom-48 z-40 flex flex-col gap-3">
          <Button variant="secondary" size="icon" className={`h-14 w-14 rounded-full shadow-2xl transition-all ${followMode ? 'bg-indigo-600 text-white' : 'bg-white text-slate-900 border-none'}`} onClick={() => setFollowMode(!followMode)}>
            <Target className="h-7 w-7" />
          </Button>
      </div>

      <motion.div 
        drag="y" dragConstraints={{ top: -420, bottom: 0 }} dragElastic={0.05}
        animate={{ y: isExpanded ? -420 : 0 }}
        className="absolute bottom-0 inset-x-0 z-50 bg-white rounded-t-[48px] shadow-[0_-20px_80px_rgba(0,0,0,0.5)] flex flex-col"
        style={{ height: '560px', marginBottom: '-420px' }}
      >
          <div className="w-full pt-4 pb-2 group" onClick={() => setIsExpanded(!isExpanded)}>
              <div className="w-14 h-1.5 bg-slate-100 rounded-full mx-auto group-hover:bg-slate-200 transition-colors" />
          </div>

          <div className="px-10 pt-4 flex-1">
              <div className="flex items-center justify-between mb-8">
                  <div className="flex flex-col">
                      <span className="text-4xl font-black text-slate-900 leading-none">{routeInfo?.duration || "Calculando"}</span>
                      <span className="text-sm font-bold text-slate-400 mt-2 tracking-widest uppercase">{routeInfo?.distance || "--"} • {delivery.status === 'aceptado' ? 'A RE recogida' : 'A destino'}</span>
                  </div>
                  <div className="bg-indigo-50 px-5 py-2.5 rounded-2xl flex flex-col items-center">
                    <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Orden</span>
                    <span className="text-sm font-black text-indigo-600">#{delivery.order_id.slice(-4)}</span>
                  </div>
              </div>

              <div className="space-y-4 mb-10">
                  <div className={`p-6 rounded-[28px] border-2 transition-all ${delivery.status === 'aceptado' ? 'border-indigo-600/20 bg-indigo-50/10' : 'border-slate-50 bg-slate-50 opacity-40'}`}>
                      <div className="flex items-center gap-5">
                          <div className="h-12 w-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white text-xl">🏠</div>
                          <div className="flex-1 overflow-hidden">
                              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-1">Recogida</p>
                              <p className="text-sm font-black text-slate-800 truncate">{delivery.pickup_address}</p>
                          </div>
                      </div>
                  </div>

                  <div className={`p-6 rounded-[28px] border-2 transition-all ${delivery.status === 'en_camino' ? 'border-indigo-600/20 bg-indigo-50/10' : 'border-slate-50 bg-slate-50 opacity-40'}`}>
                      <div className="flex items-center gap-5">
                          <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-xl">🏁</div>
                          <div className="flex-1 overflow-hidden">
                              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-1">Entrega Cliente</p>
                              <p className="text-sm font-black text-slate-800 truncate">{delivery.customer_name}</p>
                          </div>
                      </div>
                  </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {delivery.status === 'aceptado' ? (
                    <Button onClick={onPickedUp} className="w-full h-20 rounded-[32px] bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xl shadow-2xl shadow-indigo-200 active:scale-95 transition-all">YA RECOGÍ EL PEDIDO</Button>
                ) : (
                    <Button onClick={onDelivered} className="w-full h-20 rounded-[32px] bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xl shadow-2xl shadow-emerald-100 active:scale-95 transition-all">ENTREGA EXITOSA</Button>
                )}
                
                <div className="flex gap-4">
                    <Button variant="outline" className="flex-1 h-16 rounded-[24px] border-slate-100 text-slate-400 font-black text-xs hover:bg-slate-50" onClick={() => window.open(`tel:${delivery.customer_phone}`)}><Phone className="mr-2 h-4 w-4" /> LLAMAR</Button>
                    <Button variant="outline" className="flex-1 h-16 rounded-[24px] border-slate-100 text-slate-400 font-black text-xs hover:bg-slate-50" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${delivery.pickup_lat},${delivery.pickup_lng}`, '_blank')}><ExternalLink className="mr-2 h-4 w-4" /> GPS</Button>
                </div>
              </div>
          </div>
      </motion.div>

      <style dangerouslySetInnerHTML={{ __html: `
        .maplibregl-ctrl-bottom-left, .maplibregl-ctrl-bottom-right { display: none !important; }
        ::-webkit-scrollbar { display: none; }
      `}} />
    </div>
  );
};

export default ActiveDeliveryView;
