import { motion, AnimatePresence } from "framer-motion";
import { 
  Phone, Navigation, CheckCircle, 
  Bike, Package, User, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import { useDriverLocation } from "@/hooks/useDriverLocation";

interface ActiveDeliveryProps {
  delivery: {
    id: string;
    order_id: string;
    customer_name: string;
    customer_phone: string | null;
    pickup_address: string;
    delivery_address: string;
    amount: number;
    commission: number;
    estimated_time: number | null;
    status: string;
    zone: string | null;
    pickup_lat: number | null;
    pickup_lng: number | null;
    delivery_lat: number | null;
    delivery_lng: number | null;
  };
  onPickedUp: () => void;
  onDelivered: () => void;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

const ActiveDeliveryView = ({ delivery, onPickedUp, onDelivered }: ActiveDeliveryProps) => {
  const [expanded, setExpanded] = useState(true);
  const isPickingUp = delivery.status === "aceptado";
  const isOnTheWay = delivery.status === "en_camino";
  const { currentLocation } = useDriverLocation();
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);

  const currentDestination = isPickingUp ? delivery.pickup_address : delivery.delivery_address;
  const currentLabel = isPickingUp ? "Recoger pedido en" : "Entregar pedido en";
  const currentLat = isPickingUp ? delivery.pickup_lat : delivery.delivery_lat;
  const currentLng = isPickingUp ? delivery.pickup_lng : delivery.delivery_lng;

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
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
      if (layer instanceof L.Marker && layer !== driverMarkerRef.current) {
        map.removeLayer(layer);
      }
    });
    map.eachLayer((layer) => {
      if (layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });

    const bounds: L.LatLngExpression[] = [];

    if (delivery.pickup_lat && delivery.pickup_lng) {
      const pickupIcon = L.divIcon({
        className: 'custom-marker',
        html: '<div style="width:28px;height:28px;background:#22c55e;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><div style="width:10px;height:10px;background:white;border-radius:50%;"></div></div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      L.marker([delivery.pickup_lat, delivery.pickup_lng], { icon: pickupIcon }).addTo(map);
      bounds.push([delivery.pickup_lat, delivery.pickup_lng]);
    }

    if (delivery.delivery_lat && delivery.delivery_lng) {
      const deliveryIcon = L.divIcon({
        className: 'custom-marker',
        html: '<div style="width:28px;height:28px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><div style="width:10px;height:10px;background:white;border-radius:50%;"></div></div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      L.marker([delivery.delivery_lat, delivery.delivery_lng], { icon: deliveryIcon }).addTo(map);
      bounds.push([delivery.delivery_lat, delivery.delivery_lng]);
    }

    if (delivery.pickup_lat && delivery.pickup_lng && delivery.delivery_lat && delivery.delivery_lng) {
      L.polyline(
        [[delivery.pickup_lat, delivery.pickup_lng], [delivery.delivery_lat, delivery.delivery_lng]],
        { color: '#22c55e', weight: 4, opacity: 0.8, dashArray: '10, 10' }
      ).addTo(map);
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [50, 50] });
    }
  }, [delivery.pickup_lat, delivery.pickup_lng, delivery.delivery_lat, delivery.delivery_lng]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (driverMarkerRef.current) {
      map.removeLayer(driverMarkerRef.current);
      driverMarkerRef.current = null;
    }

    if (currentLocation) {
      const driverIcon = L.divIcon({
        className: 'custom-marker driver',
        html: '<div style="width:24px;height:24px;background:#f59e0b;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="14px"><path d="M12 2L4 12l8 10 8-10L12 2zm0 3.5l4.5 7.5-4.5 5.5-4.5-5.5L12 5.5z"/></svg></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      driverMarkerRef.current = L.marker([currentLocation.lat, currentLocation.lng], { icon: driverIcon }).addTo(map);
    }
  }, [currentLocation]);

  const openInMaps = () => {
    if (currentLat && currentLng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${currentLat},${currentLng}&travelmode=driving`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(currentDestination)}&travelmode=driving`, '_blank');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full"
    >
      <div className="flex-1 relative bg-muted min-h-[40vh]">
        <div ref={mapContainerRef} className="absolute inset-0" />

        <div className="absolute top-4 left-4 z-[400]">
          <div className="bg-card/95 backdrop-blur-xl rounded-2xl px-4 py-2 shadow-lg border border-border/30">
            <p className="text-[10px] text-muted-foreground">Tiempo estimado</p>
            <p className="text-xl font-extrabold text-foreground">
              {delivery.estimated_time ?? "?"} <span className="text-sm font-normal text-muted-foreground">min</span>
            </p>
          </div>
        </div>

        <div className="absolute top-4 right-4 z-[400]">
          <Badge className={`px-3 py-1.5 text-xs font-bold rounded-xl shadow-lg ${
            isPickingUp 
              ? "bg-warning/90 text-warning-foreground" 
              : "bg-primary/90 text-primary-foreground"
          }`}>
            {isPickingUp ? (
              <><Package className="h-3.5 w-3.5 mr-1" /> Recogiendo</>
            ) : (
              <><Bike className="h-3.5 w-3.5 mr-1" /> En camino</>
            )}
          </Badge>
        </div>

        <div className="absolute bottom-4 right-4 z-[400]">
          <Button
            onClick={openInMaps}
            size="lg"
            className="h-14 w-14 rounded-full bg-primary shadow-xl shadow-primary/30 hover:bg-primary/90"
          >
            <Navigation className="h-6 w-6 text-primary-foreground" />
          </Button>
        </div>
      </div>

      <motion.div
        className="bg-card rounded-t-3xl border-t border-border/50 shadow-2xl shadow-black/40 relative z-10"
        style={{ marginTop: '-1.5rem' }}
      >
        <div 
          className="flex justify-center pt-3 pb-2 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="px-5 pb-6 space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              {currentLabel}
            </p>
            <p className="text-base font-bold text-foreground leading-snug">{currentDestination}</p>
          </div>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-4 overflow-hidden"
              >
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="h-3 w-3 rounded-full bg-accent" />
                    <span className="text-xs text-muted-foreground truncate">{delivery.pickup_address}</span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex items-center gap-2 flex-1">
                    <div className="h-3 w-3 rounded-full bg-primary" />
                    <span className="text-xs text-muted-foreground truncate">{delivery.delivery_address}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-accent/10 border border-accent/20">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{delivery.customer_name}</p>
                      <p className="text-[10px] text-muted-foreground">#{delivery.order_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-extrabold text-foreground">{formatCurrency(Number(delivery.amount))}</p>
                      <p className="text-[10px] text-muted-foreground">Cliente paga</p>
                    </div>
                    <div className="text-right border-l border-accent/30 pl-4">
                      <p className="text-lg font-extrabold text-accent">{formatCurrency(Number(delivery.commission))}</p>
                      <p className="text-[10px] text-muted-foreground">Tu ganancia</p>
                    </div>
                  </div>
                </div>

                {delivery.customer_phone && (
                  <a
                    href={`tel:${delivery.customer_phone}`}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="h-9 w-9 rounded-full bg-accent/20 flex items-center justify-center">
                      <Phone className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Llamar al cliente</p>
                      <p className="text-xs text-muted-foreground">{delivery.customer_phone}</p>
                    </div>
                  </a>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {isPickingUp && (
            <Button
              onClick={onPickedUp}
              className="w-full h-14 rounded-2xl bg-warning hover:bg-warning/90 text-warning-foreground font-bold text-base shadow-lg shadow-warning/20"
            >
              <Package className="h-5 w-5 mr-2" />
              Ya recogí el pedido
            </Button>
          )}
          {isOnTheWay && (
            <Button
              onClick={onDelivered}
              className="w-full h-14 rounded-2xl bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-base shadow-lg shadow-accent/20"
            >
              <CheckCircle className="h-5 w-5 mr-2" />
              Entrega completada
            </Button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ActiveDeliveryView;
