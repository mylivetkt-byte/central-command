import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Truck, Clock, MapPin, Package } from "lucide-react";
import { motion } from "framer-motion";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

const Operations = () => {
  const { data: deliveries = [] } = useQuery({
    queryKey: ["operations-deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deliveries").select("*, driver:driver_profiles(user:id(full_name))").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 10000,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["operations-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("driver_profiles").select("*, user:id(full_name)");
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 10000,
  });

  const active = deliveries.filter(d => ["aceptado", "en_camino"].includes(d.status || ""));
  const pending = deliveries.filter(d => d.status === "pendiente");
  const completed = deliveries.filter(d => d.status === "entregado");
  const activeDrivers = drivers.filter(d => ["activo", "en_ruta"].includes(d.status || ""));

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
                    <p className="text-xs font-medium text-foreground">{d.user?.full_name || "M"}</p>
                    <p className="text-xs text-muted-foreground">{d.zone || "Sin zona"} · {d.current_load || 0} pedidos</p>
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
                    <p className="text-sm font-medium text-foreground">{d.order_id}</p>
                    <p className="text-xs text-muted-foreground">{d.driver?.user?.full_name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3 text-primary" /> {d.delivery_address}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${d.status === "en_camino" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}`}>
                      {d.status}
                    </span>
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
                    <p className="text-sm font-medium text-foreground">{d.order_id}</p>
                    <p className="text-xs text-muted-foreground">{d.customer_name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3 text-accent" /> {d.pickup_address}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">pendiente</span>
                    <p className="text-xs text-muted-foreground mt-1">{formatCurrency(Number(d.amount || 0))}</p>
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
