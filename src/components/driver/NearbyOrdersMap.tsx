import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapStyleSwitcher, useMapStyle, MapStyle } from '@/components/MapStyleSwitcher';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Target } from "lucide-react";
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
  currentLocation: { lat: number; lng: number; heading?: number | null } | null;
  onAcceptOrder: (id: string) => void;
}


const NearbyOrdersMap: React.FC<NearbyOrdersMapProps> = ({ orders, currentLocation, onAcceptOrder }) => {
  const { current: mapStyle, setStyle } = useMapStyle("dark");
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const driverMarkerRef = useRef<maplibregl.Marker | null>(null);

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
      try {
        mapInstance.current.addLayer({
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
    });

    return () => { mapInstance.current?.remove(); mapInstance.current = null; };
  }, []);

  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;

    // Clear order markers (not driver)
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Driver marker - clean GPS navigation arrow
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

    // Order pickup markers
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
        map.easeTo({ center: [order.pickup_lng!, order.pickup_lat!], zoom: 17, pitch: 60, duration: 1000 });
      };
      markersRef.current.push(marker);
    });
  }, [orders, currentLocation]);

  const handleStyleChange = useCallback((style: MapStyle) => {
    setStyle(style.id);
    mapInstance.current?.setStyle(style.url);
  }, [setStyle]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Style Switcher */}
      <MapStyleSwitcher 
        current={mapStyle} 
        onSelect={handleStyleChange} 
        position="top-right"
        dark={mapStyle.id === 'dark'}
      />

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
