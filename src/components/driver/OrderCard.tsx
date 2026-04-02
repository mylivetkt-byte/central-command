import { motion } from "framer-motion";
import { MapPin, Clock, Navigation, DollarSign, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useRef } from "react";
import L from "leaflet";

interface OrderCardProps {
  order: {
    id: string;
    order_id: string;
    customer_name: string;
    pickup_address: string;
    delivery_address: string;
    amount: number;
    commission: number;
    estimated_time: number | null;
    zone: string | null;
    pickup_lat: number | null;
    pickup_lng: number | null;
    delivery_lat: number | null;
    delivery_lng: number | null;
  };
  onAccept: () => void;
  onReject: () => void;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

const OrderCard = ({ order, onAccept, onReject }: OrderCardProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 15,
    }).addTo(mapRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });

    const bounds: L.LatLngBoundsExpression = [];
    let hasPickup = false;
    let hasDelivery = false;

    if (order.pickup_lat && order.pickup_lng) {
      const pickupIcon = L.divIcon({
        className: 'custom-marker',
        html: '<div style="width:16px;height:16px;background:#22c55e;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker([order.pickup_lat, order.pickup_lng], { icon: pickupIcon }).addTo(map);
      bounds.push([order.pickup_lat, order.pickup_lng]);
      hasPickup = true;
    }

    if (order.delivery_lat && order.delivery_lng) {
      const deliveryIcon = L.divIcon({
        className: 'custom-marker',
        html: '<div style="width:16px;height:16px;background:#3b82f6;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker([order.delivery_lat, order.delivery_lng], { icon: deliveryIcon }).addTo(map);
      bounds.push([order.delivery_lat, order.delivery_lng]);
      hasDelivery = true;
    }

    if (hasPickup && hasDelivery) {
      L.polyline(
        [
          [order.pickup_lat!, order.pickup_lng!],
          [order.delivery_lat!, order.delivery_lng!],
        ],
        { color: '#6b7280', weight: 2, opacity: 0.6, dashArray: '4, 4' }
      ).addTo(map);
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [order.pickup_lat, order.pickup_lng, order.delivery_lat, order.delivery_lng]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className="rounded-2xl overflow-hidden border border-border/60 bg-card shadow-xl shadow-black/20"
    >
      {/* Map preview with real map */}
      <div className="relative h-32 bg-muted overflow-hidden rounded-t-2xl">
        <div ref={mapContainerRef} className="absolute inset-0" />
        {/* Overlay info */}
        <div className="absolute top-3 right-3 bg-card/90 backdrop-blur-md rounded-xl px-3 py-1.5 flex items-center gap-1.5 z-[400]">
          <Clock className="h-3.5 w-3.5 text-warning" />
          <span className="text-sm font-bold text-foreground">{order.estimated_time ?? "?"} min</span>
        </div>
        <div className="absolute bottom-3 left-3 bg-card/90 backdrop-blur-md rounded-xl px-3 py-1.5 z-[400]">
          <span className="text-xs text-muted-foreground">{order.zone || "Sin zona"}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Price prominently */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-accent/10 border border-accent/20">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-accent" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-accent">{formatCurrency(Number(order.commission))}</p>
              <p className="text-[10px] text-muted-foreground">Tu ganancia</p>
            </div>
          </div>
          <div className="text-right border-l border-accent/20 pl-3">
            <p className="text-xs text-muted-foreground">Cobrado al cliente</p>
            <p className="text-lg font-bold text-foreground">{formatCurrency(Number(order.amount))}</p>
          </div>
        </div>

        {/* Route */}
        <div className="relative pl-6 space-y-3">
          {/* Vertical line connector */}
          <div className="absolute left-[9px] top-2 bottom-2 w-[2px] bg-gradient-to-b from-accent to-primary" />

          <div className="relative">
            <div className="absolute -left-6 top-0.5 h-4 w-4 rounded-full bg-accent flex items-center justify-center">
              <div className="h-1.5 w-1.5 rounded-full bg-accent-foreground" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-accent font-semibold">Recoger</p>
              <p className="text-sm text-foreground leading-tight">{order.pickup_address}</p>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-6 top-0.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
              <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-primary font-semibold">Entregar</p>
              <p className="text-sm text-foreground leading-tight">{order.delivery_address}</p>
            </div>
          </div>
        </div>

        {/* Customer */}
        <div className="flex items-center gap-2 pt-1 border-t border-border/40">
          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
            <span className="text-[10px] font-bold text-muted-foreground">
              {order.customer_name.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{order.customer_name}</span>
          <span className="ml-auto text-[10px] text-muted-foreground/60">#{order.order_id}</span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            onClick={onReject}
            className="flex-1 h-12 rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10 font-semibold"
          >
            Rechazar
          </Button>
          <Button
            onClick={onAccept}
            className="flex-[2] h-12 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-base"
          >
            Aceptar {formatCurrency(Number(order.commission))}
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default OrderCard;
