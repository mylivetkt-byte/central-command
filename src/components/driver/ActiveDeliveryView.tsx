import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Button } from "@/components/ui/button";
import { 
  Phone, 
  Package, 
  Navigation,
  ArrowUpRight,
  ChevronUp,
  ExternalLink,
  Check,
  Bike
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
      style: 'https://tiles.openfreemap.org/styles/liberty', // Liberty style has good detail
      center: currentLocation ? [currentLocation.lng, currentLocation.lat] : [delivery.pickup_lng || -73.1198, delivery.pickup_lat || 7.1193],
      zoom: 18,
      pitch: 75,
      bearing: currentLocation?.heading || 0,
      antialias: true
    });

    mapInstance.current.on('style.load', () => {
        setIsMapReady(true);
        const map = mapInstance.current;
        if (!map) return;

        // Custom 3D Buildings - Premium realism
        map.addLayer({
            'id': '3d-buildings-realistic',
            'source': 'openfreemap',
            'source-layer': 'building',
            'type': 'fill-extrusion',
            'minzoom': 15,
            'paint': {
              'fill-extrusion-color': [
                'interpolate', ['linear'], ['get', 'render_height'],
                0, '#1a1c2c',
                20, '#2d3436',
                50, '#020617'
              ],
              'fill-extrusion-height': ['get', 'render_height'],
              'fill-extrusion-base': ['get', 'render_min_height'],
              'fill-extrusion-opacity': 0.85
            }
        });
    });

    return () => { mapInstance.current?.remove(); mapInstance.current = null; };
  }, []);

  const fetchRoute = async () => {
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
            const coordinates = route.geometry.coordinates;
            
            const sourceId = 'route-source';
            const casingId = 'route-line-casing';
            const lineId = 'route-line';

            if (!map.getSource(sourceId)) {
                map.addSource(sourceId, { 
                    type: 'geojson', 
                    data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } } 
                });
                
                // Neon glow casing
                map.addLayer({
                    id: casingId,
                    type: 'line',
                    source: sourceId,
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: { 'line-color': '#ffffff', 'line-width': 14, 'line-opacity': 0.15, 'line-blur': 10 }
                });
                
                map.addLayer({
                    id: casingId + '-border',
                    type: 'line',
                    source: sourceId,
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: { 'line-color': '#ffffff', 'line-width': 10, 'line-opacity': 1 }
                });

                map.addLayer({
                    id: lineId,
                    type: 'line',
                    source: sourceId,
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: { 'line-color': '#6366f1', 'line-width': 6, 'line-opacity': 1 }
                });
            } else {
                const source = map.getSource(sourceId) as maplibregl.GeoJSONSource;
                source.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } });
            }

            const nextStep = route.legs[0].steps[1] || route.legs[0].steps[0];
            setRouteInfo({
                distance: (route.distance / 1000).toFixed(1) + " km",
                duration: Math.ceil(route.duration / 60) + " min",
                nextStreet: nextStep.name || "Continuar camino",
                nextManeuver: (nextStep.distance < 1000) ? Math.round(nextStep.distance) + " m" : (nextStep.distance/1000).toFixed(1) + " km"
            });
        }
    } catch (err) { console.error("OSRM Error:", err); }
  };

  useEffect(() => {
    fetchRoute();
    const int = setInterval(fetchRoute, 4000);
    return () => clearInterval(int);
  }, [isMapReady, currentLocation?.lat, delivery.status]);

  useEffect(() => {
    if (!isMapReady || !mapInstance.current || !currentLocation) return;
    const map = mapInstance.current;

    // Driver Marker: MOTORCYCLE Icon
    if (!driverMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'driver-marker';
        el.innerHTML = `
          <div class="relative w-16 h-16 flex items-center justify-center">
            <div class="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping"></div>
            <div class="bg-indigo-600 rounded-[20px] p-2.5 shadow-[0_15px_40px_rgba(99,102,241,0.8)] border-4 border-white transition-all duration-300 transform preserve-3d">
               <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bike"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>
            </div>
          </div>
        `;
        driverMarkerRef.current = new maplibregl.Marker({ element: el, rotationAlignment: 'map' })
            .setLngLat([currentLocation.lng, currentLocation.lat])
            .addTo(map);
    } else {
        driverMarkerRef.current.setLngLat([currentLocation.lng, currentLocation.lat]);
        if (currentLocation.heading !== null) {
            const inner = driverMarkerRef.current.getElement().querySelector('div > div:nth-child(2)');
            if (inner) (inner as HTMLElement).style.transform = `rotate(${currentLocation.heading}deg)`;
        }
    }

    const addMarker = (ref: any, lat: any, lng: any, emoji: string, bg: string) => {
        if (!lat || !lng) return;
        if (!ref.current) {
            const el = document.createElement('div');
            el.innerHTML = `<div class="h-14 w-14 ${bg} rounded-[22px] flex items-center justify-center text-2xl shadow-2xl border-4 border-white/20">${emoji}</div>`;
            ref.current = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
        } else ref.current.setLngLat([lng, lat]);
    };

    addMarker(pickupMarkerRef, delivery.pickup_lat, delivery.pickup_lng, '🏠', 'bg-emerald-500');
    addMarker(deliveryMarkerRef, delivery.delivery_lat, delivery.delivery_lng, '🏁', 'bg-indigo-600');

    if (followMode) {
      map.easeTo({ center: [currentLocation.lng, currentLocation.lat], bearing: currentLocation.heading || 0, pitch: 75, duration: 2000 });
    }
  }, [currentLocation, followMode, isMapReady, delivery]);

  return (
    <div className="h-full w-full bg-[#020617] overflow-hidden relative font-sans">
      <AnimatePresence>
        {routeInfo && (
          <motion.div initial={{ y: -100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="absolute top-12 inset-x-4 z-[1001] pointer-events-none">
            <div className="bg-slate-900/90 backdrop-blur-3xl rounded-[32px] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.6)] border border-white/10 flex items-center gap-6 max-w-sm mx-auto">
               <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-500/50">
                  <ArrowUpRight className="h-9 w-9 text-white stroke-[3px]" />
               </div>
               <div className="flex flex-col">
                  <span className="text-5xl font-black text-white leading-none mb-1 tracking-tighter">{routeInfo.nextManeuver}</span>
                  <span className="text-sm font-bold text-indigo-400 capitalize truncate w-40">{routeInfo.nextStreet}</span>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={mapContainer} className="h-full w-full contrast-[1.2] brightness-[0.85] saturate-[1.2]" />

      <div className="absolute right-6 bottom-48 z-[1001] flex flex-col gap-4">
          <Button variant="secondary" size="icon" className={`h-16 w-16 rounded-[24px] shadow-2xl transition-all ${followMode ? 'bg-indigo-600 text-white' : 'bg-white text-slate-950'}`} onClick={() => setFollowMode(!followMode)}>
            <Navigation className={`h-8 w-8 ${followMode ? 'animate-pulse' : ''}`} />
          </Button>
      </div>

      <motion.div 
        drag="y" dragConstraints={{ top: -420, bottom: 0 }} dragElastic={0.05}
        animate={{ y: isExpanded ? -420 : 0 }}
        className="absolute bottom-0 inset-x-0 z-[1002] bg-white rounded-t-[55px] shadow-[0_-40px_120px_rgba(0,0,0,0.7)] flex flex-col"
        style={{ height: '560px', marginBottom: '-420px' }}
      >
          <div className="w-full pt-4 pb-2 active:bg-slate-50 transition-colors" onClick={() => setIsExpanded(!isExpanded)}>
              <div className="w-20 h-1.5 bg-slate-200 rounded-full mx-auto" />
          </div>

          <div className="px-10 pt-6 flex-1 flex flex-col h-full">
              <div className="flex items-center justify-between mb-8">
                  <div className="flex flex-col">
                      <div className="flex items-center gap-3">
                          <span className="text-6xl font-black text-slate-900 tracking-tighter leading-none">{routeInfo?.duration || "--"}</span>
                          <div className="flex flex-col">
                              <span className="text-lg font-bold text-slate-400">{routeInfo?.distance || "--"}</span>
                              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] leading-none mt-1">Estimado</span>
                          </div>
                      </div>
                  </div>
                  <div className="bg-indigo-50 px-6 py-3 rounded-2xl flex flex-col items-center">
                    <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest leading-none mb-1">Orden</span>
                    <span className="text-lg font-black text-indigo-600">#{delivery.order_id.slice(-4)}</span>
                  </div>
              </div>

              <div className="space-y-4 mb-8">
                  <div className={`p-6 rounded-[35px] border-2 transition-all ${delivery.status === 'aceptado' ? 'border-indigo-600 bg-indigo-50/20' : 'border-slate-100 opacity-40'}`}>
                      <div className="flex items-center gap-5">
                          <div className="h-14 w-14 rounded-2xl bg-emerald-500 flex items-center justify-center text-white text-2xl shadow-lg">🏠</div>
                          <div className="flex-1 overflow-hidden">
                              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-1">Punto de Recogida</p>
                              <p className="text-base font-black text-slate-800 truncate">{delivery.pickup_address}</p>
                          </div>
                      </div>
                  </div>

                  <div className={`p-6 rounded-[35px] border-2 transition-all ${delivery.status === 'en_camino' ? 'border-indigo-600 bg-indigo-400/5' : 'border-slate-100 opacity-40'}`}>
                      <div className="flex items-center gap-5">
                          <div className="h-14 w-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-2xl shadow-lg">🏁</div>
                          <div className="flex-1 overflow-hidden">
                              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-1">Punto de Entrega</p>
                              <p className="text-base font-black text-slate-800 truncate">{delivery.customer_name}</p>
                          </div>
                      </div>
                  </div>
              </div>

              <div className="mt-auto pb-12 space-y-4">
                {delivery.status === 'aceptado' ? (
                    <Button onClick={onPickedUp} className="w-full h-22 rounded-[40px] bg-indigo-600 hover:bg-indigo-700 text-white font-black text-2xl shadow-[0_20px_50px_rgba(99,102,241,0.3)] active:scale-95 transition-all flex items-center justify-center gap-4">
                        <Package className="h-7 w-7" /> YA RECOGÍ
                    </Button>
                ) : (
                    <Button onClick={onDelivered} className="w-full h-22 rounded-[40px] bg-emerald-500 hover:bg-emerald-600 text-white font-black text-2xl shadow-[0_20px_50px_rgba(16,185,129,0.3)] active:scale-95 transition-all flex items-center justify-center gap-4">
                        <Check className="h-8 w-8 stroke-[4px]" /> ENTREGADO
                    </Button>
                )}
                
                <div className="flex gap-4">
                    <Button variant="outline" className="flex-1 h-16 rounded-[28px] border-slate-100 text-slate-500 font-black text-[10px] hover:bg-slate-50 px-0 hover:text-indigo-600 transition-all uppercase tracking-widest" onClick={() => window.open(`tel:${delivery.customer_phone}`)}><Phone className="mr-2 h-4 w-4" /> Telefonear</Button>
                    <Button variant="outline" className="flex-1 h-16 rounded-[28px] border-slate-100 text-slate-500 font-black text-[10px] hover:bg-slate-50 px-0 hover:text-indigo-600 transition-all uppercase tracking-widest" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${delivery.status==='aceptado'?delivery.pickup_lat:delivery.delivery_lat},${delivery.status==='aceptado'?delivery.pickup_lng:delivery.delivery_lng}`, '_blank')}><ExternalLink className="mr-2 h-4 w-4" /> Abrir GPS</Button>
                </div>
              </div>
          </div>
      </motion.div>

      <style dangerouslySetInnerHTML={{ __html: `
        .maplibregl-ctrl { display: none !important; }
        ::-webkit-scrollbar { display: none; }
        .driver-marker { transition: transform 0.3s ease; }
        .preserve-3d { transform-style: preserve-3d; }
      `}} />
    </div>
  );
};

export default ActiveDeliveryView;
