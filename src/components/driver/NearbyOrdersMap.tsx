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
      zoom: 14,
      pitch: 45,
      antialias: true
    });

    mapInstance.current.on('load', () => {
      if (!mapInstance.current) return;
      // 3D Buildings
      mapInstance.current.addLayer({
        'id': '3d-buildings',
        'source': 'openfreemap',
        'source-layer': 'building',
        'type': 'fill-extrusion',
        'minzoom': 15,
        'paint': {
          'fill-extrusion-color': '#1e293b',
          'fill-extrusion-height': ['get', 'render_height'],
          'fill-extrusion-base': ['get', 'render_min_height'],
          'fill-extrusion-opacity': 0.6
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

    // Driver Marker
    if (currentLocation) {
        const el = document.createElement('div');
        el.innerHTML = `<div class="relative w-8 h-8 bg-indigo-600 rounded-full border-4 border-white shadow-2xl flex items-center justify-center animate-pulse"><div class="h-2 w-2 bg-white rounded-full"></div></div>`;
        const m = new maplibregl.Marker({ element: el }).setLngLat([currentLocation.lng, currentLocation.lat]).addTo(map);
        markersRef.current.push(m);
    }

    // Orders Markers
    orders.forEach(order => {
        if (!order.pickup_lat || !order.pickup_lng) return;
        
        const el = document.createElement('div');
        el.className = 'cursor-pointer group';
        el.innerHTML = `
          <div class="relative flex flex-col items-center">
            <div class="bg-emerald-500 text-white px-2 py-1 rounded-lg text-[10px] font-black shadow-xl mb-1 transform group-hover:scale-110 transition-all font-mono">$${(order.commission/1000).toFixed(1)}k</div>
            <div class="h-4 w-4 bg-emerald-500 rounded-full border-2 border-white shadow-lg shadow-emerald-500/50"></div>
          </div>
        `;
        
        const marker = new maplibregl.Marker({ element: el })
            .setLngLat([order.pickup_lng, order.pickup_lat])
            .addTo(map);
        
        el.onclick = () => {
             map.easeTo({ center: [order.pickup_lng as number, order.pickup_lat as number], zoom: 16 });
        };
        
        markersRef.current.push(marker);
    });

    if (currentLocation && orders.length === 0) {
        map.easeTo({ center: [currentLocation.lng, currentLocation.lat], zoom: 15 });
    }
  }, [orders, currentLocation]);

  return (
    <div className="relative w-full h-full rounded-[40px] overflow-hidden border border-white/5 shadow-2xl bg-slate-900">
      <div ref={mapContainer} className="w-full h-full grayscale-[0.2] contrast-[1.1] brightness-[0.8]" />
      <div className="absolute top-6 left-6 pointer-events-none">
          <div className="bg-slate-900/80 backdrop-blur-3xl px-5 py-2.5 rounded-2xl border border-white/5 flex items-center gap-3">
              <Navigation className="h-4 w-4 text-emerald-400" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Rutas Cercanas</span>
          </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .maplibregl-ctrl { display: none !important; }
      `}} />
    </div>
  );
};

export default NearbyOrdersMap;
