import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Button } from "@/components/ui/button";
import { 
  Navigation, 
  Phone, 
  Clock, 
  Package, 
  CheckCircle2, 
  Loader2,
  Navigation2,
  Maximize2,
  Target,
  ArrowUpRight
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
  const destinationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [followMode, setFollowMode] = useState(true);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string; nextStreet: string; nextManeuver: string } | null>(null);

  // Inicializar mapa
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

    mapInstance.current.on('load', () => {
      setIsMapReady(true);
    });

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  // Fetch Ruta y Maniobras (OSRM)
  const fetchRoute = async () => {
    if (!isMapReady || !mapInstance.current || !currentLocation) return;
    const map = mapInstance.current;

    const target = delivery.status === 'aceptado' 
        ? [delivery.pickup_lng, delivery.pickup_lat]
        : [delivery.delivery_lng, delivery.delivery_lat];

    if (!target[0] || !target[1]) return;

    try {
        const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${currentLocation.lng},${currentLocation.lat};${target[0]},${target[1]}?overview=full&geometries=geojson&steps=true`
        );
        const data = await response.json();

        if (data.routes && data.routes[0]) {
            const route = data.routes[0];
            const coordinates = route.geometry.coordinates;
            
            // Actualizar Línea de Ruta (Color Púrpura como en la imagen)
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
                    data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } }
                });
                // Borde de la ruta (Casing)
                map.addLayer({
                    id: 'route-line-casing',
                    type: 'line',
                    source: routeSource,
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: { 
                        'line-color': '#ffffff',
                        'line-width': 14,
                        'line-opacity': 1
                    }
                });
                // Línea principal
                map.addLayer({
                    id: 'route-line',
                    type: 'line',
                    source: routeSource,
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: { 
                        'line-color': '#6e39f5',
                        'line-width': 10,
                        'line-opacity': 1
                    }
                });
            }

            // Datos de maniobra
            const nextStep = route.legs[0].steps[1] || route.legs[0].steps[0];
            setRouteInfo({
                distance: (route.distance / 1000).toFixed(1) + " km",
                duration: Math.ceil(route.duration / 60) + " min",
                nextStreet: nextStep.name || "Siga recto",
                nextManeuver: (nextStep.distance < 1000) ? Math.round(nextStep.distance) + " m" : (nextStep.distance/1000).toFixed(1) + " km"
            });
        }
    } catch (err) {
        console.error("OSRM Error:", err);
    }
  };

  useEffect(() => {
    fetchRoute();
    const int = setInterval(fetchRoute, 5000);
    return () => clearInterval(int);
  }, [isMapReady, currentLocation?.lat, delivery.status]);

  // Actualizar Marcadores
  useEffect(() => {
    if (!isMapReady || !mapInstance.current || !currentLocation) return;
    const map = mapInstance.current;

    // Conductor (Moto Roja)
    if (!driverMarkerRef.current) {
        const el = document.createElement('div');
        el.innerHTML = `<div class="navigation-moto-marker">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="#ef4444" stroke="white" stroke-width="1.5">
                <circle cx="12" cy="12" r="10" fill="rgba(239, 68, 68, 0.2)" />
                <path d="M12 2L19 21L12 17L5 21L12 2Z" />
            </svg>
        </div>`;
        driverMarkerRef.current = new maplibregl.Marker({ element: el, rotationAlignment: 'map' })
            .setLngLat([currentLocation.lng, currentLocation.lat])
            .addTo(map);
    } else {
        driverMarkerRef.current.setLngLat([currentLocation.lng, currentLocation.lat]);
        if (currentLocation.heading !== null) {
            driverMarkerRef.current.setRotation(currentLocation.heading);
        }
    }

    // Destino (Bandera de Meta como en la imagen)
    const targetLngLat: [number, number] = delivery.status === 'aceptado' 
        ? [delivery.pickup_lng!, delivery.pickup_lat!] 
        : [delivery.delivery_lng!, delivery.delivery_lat!];

    if (!destinationMarkerRef.current && targetLngLat[0]) {
        const el = document.createElement('div');
        el.innerHTML = `<div class="bg-white p-1 rounded-full shadow-2xl border-2 border-black">
            <div class="w-8 h-8 flex items-center justify-center">🏁</div>
        </div>`;
        destinationMarkerRef.current = new maplibregl.Marker({ element: el })
            .setLngLat(targetLngLat)
            .addTo(map);
    } else if (targetLngLat[0]) {
        destinationMarkerRef.current?.setLngLat(targetLngLat);
    }

    if (followMode) {
      map.easeTo({
        center: [currentLocation.lng, currentLocation.lat],
        bearing: currentLocation.heading || 0,
        pitch: 65,
        zoom: 18,
        duration: 1000
      });
    }
  }, [currentLocation, followMode, isMapReady, delivery.status]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background relative">
      
      {/* PANEL SUPERIOR NAVEGACIÓN (Como en la imagen) */}
      <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none p-2 pt-4">
         <div className="bg-black/90 backdrop-blur-xl rounded-[28px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex items-center p-5 gap-6 max-w-[450px] mx-auto border border-white/10">
            <div className="flex-shrink-0">
                <ArrowUpRight className="h-14 w-14 text-white stroke-[3px]" />
            </div>
            <div className="flex flex-col">
                <span className="text-4xl font-black text-white leading-none mb-1">
                    {routeInfo?.nextManeuver || "--- m"}
                </span>
                <span className="text-2xl font-black text-[#5ec6ff] tracking-tight truncate max-w-[200px]">
                    {routeInfo?.nextStreet || "Seguir ruta"}
                </span>
            </div>
         </div>
      </div>

      {/* MAPA */}
      <div className="flex-1 relative">
        {!isMapReady && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-background">
             <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        )}
        <div ref={mapContainer} className="h-full w-full" />
        
        {/* BOTONES FLOTANTES MAPA */}
        <div className="absolute bottom-40 right-4 z-40 flex flex-col gap-4">
             <Button 
                variant="secondary" 
                size="icon" 
                className="h-14 w-14 rounded-full bg-white/90 backdrop-blur shadow-2xl border-none outline-none"
                onClick={() => setFollowMode(true)}
             >
                <Target className={`h-7 w-7 ${followMode ? 'text-primary' : 'text-slate-400'}`} />
             </Button>
        </div>
      </div>

      {/* PANEL INFERIOR ESTADÍSTICAS (Como en la imagen) */}
      <div className="bg-white rounded-t-[40px] shadow-[0_-15px_60px_rgba(0,0,0,0.3)] p-6 relative z-50">
          <div className="w-16 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 opacity-30" />
          
          <div className="flex items-center justify-between mb-8 px-2">
             <div className="flex items-center gap-4">
                <div className="h-14 w-14 bg-black rounded-full flex items-center justify-center shadow-2xl">
                    <Navigation2 className="h-7 w-7 text-white" />
                </div>
                <div className="flex flex-col">
                    <span className="text-lg font-black text-slate-800 leading-none">Volver a centrar</span>
                    <span className="text-lg font-bold text-slate-400 mt-1">
                        {routeInfo?.duration || "14 min"} • {routeInfo?.distance || "6 km"}
                    </span>
                </div>
             </div>
             <Button className="bg-[#f0f4f8] text-[#2c699a] hover:bg-slate-200 h-14 px-8 rounded-3xl font-black text-lg shadow-none border-none">
                Vista general
             </Button>
          </div>

          <div className="grid grid-cols-1 gap-4">
             {delivery.status === 'aceptado' ? (
                <Button 
                    className="w-full h-18 rounded-3xl bg-[#6e39f5] hover:bg-[#5a2ed1] text-white font-black text-xl shadow-xl shadow-indigo-200" 
                    onClick={onPickedUp}
                >
                    YA RECOGÍ EL PEDIDO
                </Button>
             ) : (
                <Button 
                    className="w-full h-18 rounded-3xl bg-green-500 hover:bg-green-600 text-white font-black text-xl shadow-xl shadow-green-100" 
                    onClick={onDelivered}
                >
                    CONFIRMAR ENTREGA
                </Button>
             )}
             
             <div className="flex gap-4">
                <Button variant="outline" className="flex-1 h-16 rounded-3xl border-slate-100 text-slate-500 font-bold" onClick={() => window.open(`tel:${delivery.customer_phone}`)}>
                    <Phone className="mr-2 h-5 w-5" /> Llamar Cliente
                </Button>
                <Button variant="outline" className="flex-1 h-16 rounded-3xl border-slate-100 text-slate-500 font-bold" onClick={() => {
                     const t = delivery.status === 'aceptado' ? [delivery.pickup_lat, delivery.pickup_lng] : [delivery.delivery_lat, delivery.delivery_lng];
                     window.open(`https://www.google.com/maps/dir/?api=1&destination=${t[0]},${t[1]}`, '_blank');
                }}>
                    Google Maps
                </Button>
             </div>
          </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .navigation-moto-marker {
            transition: all 0.5s cubic-bezier(0.19, 1, 0.22, 1);
            filter: drop-shadow(0 0 10px rgba(0,0,0,0.5));
        }
        .navigation-moto-marker svg {
            transform: rotate(-45deg); /* Ajuste según el icono */
        }
      `}} />
    </div>
  );
};

export default ActiveDeliveryView;
