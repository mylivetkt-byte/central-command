import { DashboardLayout } from "@/components/DashboardLayout";
import { drivers, deliveries, formatCurrency } from "@/data/mockData";
import { motion } from "framer-motion";
import { Zap, MapPin, Package } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const Dispatch = () => {
  const pending = deliveries.filter(d => d.status === "pendiente");
  const available = drivers.filter(d => ["activo"].includes(d.status)).sort((a, b) => a.currentLoad - b.currentLoad);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);

  const autoAssign = () => {
    toast.success("Asignación automática completada", { description: `${pending.length} pedidos asignados a ${Math.min(pending.length, available.length)} repartidores` });
  };

  const manualAssign = (driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    toast.success(`Pedido asignado a ${driver?.name}`, { description: `Orden ${selectedOrder}` });
    setSelectedOrder(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Despacho Inteligente</h1>
            <p className="text-sm text-muted-foreground">Asignación manual y automática de pedidos</p>
          </div>
          <button onClick={autoAssign} className="flex items-center gap-2 rounded-lg bg-gradient-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity">
            <Zap className="h-4 w-4" /> Asignación Automática
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Pedidos Pendientes ({pending.length})</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {pending.map(d => (
                <button
                  key={d.id} onClick={() => setSelectedOrder(d.orderId)}
                  className={`w-full rounded-lg p-3 text-left transition-colors ${selectedOrder === d.orderId ? "bg-primary/10 border border-primary/30" : "bg-muted/30 hover:bg-muted/50"}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{d.orderId}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {d.zone}</p>
                      <p className="text-xs text-muted-foreground">{d.deliveryAddress}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(d.amount)}</p>
                      <p className="text-xs text-muted-foreground">{d.estimatedTime} min est.</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">
              {selectedOrder ? `Asignar: ${selectedOrder}` : "Repartidores Disponibles"}
            </h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {available.map(d => (
                <div key={d.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-sm font-bold text-accent">{d.avatar}</div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{d.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Package className="h-3 w-3" /> {d.currentLoad} pedidos · {d.zone}
                      </p>
                    </div>
                  </div>
                  {selectedOrder && (
                    <button onClick={() => manualAssign(d.id)} className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                      Asignar
                    </button>
                  )}
                  {!selectedOrder && (
                    <span className="text-xs text-muted-foreground">⭐ {d.rating} · {d.acceptanceRate}%</span>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dispatch;
