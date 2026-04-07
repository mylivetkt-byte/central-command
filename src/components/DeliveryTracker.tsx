import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  Clock, 
  Package, 
  Navigation,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from '@tanstack/react-query';

interface DriverProfile {
  id: string;
  last_lat: number | null;
  last_lng: number | null;
  profiles: {
    full_name: string | null;
  } | null;
}

interface Delivery {
  id: string;
  order_id: string;
  status: string;
  customer_name: string;
  delivery_address: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  estimated_time: number | null;
  created_at: string;
  driver_profiles: DriverProfile | null;
}

interface DeliveryTrackerProps {
  deliveryId: string;
  height?: string;
}

const DeliveryTracker: React.FC<DeliveryTrackerProps> = ({ deliveryId, height = "400px" }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const markersRef = useRef<{ [key: string]: maplibregl.Marker }>({});

  const { data: delivery, isLoading } = useQuery<Delivery | null>({
    queryKey: ['delivery-tracker', deliveryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .eq('id', deliveryId)
        .single();
      if (error) throw error;
      // fetch driver location separately
      const d = data as any;
      if (d.driver_id) {
        const { data: loc } = await supabase.from('driver_locations').select('lat, lng').eq('driver_id', d.driver_id).maybeSingle();
        const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', d.driver_id).maybeSingle();
        d.driver_profiles = { id: d.driver_id, last_lat: loc?.lat || null, last_lng: loc?.lng || null, profiles: prof };
      }
      return d as Delivery;
    },
    refetchInterval: 5000
  });

  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    mapInstance.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [-73.1198, 7.1193],
      zoom: 14,
      pitch: 30
    });

    mapInstance.current.on('load', () => {
      setIsMapReady(true);
    });

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  // Actualizar marcadores y ruta
  useEffect(() => {
    if (!isMapReady || !mapInstance.current || !delivery) return;

    const map = mapInstance.current;

    // Marcador de Destino (Delivery)
    if (delivery.delivery_lat && delivery.delivery_lng) {
      if (!markersRef.current['dest']) {
        const el = document.createElement('div');
        el.innerHTML = `<div class="bg-destructive text-white p-2 rounded-full shadow-lg border-2 border-white scale-110">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
        </div>`;
        markersRef.current['dest'] = new maplibregl.Marker({ element: el })
          .setLngLat([delivery.delivery_lng, delivery.delivery_lat])
          .addTo(map);
      }
    }

    // Marcador del Driver
    const driver = delivery.driver_profiles;
    if (driver?.last_lat && driver?.last_lng) {
      const lngLat: [number, number] = [driver.last_lng, driver.last_lat];
      if (markersRef.current['driver']) {
        markersRef.current['driver'].setLngLat(lngLat);
      } else {
        const el = document.createElement('div');
        el.innerHTML = `<div class="relative">
          <div class="absolute -inset-3 bg-primary/30 rounded-full animate-ping"></div>
          <div class="bg-primary text-white p-2 rounded-full shadow-xl border-2 border-white scale-125">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
          </div>
        </div>`;
        markersRef.current['driver'] = new maplibregl.Marker({ element: el })
          .setLngLat(lngLat)
          .addTo(map);
      }

      // Ajustar bounds si es la primera vez
      if (!markersRef.current['bounds-set'] && delivery.delivery_lng) {
        const bounds = new maplibregl.LngLatBounds()
          .extend(lngLat)
          .extend([delivery.delivery_lng, delivery.delivery_lat]);
        map.fitBounds(bounds, { padding: 50 });
        markersRef.current['bounds-set'] = true as any;
      }
    }
  }, [isMapReady, delivery]);

  if (isLoading) return <div className="flex h-[400px] items-center justify-center bg-muted rounded-xl"><Loader2 className="animate-spin text-primary" /></div>;
  if (!delivery) return <div className="p-12 text-center text-muted-foreground">No se encontró información del pedido</div>;

  return (
    <Card className="overflow-hidden border-none shadow-2xl glass-card">
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-lg">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h4 className="font-bold text-sm tracking-tight">Rastreo de Pedido #{delivery.order_id}</h4>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{delivery.status.replace('_', ' ')}</p>
            </div>
          </div>
        </div>
        <Badge variant="outline" className="text-xs font-bold border-primary/20 text-primary">
          <Clock className="h-3 w-3 mr-1" /> {delivery.estimated_time || 20} min
        </Badge>
      </div>

      <div className="relative">
        {!isMapReady && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        <div ref={mapContainer} style={{ height, width: '100%' }} />
        
        {/* Overlays informativos */}
        <div className="absolute top-4 left-4 z-10 space-y-2 pointer-events-none">
          <div className="bg-black/80 backdrop-blur-md px-3 py-2 rounded-lg border border-white/10 shadow-lg">
            <div className="flex items-center gap-2">
              <Navigation className="h-4 w-4 text-primary" />
              <div className="flex flex-col">
                <span className="text-[9px] text-white/50 uppercase font-bold tracking-tighter">Destino</span>
                <span className="text-xs text-white font-medium truncate max-w-[150px]">{delivery.delivery_address}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default DeliveryTracker;
