import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertTriangle, Clock, MapPin, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";

const severityStyles: Record<string, string> = {
  danger: "border-destructive/30 bg-destructive/5",
  warning: "border-warning/30 bg-warning/5",
  info: "border-primary/30 bg-primary/5",
};

const severityIcons: Record<string, JSX.Element> = {
  delayed: <Clock className="h-5 w-5 text-destructive" />,
  inactive_driver: <AlertTriangle className="h-5 w-5 text-warning" />,
  high_demand: <MapPin className="h-5 w-5 text-primary" />,
};

interface Alert {
  id: string;
  type: string;
  severity: string;
  message: string;
  timestamp: string;
  resolved: boolean;
}

const Alerts = () => {
  const [items, setItems] = useState<Alert[]>([]);

  // Monitor deliveries for dynamic alerts
  const { data: deliveries = [] } = useQuery({
    queryKey: ["alerts-deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deliveries").select("id, status, updated_at, order_id").order("updated_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  // Generate dynamic alerts and store them in memory
  useEffect(() => {
    const generatedAlerts: Alert[] = [];
    
    // Check for delayed ("en_camino" for more than 40 mins)
    const delayedDeliveries = deliveries.filter((d: any) => {
      if (d.status !== "en_camino") return false;
      const updated = new Date(d.updated_at);
      const now = new Date();
      return (now.getTime() - updated.getTime()) > (40 * 60 * 1000); // 40 minutes
    });

    delayedDeliveries.forEach((d: any) => {
      generatedAlerts.push({
        id: `alert-delay-${d.id}`,
        type: "delayed",
        severity: "danger",
        message: `El pedido ${d.order_id} lleva más de 40 minutos en camino.`,
        timestamp: d.updated_at,
        resolved: false,
      });
    });

    // Merge generated alerts with current state so we don't overwrite resolved status
    setItems(prev => {
      const merged = [...prev];
      generatedAlerts.forEach(newAlert => {
        if (!merged.find(a => a.id === newAlert.id)) {
          merged.unshift(newAlert);
        }
      });
      return merged;
    });
  }, [deliveries]);

  const active = items.filter(a => !a.resolved);
  const resolved = items.filter(a => a.resolved);

  const resolve = (id: string) => setItems(prev => prev.map(a => a.id === id ? { ...a, resolved: true } : a));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sistema de Alertas</h1>
          <p className="text-sm text-muted-foreground">{active.length} alertas activas detectadas en tiempo real</p>
        </div>

        {active.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <CheckCircle className="h-10 w-10 text-success mx-auto mb-3" />
            <h3 className="font-semibold text-foreground">Todo en orden</h3>
            <p className="text-sm text-muted-foreground">No hay alertas activas en el sistema en este momento.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {active.map(a => (
              <motion.div key={a.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className={`flex items-center justify-between rounded-xl border p-4 ${severityStyles[a.severity]}`}>
                <div className="flex items-center gap-4">
                  {severityIcons[a.type] || <AlertTriangle className="h-5 w-5 text-muted-foreground" />}
                  <div>
                    <p className="text-sm font-medium text-foreground">{a.message}</p>
                    <p className="text-xs text-muted-foreground">{new Date(a.timestamp).toLocaleTimeString("es-CO")}</p>
                  </div>
                </div>
                <button onClick={() => resolve(a.id)} className="flex items-center gap-1 rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 transition-colors">
                  <CheckCircle className="h-3 w-3" /> Resolver
                </button>
              </motion.div>
            ))}
          </div>
        )}

        {resolved.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Resueltas</h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {resolved.map(a => (
                <div key={a.id} className="flex items-center gap-4 rounded-xl border border-border/30 bg-muted/20 p-4 opacity-60">
                  <CheckCircle className="h-5 w-5 text-accent" />
                  <div>
                    <p className="text-sm text-foreground line-through">{a.message}</p>
                    <p className="text-xs text-muted-foreground">{new Date(a.timestamp).toLocaleTimeString("es-CO")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Alerts;
