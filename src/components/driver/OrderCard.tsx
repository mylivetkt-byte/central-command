import { useState } from "react";
import { motion } from "framer-motion";
import { Clock, DollarSign, Phone, MapPin, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useRef } from "react";
import L from "leaflet";

interface Order {
  id: string;
  order_id: string;
  customer_name: string;
  customer_phone: string | null;
  pickup_address: string;
  delivery_address: string;
  amount: number;
  commission: number;
  estimated_time: number | null;
  zone: string | null;
  notes: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
}

interface Props {
  order: Order;
  onAccept: () => void;
  onReject: () => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

// ── Mini mapa de preview ──────────────────────────────────────────────────────
const MiniMap = ({ order }: { order: Order }) => {
  const ref    = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    mapRef.current = L.map(ref.current, {
      zoomControl: false, attributionControl: false,
      dragging: false, scrollWheelZoom: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 15 }).addTo(mapRef.current);
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.eachLayer(l => { if (l instanceof L.Marker || l instanceof L.Polyline) map.removeLayer(l); });
    const bounds: L.LatLngExpression[] = [];
    const makeIcon = (color: string, label: string) => L.divIcon({
      className: "",
      html: `<div title="${label}" style="width:14px;height:14px;background:${color};border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3);"></div>`,
      iconSize: [14, 14], iconAnchor: [7, 7],
    });
    if (order.pickup_lat && order.pickup_lng) {
      L.marker([order.pickup_lat, order.pickup_lng], { icon: makeIcon("#22c55e", "Recogida") }).addTo(map);
      bounds.push([order.pickup_lat, order.pickup_lng]);
    }
    if (order.delivery_lat && order.delivery_lng) {
      L.marker([order.delivery_lat, order.delivery_lng], { icon: makeIcon("#3b82f6", "Entrega") }).addTo(map);
      bounds.push([order.delivery_lat, order.delivery_lng]);
    }
    if (bounds.length === 2) {
      L.polyline(bounds, { color: "#94a3b8", weight: 2, dashArray: "4 4", opacity: 0.7 }).addTo(map);
      map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [20, 20] });
    } else if (bounds.length === 1) {
      map.setView(bounds[0] as L.LatLngExpression, 14);
    }
  }, [order.pickup_lat, order.pickup_lng, order.delivery_lat, order.delivery_lng]);

  return <div ref={ref} className="absolute inset-0" />;
};

// ── Tarjeta de pedido ─────────────────────────────────────────────────────────
const OrderCard = ({ order, onAccept, onReject }: Props) => {
  const [accepting, setAccepting] = useState(false);

  const handleAccept = async () => {
    if (accepting) return;
    setAccepting(true);
    try { await onAccept(); } finally { setAccepting(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.97 }}
      className="rounded-2xl overflow-hidden border border-border/60 bg-card shadow-lg"
    >
      {/* Mini mapa */}
      <div className="relative h-28 bg-muted overflow-hidden">
        <MiniMap order={order} />
        <div className="absolute top-2 right-2 bg-card/90 backdrop-blur rounded-lg px-2.5 py-1 flex items-center gap-1 z-[400]">
          <Clock className="h-3 w-3 text-amber-500" />
          <span className="text-xs font-bold">{order.estimated_time ?? "?"} min</span>
        </div>
        {order.zone && (
          <div className="absolute bottom-2 left-2 bg-card/90 backdrop-blur rounded-lg px-2.5 py-1 z-[400]">
            <span className="text-[10px] text-muted-foreground">{order.zone}</span>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Ganancia destacada */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-accent/10 border border-accent/20">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-accent" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-accent leading-none">{fmt(Number(order.commission))}</p>
              <p className="text-[10px] text-muted-foreground">Tu ganancia</p>
            </div>
          </div>
          <div className="text-right border-l border-accent/20 pl-3">
            <p className="text-xs text-muted-foreground">Cliente paga</p>
            <p className="text-base font-bold text-foreground">{fmt(Number(order.amount))}</p>
          </div>
        </div>

        {/* Ruta */}
        <div className="relative pl-5 space-y-2.5">
          <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-gradient-to-b from-accent to-primary" />
          <div className="relative">
            <div className="absolute -left-5 top-1 h-3.5 w-3.5 rounded-full bg-accent flex items-center justify-center">
              <div className="h-1.5 w-1.5 rounded-full bg-white" />
            </div>
            <p className="text-[10px] uppercase tracking-wider text-accent font-semibold">Recoger</p>
            <p className="text-sm text-foreground leading-tight">{order.pickup_address}</p>
          </div>
          <div className="relative">
            <div className="absolute -left-5 top-1 h-3.5 w-3.5 rounded-full bg-primary flex items-center justify-center">
              <div className="h-1.5 w-1.5 rounded-full bg-white" />
            </div>
            <p className="text-[10px] uppercase tracking-wider text-primary font-semibold">Entregar a</p>
            <p className="text-sm text-foreground leading-tight">{order.delivery_address}</p>
          </div>
        </div>

        {/* Info cliente + teléfono */}
        <div className="flex items-center justify-between pt-1 border-t border-border/40">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
              <span className="text-[10px] font-bold text-muted-foreground">
                {order.customer_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">{order.customer_name}</span>
          </div>
          <div className="flex items-center gap-2">
            {order.customer_phone && (
              <a href={`tel:${order.customer_phone}`}
                className="flex items-center gap-1 text-[10px] text-primary bg-primary/10 rounded-lg px-2 py-1"
                onClick={e => e.stopPropagation()}>
                <Phone className="h-3 w-3" />
                {order.customer_phone}
              </a>
            )}
            <span className="text-[10px] text-muted-foreground/60">#{order.order_id}</span>
          </div>
        </div>

        {/* Notas del admin — CAMPO CRÍTICO que faltaba */}
        {order.notes && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-snug">{order.notes}</p>
          </div>
        )}

        {/* Acciones */}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={onReject} disabled={accepting}
            className="flex-1 h-12 rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10 font-semibold">
            Rechazar
          </Button>
          <Button onClick={handleAccept} disabled={accepting}
            className="flex-[2] h-12 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-base">
            {accepting
              ? <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Tomando...</span>
              : `Aceptar ${fmt(Number(order.commission))}`
            }
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default OrderCard;
