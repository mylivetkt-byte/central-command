import { motion, AnimatePresence } from "framer-motion";
import { 
  MapPin, Phone, Navigation, CheckCircle, Clock, 
  ChevronDown, Bike, Package, User, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

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

  const currentDestination = isPickingUp ? delivery.pickup_address : delivery.delivery_address;
  const currentLabel = isPickingUp ? "Recoger pedido en" : "Entregar pedido en";
  const currentLat = isPickingUp ? delivery.pickup_lat : delivery.delivery_lat;
  const currentLng = isPickingUp ? delivery.pickup_lng : delivery.delivery_lng;

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
      {/* Map Area - takes most of the screen */}
      <div className="flex-1 relative bg-gradient-to-br from-secondary via-muted to-secondary min-h-[40vh]">
        {/* Simulated map with route visualization */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Grid pattern to simulate map */}
          <div className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)`,
              backgroundSize: '40px 40px'
            }}
          />
          
          {/* Route visualization */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 400">
            <defs>
              <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--accent))" />
                <stop offset="100%" stopColor="hsl(var(--primary))" />
              </linearGradient>
            </defs>
            <path
              d="M 80 80 Q 120 150 200 200 Q 280 250 320 320"
              fill="none"
              stroke="url(#routeGradient)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={isPickingUp ? "0" : "12 6"}
            />
            {/* Pickup point */}
            <circle cx="80" cy="80" r="10" fill="hsl(var(--accent))" />
            <circle cx="80" cy="80" r="5" fill="hsl(var(--accent-foreground))" />
            {/* Delivery point */}
            <circle cx="320" cy="320" r="10" fill="hsl(var(--primary))" />
            <circle cx="320" cy="320" r="5" fill="hsl(var(--primary-foreground))" />
            {/* Moving driver dot */}
            <motion.circle
              cx={isPickingUp ? 80 : 200}
              cy={isPickingUp ? 80 : 200}
              r="8"
              fill="hsl(var(--warning))"
              animate={{
                cx: isPickingUp ? [60, 80, 100, 80] : [180, 200, 220, 200],
                cy: isPickingUp ? [60, 80, 100, 80] : [180, 200, 220, 200],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
          </svg>
        </div>

        {/* ETA Badge */}
        <div className="absolute top-4 left-4">
          <div className="bg-card/95 backdrop-blur-xl rounded-2xl px-4 py-2 shadow-lg border border-border/30">
            <p className="text-[10px] text-muted-foreground">Tiempo estimado</p>
            <p className="text-xl font-extrabold text-foreground">
              {delivery.estimated_time ?? "?"} <span className="text-sm font-normal text-muted-foreground">min</span>
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="absolute top-4 right-4">
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

        {/* Navigate button on map */}
        <div className="absolute bottom-4 right-4">
          <Button
            onClick={openInMaps}
            size="lg"
            className="h-14 w-14 rounded-full bg-primary shadow-xl shadow-primary/30 hover:bg-primary/90"
          >
            <Navigation className="h-6 w-6 text-primary-foreground" />
          </Button>
        </div>
      </div>

      {/* Bottom Sheet */}
      <motion.div
        className="bg-card rounded-t-3xl border-t border-border/50 shadow-2xl shadow-black/40 relative z-10"
        style={{ marginTop: '-1.5rem' }}
      >
        {/* Handle */}
        <div 
          className="flex justify-center pt-3 pb-2 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="px-5 pb-6 space-y-4">
          {/* Current destination */}
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
                {/* Route summary */}
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

                {/* Customer & payment info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{delivery.customer_name}</p>
                      <p className="text-[10px] text-muted-foreground">#{delivery.order_id}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-extrabold text-accent">{formatCurrency(Number(delivery.commission))}</p>
                    <p className="text-[10px] text-muted-foreground">Comisión</p>
                  </div>
                </div>

                {/* Call customer */}
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

          {/* Action button */}
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
