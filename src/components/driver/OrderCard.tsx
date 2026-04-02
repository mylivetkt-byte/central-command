import { motion } from "framer-motion";
import { MapPin, Clock, Navigation, DollarSign, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  };
  onAccept: () => void;
  onReject: () => void;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

const OrderCard = ({ order, onAccept, onReject }: OrderCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className="rounded-2xl overflow-hidden border border-border/60 bg-card shadow-xl shadow-black/20"
    >
      {/* Map preview area with gradient */}
      <div className="relative h-32 bg-gradient-to-br from-secondary via-muted to-secondary overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-4 left-6 w-3 h-3 rounded-full bg-accent animate-ping" />
          <div className="absolute top-4 left-6 w-3 h-3 rounded-full bg-accent" />
          <div className="absolute bottom-6 right-8 w-3 h-3 rounded-full bg-primary animate-ping" style={{ animationDelay: '0.5s' }} />
          <div className="absolute bottom-6 right-8 w-3 h-3 rounded-full bg-primary" />
          {/* Simulated route line */}
          <svg className="absolute inset-0 w-full h-full">
            <line x1="30" y1="20" x2="85%" y2="75%" stroke="hsl(var(--primary))" strokeWidth="3" strokeDasharray="8 4" opacity="0.6" />
          </svg>
        </div>
        {/* Overlay info */}
        <div className="absolute top-3 right-3 bg-card/90 backdrop-blur-md rounded-xl px-3 py-1.5 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-warning" />
          <span className="text-sm font-bold text-foreground">{order.estimated_time ?? "?"} min</span>
        </div>
        <div className="absolute bottom-3 left-3 bg-card/90 backdrop-blur-md rounded-xl px-3 py-1.5">
          <span className="text-xs text-muted-foreground">{order.zone || "Sin zona"}</span>
        </div>
        <div className="absolute bottom-3 right-3 bg-accent/90 backdrop-blur-md rounded-xl px-3 py-1.5">
          <span className="text-xs font-bold text-accent-foreground">
            {order.estimated_time ? `${Math.max(1, Math.round((order.estimated_time / 60) * 4))} km` : "? km"}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Price prominently */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-foreground">{formatCurrency(Number(order.commission))}</p>
              <p className="text-[10px] text-muted-foreground">Tu comisión</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Valor total</p>
            <p className="text-sm font-semibold text-foreground/70">{formatCurrency(Number(order.amount))}</p>
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
