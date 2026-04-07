import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { Clock, DollarSign, ChevronRight, Bike, Check, MapPin, Wallet, Package, Map, BellRing, AlertCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";

interface Order {
  id: string;
  order_id: string;
  customer_name?: string;
  customer_phone?: string | null;
  pickup_address: string;
  delivery_address: string;
  amount: number;
  commission: number;
  estimated_time: number | null;
  zone: string | null;
  notes?: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
}

interface OrderCardProps {
  order: Order;
  onAccept: () => void;
  onReject: () => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

const SlideToAccept = ({ onAccept, commission }: { onAccept: () => void; commission: number }) => {
  const x = useMotionValue(0);
  const background = useTransform(x, [0, 200], ["rgba(99, 102, 241, 0.1)", "rgba(99, 102, 241, 1)"]);
  const opacity = useTransform(x, [0, 150], [1, 0]);
  const [complete, setComplete] = useState(false);

  return (
    <div className="relative w-full h-16 bg-white/5 rounded-[24px] overflow-hidden border border-white/5 shadow-inner">
      <motion.div style={{ background, width: x }} className="absolute inset-y-0 left-0 z-0 rounded-[22px]" />
      <motion.div style={{ opacity }} className="absolute inset-0 flex items-center justify-center gap-3 text-white/30 pointer-events-none">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] italic">Deslizar para aceptar</span>
        <ChevronRight className="h-4 w-4 animate-pulse" />
      </motion.div>
      <motion.div
        drag="x" dragConstraints={{ left: 0, right: 230 }} dragElastic={0.05} dragSnapToOrigin={!complete}
        style={{ x }}
        onDragEnd={(_, info) => { if (info.offset.x > 200) { setComplete(true); onAccept(); } }}
        className="absolute top-1.5 left-1.5 bottom-1.5 w-20 bg-indigo-500 rounded-[20px] shadow-2xl flex items-center justify-center cursor-grab active:cursor-grabbing z-10 transition-all hover:bg-indigo-400"
      >
        {complete ? <Check className="h-7 w-7 text-white animate-bounce" /> : <Bike className="h-7 w-7 text-white" />}
      </motion.div>
      <div className="absolute right-6 inset-y-0 flex items-center pointer-events-none z-0">
          <span className="text-sm font-black text-indigo-400">{fmt(commission)}</span>
      </div>
    </div>
  );
};

const OrderCardMap = ({ order }: { order: Order }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    mapRef.current = L.map(mapContainerRef.current, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mapRef.current);
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.eachLayer((layer) => { if (layer instanceof L.Marker || layer instanceof L.Polyline) map.removeLayer(layer); });
    const bounds: L.LatLngExpression[] = [];
    if (order.pickup_lat && order.pickup_lng) {
      const pIcon = L.divIcon({ className: 'custom-marker', html: '<div class="h-3 w-3 bg-emerald-500 rounded-full border-2 border-white shadow-lg"></div>', iconSize: [12, 12], iconAnchor: [6, 6] });
      L.marker([order.pickup_lat, order.pickup_lng], { icon: pIcon }).addTo(map);
      bounds.push([order.pickup_lat, order.pickup_lng]);
    }
    if (order.delivery_lat && order.delivery_lng) {
      const dIcon = L.divIcon({ className: 'custom-marker', html: '<div class="h-3 w-3 bg-indigo-500 rounded-full border-2 border-white shadow-lg"></div>', iconSize: [12, 12], iconAnchor: [6, 6] });
      L.marker([order.delivery_lat, order.delivery_lng], { icon: dIcon }).addTo(map);
      bounds.push([order.delivery_lat, order.delivery_lng]);
    }
    if (order.pickup_lat && order.pickup_lng && order.delivery_lat && order.delivery_lng) {
      L.polyline([[order.pickup_lat, order.pickup_lng], [order.delivery_lat, order.delivery_lng]], { color: '#6366f1', weight: 3, opacity: 0.5, dashArray: '5, 5' }).addTo(map);
    }
    if (bounds.length > 0) map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [25, 25] });
  }, [order]);

  return <div ref={mapContainerRef} className="absolute inset-0 opacity-40 brightness-110" />;
};

const OrderCard = ({ order, onAccept, onReject }: OrderCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      className="rounded-[42px] overflow-hidden border border-white/5 bg-slate-900 shadow-2xl relative"
    >
      <div className="relative h-44 bg-slate-950 overflow-hidden">
        <OrderCardMap order={order} />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none" />
        
        <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-2xl rounded-2xl px-5 py-2.5 flex items-center gap-3 border border-white/5 shadow-2xl">
          <Clock className="h-4 w-4 text-indigo-400 animate-pulse" />
          <span className="text-sm font-black text-white">{order.estimated_time ?? "?"} MIN</span>
        </div>
        
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
           <div className="bg-indigo-600 px-4 py-1.5 rounded-xl shadow-xl shadow-indigo-600/20">
                <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-1">🔔 OFERTA NUEVA</p>
           </div>
           {order.zone && (
             <div className="bg-white/5 backdrop-blur-xl px-3 py-1 rounded-lg border border-white/5">
                <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">{order.zone}</p>
             </div>
           )}
        </div>
      </div>

      <div className="p-8 pt-2 space-y-8">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="h-14 w-14 bg-indigo-500/10 rounded-3xl flex items-center justify-center border border-indigo-500/10">
                    <Wallet className="h-7 w-7 text-indigo-500" />
                </div>
                <div className="flex flex-col">
                    <p className="text-3xl font-black text-white tracking-tighter">{fmt(order.commission)}</p>
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mt-1">Tu ganancia</p>
                </div>
            </div>
            <div className="text-right flex flex-col items-end">
                <div className="flex items-center gap-2 mb-1">
                    <Package className="h-3 w-3 text-white/20" />
                    <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">A Cobrar</span>
                </div>
                <p className="text-xl font-black text-white/80">{fmt(order.amount)}</p>
            </div>
        </div>

        <div className="relative space-y-6">
          <div className="absolute left-[7px] top-3 bottom-3 w-[2px] bg-white/5" />
          
          <div className="flex items-start gap-5 relative">
            <div className="h-3.5 w-3.5 rounded-full bg-emerald-500 border-4 border-slate-900 shadow-[0_0_15px_rgba(16,185,129,0.3)] mt-1.5" />
            <div className="flex-1">
              <p className="text-[9px] uppercase font-black text-emerald-500 tracking-[0.2em] mb-1">Recogida</p>
              <p className="text-sm font-bold text-white/70 leading-relaxed">{order.pickup_address}</p>
            </div>
          </div>

          <div className="flex items-start gap-5 relative">
            <div className="h-3.5 w-3.5 rounded-full bg-indigo-500 border-4 border-slate-900 shadow-[0_0_15px_rgba(99,102,241,0.3)] mt-1.5" />
            <div className="flex-1">
              <p className="text-[9px] uppercase font-black text-indigo-500 tracking-[0.2em] mb-1">Entrega</p>
              <p className="text-sm font-bold text-white/70 leading-relaxed">{order.delivery_address}</p>
            </div>
          </div>
        </div>

        {/* Customer & Notes */}
        <div className="space-y-4 pt-2 border-t border-white/5">
           <div className="flex items-center justify-between">
              <span className="text-xs font-black text-white/30 uppercase">{order.customer_name}</span>
              {order.customer_phone && <span className="text-[10px] font-bold text-indigo-400">{order.customer_phone}</span>}
           </div>
           {order.notes && (
              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-start gap-3">
                 <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                 <p className="text-xs text-amber-200/70 leading-relaxed font-medium">{order.notes}</p>
              </div>
           )}
        </div>

        <div className="space-y-4">
          <SlideToAccept onAccept={onAccept} commission={order.commission} />
          <button onClick={onReject} className="w-full flex items-center justify-center gap-2 py-3 text-[10px] font-black text-white/20 hover:text-red-400 uppercase tracking-[0.3em] transition-all">
             IGNORAR ESTE PEDIDO
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default OrderCard;
