import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Navigation, 
  Phone, 
  Clock, 
  Package, 
  CheckCircle2, 
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
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [followMode, setFollowMode] = useState(true);
  const [lastHeading, setLastHeading] = useState(0);

  // Inicializar mapa
  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    // Centro inicial: conductor si existe, sino recogida
    const initialCenter: [number, number] = currentLocation 
        ? [currentLocation.lng, currentLocation.lat]
        : [delivery.pickup_lng || -73.1198, delivery.pickup_lat || 7.1193];

    mapInstance.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: initialCenter,
      zoom: 16,
      pitch: 60, // Modo conducción por defecto
      bearing: 0
    });

    mapInstance.current.on('load', () => {
      setIsMapReady(true);
    });

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  // Función para obtener ruta real (OSRM)
  const updateRoute = async () => {
    if (!isMapReady || !mapInstance.current) return;
    const map = mapInstance.current;

    // Puntos para la ruta: Conductor -> Recogida o Recogida -> Entrega
    let start: [number, number] | null = null;
    let end: [number, number] | null = null;

    if (currentLocation) {
        start = [currentLocation.lng, currentLocation.lat];
        end = delivery.status === 'aceptado' 
            ? [delivery.pickup_lng!, delivery.pickup_lat!]
            : [delivery.delivery_lng!, delivery.delivery_lat!];
    } else if (delivery.pickup_lat && delivery.delivery_lat) {
        start = [delivery.pickup_lng!, delivery.pickup_lat!];
        end = [delivery.delivery_lng!, delivery.delivery_lat!];
    }

    if (!start || !end || !start[0] || !end[0]) return;

    try {
        const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson`
        );
        const data = await response.json();

        if (data.routes && data.routes[0]) {
            const coordinates = data.routes[0].geometry.coordinates;
            const routeId = 'delivery-route';
            
            if (map.getSource(routeId)) {
                (map.getSource(routeId) as maplibregl.GeoJSONSource).setData({
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'LineString', coordinates }
                });
            } else {
                map.addSource(routeId, {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        properties: {},
                        geometry: { type: 'LineString', coordinates }
                    }
                });
                map.addLayer({
                    id: routeId,
                    type: 'line',
                    source: routeId,
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: { 'line-color': '#3b82f6', 'line-width': 8, 'line-opacity': 0.8 }
                });
            }
        }
    } catch (err) {
        console.error("Error fetching route:", err);
    }
  };

  // Actualizar ruta periódicamente o al cambiar estado/ubicación
  useEffect(() => {
    updateRoute();
    const interval = setInterval(updateRoute, 10000); // Cada 10s
    return () => clearInterval(interval);
  }, [isMapReady, delivery.status, currentLocation?.lat]);

  // Marcadores de puntos fijos
  useEffect(() => {
    if (!isMapReady || !mapInstance.current) return;
    const map = mapInstance.current;

    // Limpiar marcadores antiguos (excepto el del conductor)
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Recogida
    if (delivery.pickup_lat && delivery.pickup_lng) {
      const el = document.createElement('div');
      el.className = 'marker-pickup';
      el.innerHTML = `<div class="bg-green-500 text-white p-2 rounded-full shadow-lg border-2 border-white"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>`;
      const m = new maplibregl.Marker({ element: el }).setLngLat([delivery.pickup_lng, delivery.pickup_lat]).addTo(map);
      markersRef.current.push(m);
    }

    // Entrega
    if (delivery.delivery_lat && delivery.delivery_lng) {
      const el = document.createElement('div');
      el.className = 'marker-delivery';
      el.innerHTML = `<div class="bg-blue-600 text-white p-2 rounded-full shadow-lg border-2 border-white pulse-marker"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg></div>`;
      const m = new maplibregl.Marker({ element: el }).setLngLat([delivery.delivery_lng, delivery.delivery_lat]).addTo(map);
      markersRef.current.push(m);
    }
  }, [isMapReady, delivery.id]);

  // MODO CONDUCCIÓN: Actualizar posición conductor y rotación
  useEffect(() => {
    if (!isMapReady || !mapInstance.current || !currentLocation) return;
    const map = mapInstance.current;
    const { lat, lng, heading } = currentLocation;

    // Actualizar marcador conductor
    if (!driverMarkerRef.current) {
      const el = document.createElement('div');
      el.innerHTML = `<div class="driver-nav-marker">
        <div class="nav-arrow"></div>
      </div>`;
      driverMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
    } else {
      driverMarkerRef.current.setLngLat([lng, lat]);
    }

    // Rotar flecha
    if (heading !== null) {
        setLastHeading(heading);
        const arrow = driverMarkerRef.current.getElement().querySelector('.nav-arrow') as HTMLElement;
        if (arrow) arrow.style.transform = `rotate(${heading}deg)`;
    }

    // Centrar si followMode está activo
    if (followMode) {
      map.easeTo({
        center: [lng, lat],
        bearing: heading ?? lastHeading,
        pitch: 60,
        zoom: 17,
        duration: 1000
      });
    }
  }, [currentLocation, followMode, isMapReady]);

  const openInGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="relative flex-1 bg-muted">
        {!isMapReady && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        )}
        <div ref={mapContainer} className="h-full w-full" />
        
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-3">
          <Button 
            variant={followMode ? "default" : "secondary"}
            size="icon"
            className={`rounded-full shadow-2xl h-14 w-14 ${followMode ? 'bg-primary border-4 border-white' : 'bg-white text-black'}`}
            onClick={() => setFollowMode(!followMode)}
          >
            <Navigation2 className={`h-7 w-7 ${followMode ? 'fill-white' : ''}`} />
          </Button>
        </div>

        <div className="absolute top-4 left-4 z-10 pointer-events-none">
          <div className="bg-black/90 backdrop-blur-xl px-5 py-4 rounded-3xl border border-white/20 shadow-2xl flex items-center gap-4 max-w-[280px]">
             <div className="bg-primary p-2.5 rounded-2xl shadow-lg shadow-primary/20">
                <Navigation className="h-6 w-6 text-white" />
             </div>
             <div className="overflow-hidden">
                <p className="text-[10px] uppercase font-black text-primary tracking-[0.2em] mb-1">En Navegación</p>
                <p className="text-sm font-black text-white truncate leading-none">
                  {delivery.status === 'aceptado' ? 'Hacia Recogida' : 'Hacia Destino'}
                </p>
                <p className="text-[10px] text-white/50 truncate mt-1">
                  {delivery.status === 'aceptado' ? delivery.pickup_address : delivery.delivery_address}
                </p>
             </div>
          </div>
        </div>
      </div>

      <div className="bg-card w-full border-t border-border/10 p-6 rounded-t-[40px] -mt-10 relative z-20 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
        <div className="w-16 h-1.5 bg-muted/40 rounded-full mx-auto mb-8" />
        
        <div className="flex items-center justify-between mb-8">
          <Badge className="bg-primary/20 text-primary border-none px-4 py-1.5 text-xs font-black tracking-widest">
            ORDEN #{delivery.order_id}
          </Badge>
          <Button variant="outline" size="sm" className="rounded-xl border-primary/30 text-primary font-black py-5 px-6" onClick={() => {
              const target = delivery.status === 'aceptado' ? [delivery.pickup_lat, delivery.pickup_lng] : [delivery.delivery_lat, delivery.delivery_lng];
              if (target[0]) openInGoogleMaps(target[0]!, target[1]!);
          }}>
            GPS EXTERNO
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-8">
           <div className={`p-5 rounded-3xl border transition-all ${delivery.status === 'aceptado' ? 'bg-primary/5 border-primary/40 ring-4 ring-primary/5 shadow-xl' : 'bg-muted/10 border-transparent opacity-30 grayscale'}`}>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-green-500 flex items-center justify-center text-white font-black shadow-lg shadow-green-500/20">A</div>
                <div className="flex-1 overflow-hidden">
                    <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Recogida</p>
                    <p className="text-sm font-bold truncate text-foreground/90">{delivery.pickup_address}</p>
                </div>
              </div>
           </div>
           
           <div className={`p-5 rounded-3xl border transition-all ${delivery.status === 'en_camino' ? 'bg-primary/5 border-primary/40 ring-4 ring-primary/5 shadow-xl' : 'bg-muted/10 border-transparent opacity-30 grayscale'}`}>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black shadow-lg shadow-blue-600/20">B</div>
                <div className="flex-1 overflow-hidden">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Destino Cliente</p>
                    <p className="text-sm font-bold truncate text-foreground/90">{delivery.customer_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{delivery.delivery_address}</p>
                </div>
                {delivery.customer_phone && delivery.status === 'en_camino' && (
                    <Button size="icon" variant="outline" className="rounded-2xl h-14 w-14 bg-blue-50 border-blue-200" onClick={() => window.open(`tel:${delivery.customer_phone}`)}>
                    <Phone className="h-6 w-6 text-blue-600" />
                    </Button>
                )}
              </div>
           </div>
        </div>

        <div className="space-y-4 pt-2">
          {delivery.status === 'aceptado' && (
            <Button className="w-full h-18 rounded-[24px] bg-primary text-white font-black text-xl shadow-[0_10px_30px_rgba(59,130,246,0.3)] border-b-4 border-primary-foreground/20 active:border-b-0 active:translate-y-1 transition-all" onClick={onPickedUp}>
              RECOGÍ EL PEDIDO
            </Button>
          )}
          {delivery.status === 'en_camino' && (
            <Button className="w-full h-18 rounded-[24px] bg-green-600 text-white font-black text-xl shadow-[0_10px_30px_rgba(34,197,94,0.3)] border-b-4 border-green-700/20 active:border-b-0 active:translate-y-1 transition-all" onClick={onDelivered}>
              CONFIRMAR ENTREGA
            </Button>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .driver-nav-marker {
            width: 50px;
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .nav-arrow {
            width: 0;
            height: 0;
            border-left: 15px solid transparent;
            border-right: 15px solid transparent;
            border-bottom: 35px solid #3b82f6;
            filter: drop-shadow(0 0 8px rgba(59,130,246,0.8));
            transition: transform 0.5s ease-out;
        }
        .nav-arrow::after {
            content: '';
            position: absolute;
            bottom: -35px;
            left: -15px;
            width: 0;
            height: 0;
            border-left: 15px solid transparent;
            border-right: 15px solid transparent;
            border-bottom: 12px solid #1d4ed8;
        }
        .pulse-marker {
            animation: pulse-ring 1.5s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite;
        }
        @keyframes pulse-ring {
            0% { transform: scale(0.8); box-shadow: 0 0 0 0 rgba(59,130,246, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 15px rgba(59,130,246, 0); }
            100% { transform: scale(0.8); box-shadow: 0 0 0 0 rgba(59,130,246, 0); }
        }
      `}} />
    </div>
  );
};

export default ActiveDeliveryView;
