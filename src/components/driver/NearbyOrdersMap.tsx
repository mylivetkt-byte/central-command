import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Package, MapPin, Navigation } from "lucide-react";
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

  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    mapInstance.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: currentLocation ? [currentLocation.lng, currentLocation.lat] : [-73.1198, 7.1193],
      zoom: 16,
      pitch: 60
    });

    mapInstance.current.on('style.load', () => {
      if (!mapInstance.current) return;
      
      // 3D Buildings Realistic
      mapInstance.current.addLayer({
        'id': '3d-buildings',
        'source': 'openfreemap',
        'source-layer': 'building',
        'type': 'fill-extrusion',
        'minzoom': 15,
        'paint': {
          'fill-extrusion-color': '#1a1c2e',
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

    // Driver Marker: LARGE MOTORCYCLE
    if (currentLocation) {
        const el = document.createElement('div');
        el.className = 'driver-marker-moto';
        el.innerHTML = `
          <div class="relative w-16 h-16 flex items-center justify-center">
            <div class="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping"></div>
            <div class="bg-indigo-600 rounded-[22px] p-3 shadow-[0_10px_30px_rgba(99,102,241,0.6)] border-4 border-white transition-all duration-300">
               <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>
            </div>
          </div>
        `;
        const m = new maplibregl.Marker({ element: el }).setLngLat([currentLocation.lng, currentLocation.lat]).addTo(map);
        markersRef.current.push(m);
    }

    // Orders Markers: LARGE PRICE TAGS
    orders.forEach(order => {
        if (!order.pickup_lat || !order.pickup_lng) return;
        
        const el = document.createElement('div');
        el.className = 'cursor-pointer group';
        el.innerHTML = `
          <div class="relative flex flex-col items-center">
            <div class="bg-emerald-500 text-white px-3 py-1.5 rounded-2xl text-[11px] font-black shadow-2xl mb-1 transform group-hover:scale-125 transition-all font-mono border-2 border-white/20">$${(order.commission/1000).toFixed(1)}k</div>
            <div class="h-5 w-5 bg-emerald-500 rounded-full border-2 border-white shadow-xl shadow-emerald-500/50"></div>
          </div>
        `;
        
        const marker = new maplibregl.Marker({ element: el })
            .setLngLat([order.pickup_lng, order.pickup_lat])
            .addTo(map);
        
        el.onclick = () => {
             map.easeTo({ center: [order.pickup_lng as number, order.pickup_lat as number], zoom: 17, pitch: 70, duration: 2000 });
        };
        
        markersRef.current.push(marker);
    });

    if (currentLocation && orders.length === 0) {
        map.easeTo({ center: [currentLocation.lng, currentLocation.lat], zoom: 16 });
    }
  }, [orders, currentLocation]);

  return (
    <div className="relative w-full h-full bg-slate-950">
      <div ref={mapContainer} className="w-full h-full grayscale-[0.1] contrast-[1.2] brightness-[0.8] saturate-[1.1]" />
      <div className="absolute top-4 left-4 pointer-events-none">
          <div className="bg-slate-900/80 backdrop-blur-2xl px-5 py-2.5 rounded-2xl border border-white/10 flex items-center gap-3 shadow-2xl">
              <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Mapa de Demanda</span>
          </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .maplibregl-ctrl { display: none !important; }
      `}} />
    </div>
  );
};

export default NearbyOrdersMap;
