import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MapPin, 
  Navigation, 
  Clock, 
  User, 
  Phone,
  Package,
  CheckCircle,
  Circle
} from 'lucide-react';

interface DeliveryTrackerProps {
  deliveryId: string;
  height?: string;
}

interface DeliveryData {
  id: string;
  order_id: string;
  driver_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  pickup_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  delivery_address: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  status: string;
  estimated_time: number | null;
  created_at: string;
  accepted_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
}

interface DriverLocation {
  lat: number;
  lng: number;
  heading: number | null;
  updated_at: string;
}

export default function DeliveryTracker({ 
  deliveryId, 
  height = '500px' 
}: DeliveryTrackerProps) {
  const mapRef = useRef<any>(null);
  const [map, setMap] = useState<any>(null);
  const [delivery, setDelivery] = useState<DeliveryData | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [routePolyline, setRoutePolyline] = useState<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());

  // Cargar Leaflet
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

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

  const initMap = () => {
    if (!mapRef.current || map) return;
    // @ts-ignore
    const L = window.L;
    if (!L) return;

    const newMap = L.map(mapRef.current).setView([7.119, -73.122], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(newMap);

    setMap(newMap);
  };

  // Cargar datos de la entrega
  useEffect(() => {
    const fetchDelivery = async () => {
      const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .eq('id', deliveryId)
        .single();

      if (!error && data) {
        setDelivery(data);
      }
    };

    fetchDelivery();

    // Suscribirse a cambios
    const channel = supabase
      .channel(`delivery-${deliveryId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'deliveries',
          filter: `id=eq.${deliveryId}`
        },
        (payload) => {
          setDelivery(payload.new as DeliveryData);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [deliveryId]);

  // Cargar ubicación del driver
  useEffect(() => {
    if (!delivery?.driver_id) return;

    const fetchDriverLocation = async () => {
      const { data } = await supabase
        .from('driver_locations')
        .select('lat, lng, heading, updated_at')
        .eq('driver_id', delivery.driver_id)
        .single();

      if (data) {
        setDriverLocation(data);
      }
    };

    fetchDriverLocation();

    // Actualizar ubicación cada 5 segundos
    const interval = setInterval(fetchDriverLocation, 5000);

    // Suscribirse a cambios en tiempo real
    const channel = supabase
      .channel(`driver-location-${delivery.driver_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'driver_locations',
          filter: `driver_id=eq.${delivery.driver_id}`
        },
        (payload) => {
          setDriverLocation(payload.new as DriverLocation);
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [delivery?.driver_id]);

  // Renderizar marcadores y ruta
  useEffect(() => {
    if (!map || !delivery) return;
    // @ts-ignore
    const L = window.L;
    if (!L) return;

    // Limpiar marcadores anteriores
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();
    if (routePolyline) routePolyline.remove();

    const bounds: any[] = [];

    // Ícono de pickup (verde)
    const pickupIcon = L.divIcon({
      html: `
        <div style="
          background-color: #10b981;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          </svg>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    // Ícono de delivery (rojo)
    const deliveryIcon = L.divIcon({
      html: `
        <div style="
          background-color: #ef4444;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          </svg>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    // Marcador de pickup
    if (delivery.pickup_lat && delivery.pickup_lng) {
      const pickupMarker = L.marker(
        [delivery.pickup_lat, delivery.pickup_lng],
        { icon: pickupIcon }
      ).addTo(map);

      pickupMarker.bindPopup(`
        <div style="min-width: 200px;">
          <h4 style="font-weight: bold; margin-bottom: 8px;">📦 Punto de Recogida</h4>
          <p style="margin: 4px 0;">${delivery.pickup_address}</p>
          ${delivery.picked_up_at ? `
            <p style="margin: 4px 0; color: #10b981;">
              ✓ Recogido: ${new Date(delivery.picked_up_at).toLocaleString()}
            </p>
          ` : ''}
        </div>
      `);

      markersRef.current.set('pickup', pickupMarker);
      bounds.push([delivery.pickup_lat, delivery.pickup_lng]);
    }

    // Marcador de delivery
    if (delivery.delivery_lat && delivery.delivery_lng) {
      const deliveryMarker = L.marker(
        [delivery.delivery_lat, delivery.delivery_lng],
        { icon: deliveryIcon }
      ).addTo(map);

      deliveryMarker.bindPopup(`
        <div style="min-width: 200px;">
          <h4 style="font-weight: bold; margin-bottom: 8px;">🏠 Punto de Entrega</h4>
          <p style="margin: 4px 0;"><strong>${delivery.customer_name}</strong></p>
          <p style="margin: 4px 0;">${delivery.delivery_address}</p>
          ${delivery.delivered_at ? `
            <p style="margin: 4px 0; color: #10b981;">
              ✓ Entregado: ${new Date(delivery.delivered_at).toLocaleString()}
            </p>
          ` : ''}
        </div>
      `);

      markersRef.current.set('delivery', deliveryMarker);
      bounds.push([delivery.delivery_lat, delivery.delivery_lng]);
    }

    // Marcador del driver (si está en ruta)
    if (driverLocation && delivery.status === 'en_camino') {
      const driverIcon = L.divIcon({
        html: `
          <div style="
            background-color: #f59e0b;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 3px 10px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            animation: pulse 2s infinite;
          ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polygon points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <style>
            @keyframes pulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.1); }
            }
          </style>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const driverMarker = L.marker(
        [driverLocation.lat, driverLocation.lng],
        { icon: driverIcon }
      ).addTo(map);

      driverMarker.bindPopup(`
        <div style="min-width: 200px;">
          <h4 style="font-weight: bold; margin-bottom: 8px;">🚗 Tu Driver</h4>
          <p style="margin: 4px 0;">En camino a tu ubicación</p>
          <p style="margin: 4px 0; font-size: 12px; color: #666;">
            Actualizado: ${new Date(driverLocation.updated_at).toLocaleTimeString()}
          </p>
        </div>
      `);

      markersRef.current.set('driver', driverMarker);
      bounds.push([driverLocation.lat, driverLocation.lng]);
    }

    // Dibujar ruta
    if (delivery.pickup_lat && delivery.pickup_lng && 
        delivery.delivery_lat && delivery.delivery_lng) {
      const routePoints: [number, number][] = [
        [delivery.pickup_lat, delivery.pickup_lng]
      ];

      // Agregar posición del driver si está en camino
      if (driverLocation && delivery.status === 'en_camino') {
        routePoints.push([driverLocation.lat, driverLocation.lng]);
      }

      routePoints.push([delivery.delivery_lat, delivery.delivery_lng]);

      const polyline = L.polyline(routePoints, {
        color: delivery.status === 'entregado' ? '#10b981' : '#f59e0b',
        weight: 4,
        opacity: 0.7,
        smoothFactor: 1
      }).addTo(map);

      setRoutePolyline(polyline);
    }

    // Ajustar vista para mostrar todos los puntos
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, delivery, driverLocation]);

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pendiente':
        return { color: 'bg-yellow-500', text: 'Buscando Driver', icon: Circle };
      case 'aceptado':
        return { color: 'bg-blue-500', text: 'Driver Asignado', icon: User };
      case 'en_camino':
        return { color: 'bg-orange-500', text: 'En Camino', icon: Navigation };
      case 'entregado':
        return { color: 'bg-green-500', text: 'Entregado', icon: CheckCircle };
      case 'cancelado':
        return { color: 'bg-gray-500', text: 'Cancelado', icon: Circle };
      default:
        return { color: 'bg-gray-500', text: status, icon: Circle };
    }
  };

  if (!delivery) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Cargando información de la entrega...</p>
      </Card>
    );
  }

  const statusInfo = getStatusInfo(delivery.status);
  const StatusIcon = statusInfo.icon;

  return (
    <div className="space-y-4">
      {/* Información de la entrega */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">Pedido #{delivery.order_id}</h2>
            <Badge className={`${statusInfo.color} text-white`}>
              <StatusIcon className="w-4 h-4 mr-1" />
              {statusInfo.text}
            </Badge>
          </div>
          {delivery.estimated_time && (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Tiempo Estimado</p>
              <p className="text-2xl font-bold">{delivery.estimated_time} min</p>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="space-y-3 mt-6">
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              delivery.created_at ? 'bg-green-500' : 'bg-gray-300'
            }`}>
              {delivery.created_at ? (
                <CheckCircle className="w-5 h-5 text-white" />
              ) : (
                <Circle className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold">Pedido Creado</p>
              {delivery.created_at && (
                <p className="text-sm text-muted-foreground">
                  {new Date(delivery.created_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              delivery.accepted_at ? 'bg-green-500' : 'bg-gray-300'
            }`}>
              {delivery.accepted_at ? (
                <CheckCircle className="w-5 h-5 text-white" />
              ) : (
                <Circle className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold">Driver Asignado</p>
              {delivery.accepted_at && (
                <p className="text-sm text-muted-foreground">
                  {new Date(delivery.accepted_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              delivery.picked_up_at ? 'bg-green-500' : 'bg-gray-300'
            }`}>
              {delivery.picked_up_at ? (
                <CheckCircle className="w-5 h-5 text-white" />
              ) : (
                <Circle className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold">Pedido Recogido</p>
              {delivery.picked_up_at && (
                <p className="text-sm text-muted-foreground">
                  {new Date(delivery.picked_up_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              delivery.delivered_at ? 'bg-green-500' : 'bg-gray-300'
            }`}>
              {delivery.delivered_at ? (
                <CheckCircle className="w-5 h-5 text-white" />
              ) : (
                <Circle className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold">Entregado</p>
              {delivery.delivered_at && (
                <p className="text-sm text-muted-foreground">
                  {new Date(delivery.delivered_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Información del cliente */}
        <div className="mt-6 pt-6 border-t">
          <h3 className="font-semibold mb-3">Información del Cliente</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span>{delivery.customer_name}</span>
            </div>
            {delivery.customer_phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{delivery.customer_phone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Direcciones */}
        <div className="mt-6 grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-5 h-5 text-green-600" />
              <h4 className="font-semibold text-green-600">Recogida</h4>
            </div>
            <p className="text-sm">{delivery.pickup_address}</p>
          </div>

          <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-5 h-5 text-red-600" />
              <h4 className="font-semibold text-red-600">Entrega</h4>
            </div>
            <p className="text-sm">{delivery.delivery_address}</p>
          </div>
        </div>
      </Card>

      {/* Mapa en tiempo real */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <Navigation className="w-5 h-5" />
            Seguimiento en Tiempo Real
          </h3>
        </div>
        <div 
          ref={mapRef} 
          style={{ height, width: '100%' }}
        />
      </Card>

      {/* Ubicación del driver en tiempo real */}
      {driverLocation && delivery.status === 'en_camino' && (
        <Card className="p-4 bg-orange-50 dark:bg-orange-950 border-orange-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center animate-pulse">
              <Navigation className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-orange-700 dark:text-orange-300">
                Tu driver está en camino
              </h4>
              <p className="text-sm text-orange-600 dark:text-orange-400">
                Última actualización: {new Date(driverLocation.updated_at).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
