import { DashboardLayout } from "@/components/DashboardLayout";
import { alerts } from "@/data/mockData";
import { motion } from "framer-motion";
import { AlertTriangle, Clock, MapPin, CheckCircle } from "lucide-react";
import { useState } from "react";

const severityStyles = {
  danger: "border-destructive/30 bg-destructive/5",
  warning: "border-warning/30 bg-warning/5",
  info: "border-primary/30 bg-primary/5",
};

const severityIcons = {
  delayed: <Clock className="h-5 w-5 text-destructive" />,
  inactive_driver: <AlertTriangle className="h-5 w-5 text-warning" />,
  high_demand: <MapPin className="h-5 w-5 text-primary" />,
};

const Alerts = () => {
  const [items, setItems] = useState(alerts);
  const active = items.filter(a => !a.resolved);
  const resolved = items.filter(a => a.resolved);

  const resolve = (id: string) => setItems(prev => prev.map(a => a.id === id ? { ...a, resolved: true } : a));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sistema de Alertas</h1>
          <p className="text-sm text-muted-foreground">{active.length} alertas activas</p>
        </div>

        <div className="space-y-3">
          {active.map(a => (
            <motion.div key={a.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className={`flex items-center justify-between rounded-xl border p-4 ${severityStyles[a.severity]}`}>
              <div className="flex items-center gap-4">
                {severityIcons[a.type]}
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

        {resolved.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Resueltas</h3>
            <div className="space-y-2">
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
