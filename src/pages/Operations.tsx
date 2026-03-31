import { DashboardLayout } from "@/components/DashboardLayout";
import { deliveries, drivers, formatCurrency } from "@/data/mockData";
import { KPICard } from "@/components/KPICard";
import { Truck, Clock, MapPin, Package } from "lucide-react";
import { motion } from "framer-motion";

const Operations = () => {
  const active = deliveries.filter(d => ["aceptado", "en_camino"].includes(d.status));
  const pending = deliveries.filter(d => d.status === "pendiente");
  const completed = deliveries.filter(d => d.status === "entregado");
  const activeDrivers = drivers.filter(d => ["activo", "en_ruta"].includes(d.status));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Operaciones en Vivo</h1>
          <p className="text-sm text-muted-foreground">Monitoreo en tiempo real de entregas y repartidores</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard title="En Curso" value={active.length} icon={<Truck className="h-5 w-5" />} variant="primary" />
          <KPICard title="Pendientes" value={pending.length} icon={<Clock className="h-5 w-5" />} variant="warning" />
          <KPICard title="Finalizados" value={completed.length} icon={<Package className="h-5 w-5" />} variant="success" />
          <KPICard title="Repartidores Activos" value={activeDrivers.length} icon={<MapPin className="h-5 w-5" />} variant="primary" />
        </div>

        {/* Simulated Map */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Mapa de Operaciones</h3>
          <div className="relative h-80 rounded-xl bg-muted/30 border border-border/30 overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <MapPin className="h-12 w-12 text-primary/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Mapa interactivo</p>
                <p className="text-xs text-muted-foreground">Integración con API de mapas disponible</p>
              </div>
            </div>
            {/* Simulated driver dots */}
            {activeDrivers.map((d, i) => (
              <div
                key={d.id}
                className="absolute animate-pulse-glow"
                style={{ left: `${15 + (i * 8) % 70}%`, top: `${20 + (i * 13) % 55}%` }}
              >
                <div className="relative group">
                  <div className={`h-4 w-4 rounded-full ${d.status === "en_ruta" ? "bg-primary" : "bg-accent"} shadow-lg`} />
                  <div className="absolute bottom-5 left-1/2 -translate-x-1/2 hidden group-hover:block bg-card border border-border rounded-lg px-2 py-1 whitespace-nowrap z-10">
                    <p className="text-xs font-medium text-foreground">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{d.zone} · {d.currentLoad} pedidos</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Entregas Activas</h3>
            <div className="space-y-2 max-h-[350px] overflow-y-auto">
              {active.map(d => (
                <div key={d.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{d.orderId}</p>
                    <p className="text-xs text-muted-foreground">{d.driverName}</p>
                    <p className="text-xs text-muted-foreground">{d.deliveryAddress}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${d.status === "en_camino" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}`}>
                      {d.status.replace("_", " ")}
                    </span>
                    {d.isDelayed && <p className="text-xs text-destructive mt-1">⚠ Demorado</p>}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Pedidos Pendientes</h3>
            <div className="space-y-2 max-h-[350px] overflow-y-auto">
              {pending.length === 0 && <p className="text-sm text-muted-foreground">No hay pedidos pendientes</p>}
              {pending.map(d => (
                <div key={d.id} className="flex items-center justify-between rounded-lg bg-warning/5 border border-warning/20 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{d.orderId}</p>
                    <p className="text-xs text-muted-foreground">{d.customerName}</p>
                    <p className="text-xs text-muted-foreground">{d.pickupAddress}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">pendiente</span>
                    <p className="text-xs text-muted-foreground mt-1">{formatCurrency(d.amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Operations;
