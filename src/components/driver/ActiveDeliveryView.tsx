import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Navigation, 
  Phone, 
  Clock, 
  Package, 
  CheckCircle2, 
  ArrowRight,
  ExternalLink,
  Loader2,
  Navigation2
} from "lucide-react";

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
  const [followMode, setFollowMode] = useState(true);

  // Inicializar mapa
  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    mapInstance.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [delivery.pickup_lng || -73.1198, delivery.pickup_lat || 7.1193],
      zoom: 16,
      pitch: 45,
      bearing: 0
    });

    mapInstance.current.on('load', () => {
      setIsMapReady(true);
    });

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, [delivery]);

  // Actualizar marcador de conductor y seguimiento (Driving Mode)
  useEffect(() => {
    if (!isMapReady || !mapInstance.current || !currentLocation) return;
    
    const map = mapInstance.current;
    const { lat, lng, heading } = currentLocation;

    // Crear o mover marcador del conductor
    if (!driverMarkerRef.current) {
      const el = document.createElement('div');
      el.innerHTML = `<div class="relative">
        <div class="absolute -inset-4 bg-primary/20 rounded-full animate-ping"></div>
        <div class="bg-primary text-white p-2.5 rounded-full shadow-2xl border-4 border-white transition-transform duration-300" id="driver-nav-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${heading || 0}deg)"><path d="m12 2 7 19-7-4-7 4 7-19z"/></svg>
        </div>
      </div>`;
      driverMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(map);
    } else {
      driverMarkerRef.current.setLngLat([lng, lat]);
      const icon = driverMarkerRef.current.getElement().querySelector('#driver-nav-icon svg') as HTMLElement;
      if (icon && heading !== null) {
        icon.style.transform = `rotate(${heading}deg)`;
      }
    }

    // MODO CONDUCCIÓN: Seguir al conductor
    if (followMode) {
      map.easeTo({
        center: [lng, lat],
        bearing: heading || 0,
        pitch: 60,
        zoom: 17,
        duration: 1000
      });
    }
  }, [isMapReady, currentLocation, followMode]);

  // Marcadores de puntos de destino y ruta
  useEffect(() => {
    if (!isMapReady || !mapInstance.current) return;
    const map = mapInstance.current;

    // Marcador de Recogida
    if (delivery.pickup_lat && delivery.pickup_lng) {
      const el = document.createElement('div');
      el.innerHTML = `<div class="bg-accent text-white p-2 rounded-full shadow-lg border-2 border-white">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
      </div>`;
      new maplibregl.Marker({ element: el })
        .setLngLat([delivery.pickup_lng, delivery.pickup_lat])
        .addTo(map);
    }

    // Marcador de Entrega
    if (delivery.delivery_lat && delivery.delivery_lng) {
      const el = document.createElement('div');
      el.innerHTML = `<div class="bg-destructive text-white p-2 rounded-full shadow-lg border-2 border-white pulse-marker">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
      </div>`;
      new maplibregl.Marker({ element: el })
        .setLngLat([delivery.delivery_lng, delivery.delivery_lat])
        .addTo(map);
    }

    // Ruta
    if (delivery.pickup_lat && delivery.delivery_lat && delivery.pickup_lng && delivery.delivery_lng) {
      const routeId = 'delivery-route';
      if (map.getSource(routeId)) {
        map.removeLayer(routeId);
        map.removeSource(routeId);
      }
      map.addSource(routeId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [delivery.pickup_lng, delivery.pickup_lat],
              [delivery.delivery_lng, delivery.delivery_lat]
            ]
          }
        }
      });
      map.addLayer({
        id: routeId,
        type: 'line',
        source: routeId,
        paint: { 'line-color': '#3b82f6', 'line-width': 6, 'line-opacity': 0.8 }
      });
    }
  }, [isMapReady, delivery]);

  const openInGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* MAPA FULLSCREEN-ISH */}
      <div className="relative flex-1 bg-muted">
        {!isMapReady && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        )}
        <div ref={mapContainer} className="h-full w-full" />
        
        {/* CONTROLES FLOTANTES */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          <Button 
            variant={followMode ? "default" : "outline"}
            size="icon"
            className={`rounded-full shadow-xl h-12 w-12 ${followMode ? 'bg-primary animate-pulse' : 'bg-white text-black'}`}
            onClick={() => setFollowMode(!followMode)}
          >
            <Navigation2 className={`h-6 w-6 ${followMode ? 'fill-white' : ''}`} />
          </Button>
        </div>

        {/* INFO RÁPIDA DE NAVEGACIÓN */}
        <div className="absolute top-4 left-4 z-10">
          <div className="bg-black/80 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 shadow-2xl flex items-center gap-3">
             <div className="bg-primary/20 p-2 rounded-lg">
                <Navigation className="h-5 w-5 text-primary" />
             </div>
             <div>
                <p className="text-[10px] uppercase font-bold text-white/50 tracking-widest leading-none mb-1">Siguiendo ruta</p>
                <p className="text-sm font-bold text-white truncate max-w-[180px]">
                  {delivery.status === 'aceptado' ? 'Ir a recogida' : 'Ir a destino'}
                </p>
             </div>
          </div>
        </div>
      </div>

      {/* PANEL DE CONTROL INFERIOR */}
      <div className="bg-card w-full border-t border-border/20 p-6 rounded-t-[32px] -mt-8 relative z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">
        <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-6" />
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
             <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1 font-bold">
               #{delivery.order_id}
             </Badge>
             <div className="flex items-center text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded-md">
               <Clock className="h-3 w-3 mr-1" />
               {delivery.created_at ? new Date(delivery.created_at).toLocaleTimeString() : '--:--'}
             </div>
          </div>
          <Button variant="ghost" size="sm" className="text-primary font-bold" onClick={() => {
              const target = delivery.status === 'aceptado' ? [delivery.pickup_lat, delivery.pickup_lng] : [delivery.delivery_lat, delivery.delivery_lng];
              if (target[0]) openInGoogleMaps(target[0]!, target[1]!);
          }}>
            Abrir GPS Externo
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-8">
           <div className={`p-4 rounded-2xl border flex items-center gap-4 ${delivery.status === 'aceptado' ? 'bg-primary/5 border-primary/30' : 'bg-muted/10 border-transparent opacity-40'}`}>
              <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center text-white font-bold ring-4 ring-accent/20">A</div>
              <div className="flex-1 overflow-hidden">
                <p className="text-[10px] font-bold text-accent uppercase tracking-tighter">Recogida</p>
                <p className="text-sm font-bold truncate leading-tight">{delivery.pickup_address}</p>
              </div>
           </div>
           
           <div className={`p-4 rounded-2xl border flex items-center gap-4 ${delivery.status === 'en_camino' ? 'bg-primary/5 border-primary/30 shadow-lg' : 'bg-muted/10 border-transparent opacity-40'}`}>
              <div className="h-10 w-10 rounded-full bg-destructive flex items-center justify-center text-white font-bold ring-4 ring-destructive/20">B</div>
              <div className="flex-1 overflow-hidden">
                <p className="text-[10px] font-bold text-destructive uppercase tracking-tighter">Entrega</p>
                <p className="text-sm font-bold truncate leading-tight font-mono">{delivery.customer_name}</p>
                <p className="text-xs text-muted-foreground truncate">{delivery.delivery_address}</p>
              </div>
              {delivery.customer_phone && delivery.status === 'en_camino' && (
                <Button size="icon" variant="outline" className="rounded-full h-10 w-10" onClick={() => window.open(`tel:${delivery.customer_phone}`)}>
                  <Phone className="h-4 w-4" />
                </Button>
              )}
           </div>
        </div>

        <div className="space-y-3">
          {delivery.status === 'aceptado' && (
            <Button className="w-full h-16 rounded-2xl bg-gradient-primary text-white font-black text-xl shadow-2xl hover:scale-[1.02] transition-transform" onClick={onPickedUp}>
              <Package className="mr-3 h-6 w-6" /> YA RECOGÍ EL PEDIDO
            </Button>
          )}
          {delivery.status === 'en_camino' && (
            <Button className="w-full h-16 rounded-2xl bg-gradient-success text-white font-black text-xl shadow-2xl hover:scale-[1.02] transition-transform" onClick={onDelivered}>
              <CheckCircle2 className="mr-3 h-6 w-6" /> CONFIRMAR ENTREGA
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActiveDeliveryView;
