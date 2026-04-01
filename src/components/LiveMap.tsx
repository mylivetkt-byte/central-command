import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, Clock, User } from 'lucide-react';

// Tipos
interface DriverLocation {
  id: string;
  driver_id: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  updated_at: string;
  driver?: any;
}

interface Delivery {
  id: string;
  order_id: string;
  driver_id: string | null;
  customer_name: string;
  pickup_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  delivery_address: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  status: string;
}

interface LiveMapProps {
  center?: [number, number];
  zoom?: number;
  height?: string;
  showDrivers?: boolean;
  showDeliveries?: boolean;
  focusedDeliveryId?: string | null;
}

export default function LiveMap({
  center = [7.119, -73.122], // Bucaramanga por defecto
  zoom = 13,
  height = '600px',
  showDrivers = true,
  showDeliveries = true,
  focusedDeliveryId = null
}: LiveMapProps) {
  const mapRef = useRef<any>(null);
  const [map, setMap] = useState<any>(null);
  const [driverLocations, setDriverLocations] = useState<DriverLocation[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<DriverLocation | null>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const routesRef = useRef<Map<string, any>>(new Map());

  // Cargar script de Leaflet
  useEffect(() => {
    // Agregar CSS de Leaflet
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    // Cargar script de Leaflet
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => initMap();
    document.body.appendChild(script);

    return () => {
      document.head.removeChild(link);
      document.body.removeChild(script);
    };
  }, []);

  // Inicializar mapa
  const initMap = () => {
    if (!mapRef.current || map) return;

    // @ts-ignore
    const L = window.L;
    if (!L) return;

    const newMap = L.map(mapRef.current).setView(center, zoom);

    // Agregar capa de mapa (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(newMap);

    setMap(newMap);
  };

  // Cargar ubicaciones de drivers
  useEffect(() => {
    if (!showDrivers) return;

    const fetchDriverLocations = async () => {
      const { data, error } = await supabase
        .from('driver_locations')
        .select('*');

      if (!error && data) {
        setDriverLocations(data as any[]);
      }
    };

    fetchDriverLocations();

    // Suscribirse a cambios en tiempo real
    const channel = supabase
      .channel('driver-locations-map')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_locations'
        },
        () => {
          fetchDriverLocations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [showDrivers]);

  // Cargar entregas activas
  useEffect(() => {
    if (!showDeliveries) return;

    const fetchDeliveries = async () => {
      const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .in('status', ['pendiente', 'aceptado', 'en_camino']);

      if (!error && data) {
        setDeliveries(data);
      }
    };

    fetchDeliveries();

    // Suscribirse a cambios
    const channel = supabase
      .channel('deliveries-map')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deliveries'
        },
        () => {
          fetchDeliveries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [showDeliveries]);

  // Renderizar marcadores de drivers
  useEffect(() => {
    if (!map || !showDrivers) return;
    // @ts-ignore
    const L = window.L;
    if (!L) return;

    // Limpiar marcadores existentes
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();

    // Crear ícono personalizado para drivers
    const createDriverIcon = (status: string) => {
      const color = status === 'activo' ? '#22c55e' : 
                    status === 'en_ruta' ? '#f59e0b' : '#6b7280';
      
      return L.divIcon({
        className: 'custom-driver-marker',
        html: `
          <div style="
            background-color: ${color};
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
              <circle cx="7" cy="17" r="2"/>
              <circle cx="17" cy="17" r="2"/>
            </svg>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
    };

    driverLocations.forEach(location => {
      const status = location.driver?.driver_profiles?.status || 'inactivo';
      const marker = L.marker([location.lat, location.lng], {
        icon: createDriverIcon(status)
      }).addTo(map);

      // Popup con información del driver
      const popupContent = `
        <div style="min-width: 200px;">
          <h3 style="font-weight: bold; margin-bottom: 8px;">
            ${location.driver?.full_name || 'Driver'}
          </h3>
          <p style="margin: 4px 0;">
            <strong>Estado:</strong> ${status}
          </p>
          <p style="margin: 4px 0;">
            <strong>Entregas:</strong> ${location.driver?.driver_profiles?.current_load || 0}
          </p>
          ${location.speed ? `
            <p style="margin: 4px 0;">
              <strong>Velocidad:</strong> ${Math.round(location.speed * 3.6)} km/h
            </p>
          ` : ''}
          <p style="margin: 4px 0; font-size: 12px; color: #666;">
            Actualizado: ${new Date(location.updated_at).toLocaleTimeString()}
          </p>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.on('click', () => setSelectedDriver(location));

      markersRef.current.set(`driver-${location.driver_id}`, marker);
    });
  }, [map, driverLocations, showDrivers]);

  // Renderizar marcadores de entregas
  useEffect(() => {
    if (!map || !showDeliveries) return;
    // @ts-ignore
    const L = window.L;
    if (!L) return;

    // Crear iconos para pickup y delivery
    const pickupIcon = L.divIcon({
      className: 'custom-pickup-marker',
      html: `
        <div style="
          background-color: #10b981;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const deliveryIcon = L.divIcon({
      className: 'custom-delivery-marker',
      html: `
        <div style="
          background-color: #ef4444;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    deliveries.forEach(delivery => {
      // Marcador de pickup
      if (delivery.pickup_lat && delivery.pickup_lng) {
        const pickupMarker = L.marker(
          [delivery.pickup_lat, delivery.pickup_lng],
          { icon: pickupIcon }
        ).addTo(map);

        pickupMarker.bindPopup(`
          <div>
            <h4 style="font-weight: bold;">Recogida</h4>
            <p style="margin: 4px 0;"><strong>Pedido:</strong> ${delivery.order_id}</p>
            <p style="margin: 4px 0;">${delivery.pickup_address}</p>
          </div>
        `);

        markersRef.current.set(`pickup-${delivery.id}`, pickupMarker);
      }

      // Marcador de delivery
      if (delivery.delivery_lat && delivery.delivery_lng) {
        const deliveryMarker = L.marker(
          [delivery.delivery_lat, delivery.delivery_lng],
          { icon: deliveryIcon }
        ).addTo(map);

        deliveryMarker.bindPopup(`
          <div>
            <h4 style="font-weight: bold;">Entrega</h4>
            <p style="margin: 4px 0;"><strong>Cliente:</strong> ${delivery.customer_name}</p>
            <p style="margin: 4px 0;">${delivery.delivery_address}</p>
            <p style="margin: 4px 0;"><strong>Estado:</strong> ${delivery.status}</p>
          </div>
        `);

        markersRef.current.set(`delivery-${delivery.id}`, deliveryMarker);
      }

      // Dibujar ruta si hay ambas coordenadas
      if (
        delivery.pickup_lat && delivery.pickup_lng &&
        delivery.delivery_lat && delivery.delivery_lng
      ) {
        const route = L.polyline(
          [
            [delivery.pickup_lat, delivery.pickup_lng],
            [delivery.delivery_lat, delivery.delivery_lng]
          ],
          {
            color: delivery.status === 'en_camino' ? '#f59e0b' : '#6b7280',
            weight: 3,
            opacity: 0.6,
            dashArray: '5, 10'
          }
        ).addTo(map);

        routesRef.current.set(`route-${delivery.id}`, route);
      }
    });
  }, [map, deliveries, showDeliveries]);

  // Enfocar en entrega específica
  useEffect(() => {
    if (!map || !focusedDeliveryId) return;

    const delivery = deliveries.find(d => d.id === focusedDeliveryId);
    if (delivery && delivery.delivery_lat && delivery.delivery_lng) {
      map.setView([delivery.delivery_lat, delivery.delivery_lng], 15);
    }
  }, [map, focusedDeliveryId, deliveries]);

  return (
    <div className="space-y-4">
      {/* Mapa */}
      <div 
        ref={mapRef} 
        style={{ height, width: '100%' }}
        className="rounded-lg overflow-hidden border border-border"
      />

      {/* Panel de información del driver seleccionado */}
      {selectedDriver && (
        <Card className="p-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">
                  {selectedDriver.driver?.full_name || 'Driver'}
                </h3>
                <Badge variant={
                  selectedDriver.driver?.driver_profiles?.status === 'activo' ? 'default' :
                  selectedDriver.driver?.driver_profiles?.status === 'en_ruta' ? 'secondary' :
                  'outline'
                }>
                  {selectedDriver.driver?.driver_profiles?.status || 'inactivo'}
                </Badge>
              </div>
            </div>
            <button
              onClick={() => setSelectedDriver(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Posición</p>
                <p className="text-sm font-medium">
                  {selectedDriver.lat.toFixed(4)}, {selectedDriver.lng.toFixed(4)}
                </p>
              </div>
            </div>

            {selectedDriver.speed !== null && (
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Velocidad</p>
                  <p className="text-sm font-medium">
                    {Math.round(selectedDriver.speed * 3.6)} km/h
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Actualizado</p>
                <p className="text-sm font-medium">
                  {new Date(selectedDriver.updated_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Leyenda */}
      <Card className="p-4">
        <h4 className="font-semibold mb-3">Leyenda</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500" />
            <span>Driver Activo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-amber-500" />
            <span>Driver en Ruta</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500" />
            <span>Punto de Recogida</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500" />
            <span>Punto de Entrega</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
