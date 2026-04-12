import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Truck, Clock, MapPin, Package, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import LiveMap from "@/components/LiveMap";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

const statusColors: Record<string, string> = {
  pendiente:  "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  aceptado:   "bg-blue-500/10 text-blue-500 border-blue-500/20",
  en_camino:  "bg-primary/10 text-primary border-primary/20",
  entregado:  "bg-accent/10 text-accent border-accent/20",
  cancelado:  "bg-destructive/10 text-destructive border-destructive/20",
};

const Operations = () => {
  const queryClient = useQueryClient();

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ["operations-deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("*, driver:driver_profiles(profiles(full_name))")
        .order("created_at", { ascending: false }) as any;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 10000,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["operations-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_profiles")
        .select("*, profiles(full_name)") as any;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 10000,
  });

  const active    = deliveries.filter((d: any) => ["aceptado", "en_camino"].includes(d.status));
  const pending   = deliveries.filter((d: any) => d.status === "pendiente");
  const completed = deliveries.filter((d: any) => d.status === "entregado");
  const cancelled = deliveries.filter((d: any) => d.status === "cancelado");
  const activeDrivers = drivers.filter((d: any) => ["activo", "en_ruta"].includes(d.status));

  // Tiempo promedio de entrega (pedidos entregados con delivered_at)
  const avgTime = (() => {
    const withTime = deliveries.filter((d: any) => d.status === "entregado" && d.accepted_at && d.delivered_at);
    if (!withTime.length) return null;
    const avg = withTime.reduce((sum: number, d: any) => {
      return sum + (new Date(d.delivered_at).getTime() - new Date(d.accepted_at).getTime()) / 60000;
    }, 0) / withTime.length;
    return Math.round(avg);
  })();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Operaciones en Vivo</h1>
            <p className="text-sm text-muted-foreground">Monitoreo en tiempo real · actualización cada 10s</p>
          </div>
          <button
            onClick={() => queryClient.invalidateQueries()}
            className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Actualizar
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KPICard title="En Curso"          value={active.length}        icon={<Truck className="h-5 w-5" />}       variant="primary" />
          <KPICard title="Pendientes"         value={pending.length}       icon={<Clock className="h-5 w-5" />}       variant="warning" />
          <KPICard title="Finalizados"        value={completed.length}     icon={<CheckCircle className="h-5 w-5" />} variant="success" />
          <KPICard title="Cancelados"         value={cancelled.length}     icon={<XCircle className="h-5 w-5" />}     variant="danger" />
          <KPICard
            title="Repartidores Activos"
            value={activeDrivers.length}
            icon={<MapPin className="h-5 w-5" />}
            variant="primary"
            subtitle={avgTime ? `Tiempo promedio: ${avgTime} min` : undefined}
          />
        </div>

        {/* Mapa real con LiveMap */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" /> Mapa de Operaciones en Vivo
          </h3>
          <LiveMap
            height="420px"
            showDrivers={true}
            showDeliveries={true}
          />
        </motion.div>

        {/* Entregas activas + pendientes */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">
              Entregas Activas ({active.length})
            </h3>
            {isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : active.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Sin entregas activas</p>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {active.map((d: any) => (
                  <div key={d.id} className={`flex items-center justify-between rounded-lg border p-3 ${statusColors[d.status]}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">#{d.order_id}</p>
                      <p className="text-xs opacity-70 truncate">
                        {d.driver?.profiles?.full_name || "Sin asignar"}
                      </p>
                      <p className="text-xs opacity-60 flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 shrink-0" /> {d.delivery_address}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <span className="text-xs font-bold capitalize">{d.status.replace("_", " ")}</span>
                      <p className="text-xs opacity-60 mt-0.5">{formatCurrency(Number(d.amount || 0))}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">
              Pedidos Pendientes ({pending.length})
            </h3>
            {pending.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <CheckCircle className="h-8 w-8 text-accent/40" />
                <p className="text-sm text-muted-foreground">Todo despachado</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {pending.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg bg-yellow-500/5 border border-yellow-500/20 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">#{d.order_id}</p>
                      <p className="text-xs text-muted-foreground truncate">{d.customer_name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 text-yellow-500 shrink-0" /> {d.pickup_address}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <span className="text-xs font-bold text-yellow-500">pendiente</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(Number(d.amount || 0))}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {new Date(d.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Tabla de repartidores */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Estado de Repartidores</h3>
          {drivers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin repartidores registrados</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                    <th className="pb-3 pr-4">Repartidor</th>
                    <th className="pb-3 pr-4">Estado</th>
                    <th className="pb-3 pr-4">Zona</th>
                    <th className="pb-3 pr-4">Carga</th>
                    <th className="pb-3">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {(drivers as any[]).map((d: any) => (
                    <tr key={d.id} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="py-3 pr-4 font-medium text-foreground">
                        {d.profiles?.full_name || "Sin nombre"}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${statusColors[d.status] || "bg-muted text-muted-foreground border-border"}`}>
                          {d.status || "inactivo"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{d.zone || "—"}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{d.current_load || 0} pedidos</td>
                      <td className="py-3 text-amber-500">⭐ {d.rating || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default Operations;
