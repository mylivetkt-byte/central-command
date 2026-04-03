import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Package, MapPin, Navigation, Target, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Order {
  id: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  amount: number;
  commission: number;
}

interface NearbyOrdersMapProps {
  orders: Order[];
  currentLocation: { lat: number; lng: number } | null;
  onAcceptOrder: (id: string) => void;
}

const NearbyOrdersMap: React.FC<NearbyOrdersMapProps> = ({ orders, currentLocation, onAcceptOrder }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const recenter = () => {
    if (!mapInstance.current || !currentLocation) return;
    mapInstance.current.easeTo({
        center: [currentLocation.lng, currentLocation.lat],
        zoom: 17,
        pitch: 65,
        duration: 1500
    });
  };

  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    mapInstance.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: currentLocation ? [currentLocation.lng, currentLocation.lat] : [-73.1198, 7.1193],
      zoom: 16,
      pitch: 60,
      antialias: false // Already removed to fix TS
    });

    mapInstance.current.on('style.load', () => {
      if (!mapInstance.current) return;
      
      // Realism: 3D Buildings
      mapInstance.current.addLayer({
        'id': '3d-buildings',
        'source': 'openfreemap',
        'source-layer': 'building',
        'type': 'fill-extrusion',
        'minzoom': 15,
        'paint': {
          'fill-extrusion-color': [
            'interpolate', ['linear'], ['get', 'render_height'],
            0, '#1e293b',
            20, '#0f172a'
          ],
          'fill-extrusion-height': ['get', 'render_height'],
          'fill-extrusion-base': ['get', 'render_min_height'],
          'fill-extrusion-opacity': 0.8
        }
      });
    });

    return () => { mapInstance.current?.remove(); mapInstance.current = null; };
  }, []);

  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Driver Marker: HIGH DETAIL MOTORCYCLE with Shadow
    if (currentLocation) {
        const el = document.createElement('div');
        el.className = 'driver-marker-moto-advanced';
        el.innerHTML = `
          <div class="relative w-20 h-20 flex items-center justify-center pointer-events-none transform-gpu">
            <!-- Ground Shadow (Better Integration) -->
            <div class="absolute bottom-4 h-6 w-12 bg-black/40 rounded-full blur-md"></div>
            
            <div class="bg-indigo-600 rounded-[28px] p-4 shadow-[0_15px_40px_rgba(99,102,241,0.5)] border-4 border-white transform hover:scale-110 transition-all duration-300">
               <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="drop-shadow-2xl"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>
            </div>
            
            <!-- Pulse ring -->
            <div class="absolute inset-0 border-4 border-indigo-400/30 rounded-full animate-ping scale-75"></div>
          </div>
        `;
        const m = new maplibregl.Marker({ 
            element: el, 
            anchor: 'bottom', // Anchoring to bottom for better precision at high pitch
            rotationAlignment: 'map' 
        })
        .setLngLat([currentLocation.lng, currentLocation.lat])
        .addTo(map);
        markersRef.current.push(m);
    }

    // Orders Markers
    orders.forEach(order => {
        if (!order.pickup_lat || !order.pickup_lng) return;
        
        const el = document.createElement('div');
        el.className = 'cursor-pointer group';
        el.innerHTML = `
          <div class="relative flex flex-col items-center">
            <div class="bg-emerald-500 text-white px-4 py-1.5 rounded-[20px] text-xs font-black shadow-2xl mb-1 transform group-hover:scale-125 transition-all font-mono border-2 border-white/30">$${(order.commission/1000).toFixed(1)}k</div>
            <div class="h-4 w-4 bg-emerald-500 rounded-full border-2 border-white shadow-xl shadow-emerald-500/50"></div>
          </div>
        `;
        
        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([order.pickup_lng, order.pickup_lat])
            .addTo(map);
        
        el.onclick = () => {
             map.easeTo({ center: [order.pickup_lng as number, order.pickup_lat as number], zoom: 17, pitch: 70, duration: 1500 });
        };
        
        markersRef.current.push(marker);
    });

  }, [orders, currentLocation]);

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden">
      <div ref={mapContainer} className="w-full h-full grayscale-[0.05] contrast-[1.2] brightness-[0.85]" />
      
      {/* Botón de Centrar */}
      <div className="absolute right-6 bottom-32 z-[1001] flex flex-col gap-4">
          <Button 
            variant="secondary" 
            size="icon" 
            className="h-14 w-14 rounded-[22px] bg-white/95 backdrop-blur-xl shadow-2xl border-none text-slate-900 active:scale-90 transition-all group"
            onClick={recenter}
          >
              <Target className="h-7 w-7 group-hover:text-indigo-600 transition-colors" />
          </Button>
      </div>

      <div className="absolute top-6 left-6 pointer-events-none">
          <div className="bg-slate-900/80 backdrop-blur-3xl px-6 py-3 rounded-[24px] border border-white/10 flex items-center gap-3 shadow-2xl">
              <div className="h-2.5 w-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none mb-1">Mapa Directo</span>
                <span className="text-[8px] font-bold text-white/30 uppercase tracking-[0.2em] leading-none">Rutas de alta demanda</span>
              </div>
          </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .maplibregl-ctrl-bottom-left, .maplibregl-ctrl-bottom-right { display: none !important; }
        .driver-marker-moto-advanced { transition: all 1s linear; }
      `}} />
    </div>
  );
};

export default NearbyOrdersMap;
