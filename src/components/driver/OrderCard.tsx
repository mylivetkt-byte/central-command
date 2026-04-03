import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { Clock, DollarSign, ChevronRight, Bike, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";

interface OrderCardProps {
  order: {
    id: string;
    order_id: string;
    customer_name?: string;
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

// --- Componente de Deslizar para Aceptar ---
const SlideToAccept = ({ onAccept, commission }: { onAccept: () => void; commission: number }) => {
  const x = useMotionValue(0);
  const background = useTransform(
    x,
    [0, 200],
    ["rgba(34, 197, 94, 0.1)", "rgba(34, 197, 94, 1)"]
  );
  const opacity = useTransform(x, [0, 150], [1, 0]);
  const [complete, setComplete] = useState(false);

  return (
    <div className="relative w-full h-14 bg-muted/50 rounded-2xl overflow-hidden border border-border/10">
      {/* Track Background */}
      <motion.div 
        style={{ background, width: x }} 
        className="absolute inset-y-0 left-0 z-0 rounded-2xl"
      />
      
      {/* Ghost Text */}
      <motion.div 
        style={{ opacity }}
        className="absolute inset-0 flex items-center justify-center gap-2 text-muted-foreground pointer-events-none"
      >
        <span className="text-xs font-black uppercase tracking-widest italic">Deslizar para Aceptar</span>
        <ChevronRight className="h-4 w-4 animate-pulse" />
      </motion.div>

      {/* Draggable Handle */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 220 }}
        dragElastic={0.1}
        dragSnapToOrigin={!complete}
        style={{ x }}
        onDragEnd={(_, info) => {
          if (info.offset.x > 180) {
            setComplete(true);
            onAccept();
          }
        }}
        className="absolute top-1 left-1 bottom-1 w-20 bg-accent rounded-xl shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
      >
        {complete ? (
            <Check className="h-6 w-6 text-white animate-bounce" />
        ) : (
            <Bike className="h-6 w-6 text-white" />
        )}
      </motion.div>
      
      <div className="absolute right-4 inset-y-0 flex items-center pointer-events-none z-0">
          <span className="text-sm font-black text-accent">{formatCurrency(commission)}</span>
      </div>
    </div>
  );
};

const OrderCardMap = ({ order }: { order: OrderCardProps["order"] }) => {
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
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 15 }).addTo(mapRef.current);
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    map.eachLayer((layer) => { if (layer instanceof L.Marker || layer instanceof L.Polyline) map.removeLayer(layer); });
    const bounds: L.LatLngExpression[] = [];
    if (order.pickup_lat && order.pickup_lng) {
      const pickupIcon = L.divIcon({ className: 'custom-marker', html: '<div style="width:14px;height:14px;background:#22c55e;border-radius:50%;border:3px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3);"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });
      L.marker([order.pickup_lat, order.pickup_lng], { icon: pickupIcon }).addTo(map);
      bounds.push([order.pickup_lat, order.pickup_lng]);
    }
    if (order.delivery_lat && order.delivery_lng) {
      const deliveryIcon = L.divIcon({ className: 'custom-marker', html: '<div style="width:14px;height:14px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3);"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });
      L.marker([order.delivery_lat, order.delivery_lng], { icon: deliveryIcon }).addTo(map);
      bounds.push([order.delivery_lat, order.delivery_lng]);
    }
    if (order.pickup_lat && order.pickup_lng && order.delivery_lat && order.delivery_lng) {
      L.polyline([[order.pickup_lat, order.pickup_lng], [order.delivery_lat, order.delivery_lng]], { color: '#3b82f6', weight: 4, opacity: 0.4, dashArray: '6, 6' }).addTo(map);
    }
    if (bounds.length > 0) map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [20, 20] });
  }, [order]);

  return <div ref={mapContainerRef} className="absolute inset-0 grayscale contrast-[1.2]" />;
};

const OrderCard = ({ order, onAccept, onReject }: OrderCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, rotate: -2 }}
      className="rounded-[32px] overflow-hidden border border-border/10 bg-card shadow-[0_20px_50px_rgba(0,0,0,0.2)]"
    >
      <div className="relative h-36 bg-muted overflow-hidden">
        <OrderCardMap order={order} />
        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-xl rounded-2xl px-4 py-2 flex items-center gap-2 z-[400] border border-white/10 shadow-2xl">
          <Clock className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-sm font-black text-white">{order.estimated_time ?? "?"} MIN</span>
        </div>
        <div className="absolute top-4 left-4 z-[400]">
           <div className="bg-primary px-3 py-1 rounded-lg shadow-lg">
                <p className="text-[10px] font-black text-white uppercase tracking-tighter">Oferta Nueva</p>
           </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-accent flex items-center justify-center shadow-lg shadow-accent/20">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-black text-accent leading-none">{formatCurrency(Number(order.commission))}</p>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Tu Pago</p>
            </div>
          </div>
          <div className="text-right border-l border-slate-200 pl-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Cobro</p>
            <p className="text-lg font-black text-foreground">{formatCurrency(Number(order.amount))}</p>
          </div>
        </div>

        <div className="relative pl-8 space-y-5">
          <div className="absolute left-[13px] top-2 bottom-2 w-[3px] bg-gradient-to-b from-green-500 via-slate-200 to-primary rounded-full" />
          
          <div className="relative">
            <div className="absolute -left-9 top-0.5 h-6 w-6 rounded-full bg-green-500 flex items-center justify-center border-4 border-card shadow-lg">
              <div className="h-1.5 w-1.5 rounded-full bg-white" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black text-green-600 tracking-widest">Recogida</p>
              <p className="text-sm font-bold text-foreground leading-snug break-words">{order.pickup_address}</p>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-9 top-0.5 h-6 w-6 rounded-full bg-primary flex items-center justify-center border-4 border-card shadow-lg">
               <MapPin className="h-3 w-3 text-white" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black text-primary tracking-widest">Entrega</p>
              <p className="text-sm font-bold text-foreground leading-snug break-words">{order.delivery_address}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <SlideToAccept onAccept={onAccept} commission={order.commission} />
          
          <button
            onClick={onReject}
            className="w-full py-2 text-xs font-black text-muted-foreground hover:text-destructive uppercase tracking-widest transition-colors opacity-50 hover:opacity-100"
          >
            Ocultar este pedido
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const MapPin = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className={className}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
)

export default OrderCard;
