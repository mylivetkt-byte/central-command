import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Clock, MapPin, DollarSign, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface HistoryDelivery {
  id: string;
  order_id: string;
  customer_name: string;
  pickup_address: string;
  delivery_address: string;
  commission: number;
  status: string;
  delivered_at: string | null;
  created_at: string;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

const formatTime = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Hoy";
  if (date.toDateString() === yesterday.toDateString()) return "Ayer";
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
};

const DeliveryHistory = () => {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState<HistoryDelivery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchHistory = async () => {
      const { data } = await supabase
        .from("deliveries")
        .select("id, order_id, customer_name, pickup_address, delivery_address, commission, status, delivered_at, created_at")
        .eq("driver_id", user.id)
        .in("status", ["entregado", "cancelado"])
        .order("created_at", { ascending: false })
        .limit(20);

      setDeliveries(data || []);
      setLoading(false);
    };

    fetchHistory();
  }, [user]);

  const totalEarnings = deliveries
    .filter(d => d.status === "entregado")
    .reduce((sum, d) => sum + Number(d.commission), 0);

  const completedCount = deliveries.filter(d => d.status === "entregado").length;

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 rounded-xl bg-muted/50" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-accent/10 border border-accent/20 p-4 text-center">
          <p className="text-xl font-extrabold text-accent">{formatCurrency(totalEarnings)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Ganancias recientes</p>
        </div>
        <div className="rounded-2xl bg-primary/10 border border-primary/20 p-4 text-center">
          <p className="text-xl font-extrabold text-primary">{completedCount}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Entregas completadas</p>
        </div>
      </div>

      {/* History list */}
      {deliveries.length === 0 ? (
        <div className="text-center py-8">
          <Package className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Sin historial aún</p>
        </div>
      ) : (
        <AnimatePresence>
          {deliveries.map((d, i) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/40"
            >
              <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                d.status === "entregado" ? "bg-accent/20" : "bg-destructive/20"
              }`}>
                {d.status === "entregado" ? (
                  <CheckCircle className="h-5 w-5 text-accent" />
                ) : (
                  <Package className="h-5 w-5 text-destructive" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground truncate">{d.customer_name}</p>
                  <span className="text-sm font-bold text-accent shrink-0 ml-2">
                    {formatCurrency(Number(d.commission))}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground truncate">{d.delivery_address}</span>
                  <span className="text-[10px] text-muted-foreground/50 shrink-0">
                    {formatDate(d.delivered_at || d.created_at)} · {formatTime(d.delivered_at || d.created_at)}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
};

export default DeliveryHistory;
