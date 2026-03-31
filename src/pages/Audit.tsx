import { DashboardLayout } from "@/components/DashboardLayout";
import { auditLog } from "@/data/mockData";
import { motion } from "framer-motion";
import { CheckCircle, Clock, Truck, Package } from "lucide-react";

const eventIcons: Record<string, JSX.Element> = {
  "Pedido creado": <Package className="h-4 w-4 text-primary" />,
  "Pedido aceptado": <Clock className="h-4 w-4 text-warning" />,
  "En camino": <Truck className="h-4 w-4 text-accent" />,
  "Entregado": <CheckCircle className="h-4 w-4 text-accent" />,
};

const Audit = () => {
  const grouped = auditLog.reduce((acc, entry) => {
    if (!acc[entry.deliveryId]) acc[entry.deliveryId] = [];
    acc[entry.deliveryId].push(entry);
    return acc;
  }, {} as Record<string, typeof auditLog>);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Registro de Auditoría</h1>
          <p className="text-sm text-muted-foreground">Trazabilidad completa de cada domicilio</p>
        </div>

        <div className="space-y-6">
          {Object.entries(grouped).map(([deliveryId, entries]) => (
            <motion.div key={deliveryId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
              <h3 className="mb-4 text-sm font-semibold text-foreground">{deliveryId}</h3>
              <div className="relative ml-3 border-l-2 border-border/50 pl-6 space-y-4">
                {entries.map(e => (
                  <div key={e.id} className="relative">
                    <div className="absolute -left-[31px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-card border border-border">
                      {eventIcons[e.event] || <Clock className="h-3 w-3 text-muted-foreground" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{e.event}</p>
                        <span className="text-xs text-muted-foreground">{new Date(e.timestamp).toLocaleTimeString("es-CO")}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{e.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Audit;
