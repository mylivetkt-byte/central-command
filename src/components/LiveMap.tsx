import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

interface LiveMapProps {
  height?: string;
  showDrivers?: boolean;
  showDeliveries?: boolean;
  focusedDeliveryId?: string | null;
}

interface Driver {
  id: string;
  status: string;
  last_lat: number | null;
  last_lng: number | null;
  current_load: number;
  profiles: {
    full_name: string | null;
  } | null;
}

interface Delivery {
  id: string;
  order_id: string;
  status: string;
  pickup_address: string;
  delivery_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
}

const BUCARAMANGA_CENTER: [number, number] = [-73.1198, 7.1193];

const LiveMap: React.FC<LiveMapProps> = ({
  height = "500px",
  showDrivers = true,
  showDeliveries = true,
  focusedDeliveryId = null
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: maplibregl.Marker }>({});
  const [isMapReady, setIsMapReady] = useState(false);

  // Consulta de drivers
  const { data: drivers = [] } = useQuery({
    queryKey: ['live-drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_profiles')
        .select('id, status, last_lat, last_lng, current_load, profiles(full_name)');
      if (error) throw error;
      return data as Driver[];
    },
    refetchInterval: 5000,
    enabled: showDrivers
  });

  // Consulta de entregas activas
  const { data: deliveries = [] } = useQuery({
    queryKey: ['live-deliveries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .in('status', ['pendiente', 'aceptado', 'en_camino']);
      if (error) throw error;
      return data as Delivery[];
    },
    refetchInterval: 5000,
    enabled: showDeliveries
  });

  // Inicializar mapa
  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    mapInstance.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      center: BUCARAMANGA_CENTER,
      zoom: 13,
      pitch: 45 // 3D effect
    });

    mapInstance.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    mapInstance.current.on('load', () => {
      setIsMapReady(true);
    });

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  // Actualizar marcadores de Drivers
  useEffect(() => {
    if (!isMapReady || !mapInstance.current || !showDrivers) return;

    const currentDriverIds = new Set(drivers.map(d => `driver-${d.id}`));
    
    // Eliminar marcadores viejos
    Object.keys(markersRef.current).forEach(id => {
      if (id.startsWith('driver-') && !currentDriverIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Agregar/Actualizar marcadores
    drivers.forEach(driver => {
      if (!driver.last_lat || !driver.last_lng) return;
      const id = `driver-${driver.id}`;
      const lngLat: [number, number] = [driver.last_lng, driver.last_lat];

      if (markersRef.current[id]) {
        markersRef.current[id].setLngLat(lngLat);
      } else {
        const el = document.createElement('div');
        el.className = 'driver-marker-container';
        el.innerHTML = `
          <div class="relative">
            <div class="absolute -inset-2 bg-primary/30 rounded-full animate-ping"></div>
            <div class="relative bg-primary text-white p-2 rounded-full shadow-lg border-2 border-white scale-110">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
            </div>
          </div>
        `;
        
        const popup = new maplibregl.Popup({ offset: 25 })
          .setHTML(`<b class="text-black">${driver.profiles?.full_name || 'Driver'}</b><br/>Carga: ${driver.current_load} pedidos`);

        markersRef.current[id] = new maplibregl.Marker({ element: el })
          .setLngLat(lngLat)
          .setPopup(popup)
          .addTo(mapInstance.current!);
      }
    });
  }, [drivers, isMapReady, showDrivers]);

  // Actualizar marcadores de Entregas (Pickup y Delivery)
  useEffect(() => {
    if (!isMapReady || !mapInstance.current || !showDeliveries) return;

    const currentDeliveryIds = new Set();
    deliveries.forEach(d => {
      currentDeliveryIds.add(`pickup-${d.id}`);
      currentDeliveryIds.add(`delivery-${d.id}`);
    });

    // Eliminar marcadores viejos
    Object.keys(markersRef.current).forEach(id => {
      if ((id.startsWith('pickup-') || id.startsWith('delivery-')) && !currentDeliveryIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Agregar/Actualizar marcadores
    deliveries.forEach(d => {
      // Pickup Marker
      if (d.pickup_lat && d.pickup_lng) {
        const pId = `pickup-${d.id}`;
        if (!markersRef.current[pId]) {
          const el = document.createElement('div');
          el.innerHTML = `<div class="bg-accent text-white p-1.5 rounded-md shadow-md border border-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          </div>`;
          markersRef.current[pId] = new maplibregl.Marker({ element: el })
            .setLngLat([d.pickup_lng, d.pickup_lat])
            .setPopup(new maplibregl.Popup().setHTML(`<b>Recogida #${d.order_id}</b><br/>${d.pickup_address}`))
            .addTo(mapInstance.current!);
        }
      }

      // Delivery Marker
      if (d.delivery_lat && d.delivery_lng) {
        const dId = `delivery-${d.id}`;
        if (!markersRef.current[dId]) {
          const el = document.createElement('div');
          el.innerHTML = `<div class="bg-destructive text-white p-1.5 rounded-md shadow-md border border-white pulse-marker">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
          </div>`;
          markersRef.current[dId] = new maplibregl.Marker({ element: el })
            .setLngLat([d.delivery_lng, d.delivery_lat])
            .setPopup(new maplibregl.Popup().setHTML(`<b>Entrega #${d.order_id}</b><br/>${d.delivery_address}`))
            .addTo(mapInstance.current!);
        }
      }
    });
  }, [deliveries, isMapReady, showDeliveries]);

  // Manejar enfoque
  useEffect(() => {
    if (!isMapReady || !mapInstance.current || !focusedDeliveryId) return;
    const delivery = deliveries.find(d => d.id === focusedDeliveryId);
    if (delivery && delivery.delivery_lat && delivery.delivery_lng) {
      mapInstance.current.flyTo({
        center: [delivery.delivery_lng, delivery.delivery_lat],
        zoom: 15,
        speed: 1.2
      });
    }
  }, [focusedDeliveryId, isMapReady, deliveries]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-border bg-card shadow-2xl">
      {!isMapReady && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">Iniciando Mapa Premium...</p>
          </div>
        </div>
      )}
      <div ref={mapContainer} style={{ height, width: '100%' }} />
      
      <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
        <div className="bg-black/80 backdrop-blur-md p-3 rounded-lg border border-white/10 shadow-xl">
          <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2">Estado del Sistema</p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary))]"></span>
              <span className="text-xs text-white/90 font-medium">${drivers.length} Drivers</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_hsl(var(--accent))]"></span>
              <span className="text-xs text-white/90 font-medium">${deliveries.length} Entregas</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveMap;
