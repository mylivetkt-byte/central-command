import { DashboardLayout } from "@/components/DashboardLayout";
import { formatCurrency } from "@/data/mockData";
import { motion } from "framer-motion";
import { useState } from "react";
import { Search, UserCheck, UserX, Star, RefreshCw, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  activo: "bg-accent/10 text-accent",
  en_ruta: "bg-primary/10 text-primary",
  inactivo: "bg-muted text-muted-foreground",
  suspendido: "bg-destructive/10 text-destructive",
};

const Drivers = () => {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: drivers = [], isLoading, error, refetch } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_profiles")
        .select(`
          id, status, zone, current_load, rating,
          total_deliveries, acceptance_rate, cancellation_rate, avg_delivery_time,
          profiles ( id, full_name, phone, avatar_url )
        `)
        .order("total_deliveries", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: driverDeliveries = [] } = useQuery({
    queryKey: ["driver-deliveries", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("id, order_id, delivery_address, status, amount, created_at")
        .eq("driver_id", selected!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const changeStatus = useMutation({
    mutationFn: async ({ driverId, newStatus }: { driverId: string; newStatus: string }) => {
      const { error } = await supabase
        .from("driver_profiles")
        .update({ status: newStatus as any })
        .eq("id", driverId);
      if (error) throw error;
    },
    onSuccess: (_, { newStatus }) => {
      toast.success(`Repartidor ${newStatus === "activo" ? "activado" : "suspendido"} correctamente`);
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
    },
    onError: () => toast.error("No se pudo cambiar el estado"),
  });

  const filtered = drivers.filter(d =>
    (d.profiles?.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (d.zone ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const selectedDriver = drivers.find(d => d.id === selected);
  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestión de Repartidores</h1>
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Cargando..." : `${drivers.length} repartidores registrados`}
            </p>
          </div>
          <button onClick={() => refetch()} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">
            <RefreshCw className="h-4 w-4" /> Actualizar
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-4 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Error al cargar repartidores. Verifica la conexión con Supabase.
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar repartidor..."
                className="w-full rounded-lg bg-muted/50 border border-border/50 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            {isLoading ? (
              <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-16 rounded-lg bg-muted/30 animate-pulse" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="glass-card p-6 text-center">
                <p className="text-sm text-muted-foreground">{search ? "Sin resultados" : "No hay repartidores registrados aún"}</p>
                {!search && <p className="text-xs text-muted-foreground mt-2">Los repartidores se registran en /driver-login</p>}
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filtered.map(d => (
                  <motion.button key={d.id} onClick={() => setSelected(d.id)} whileHover={{ scale: 1.01 }}
                    className={`w-full rounded-lg p-3 text-left transition-colors ${selected === d.id ? "bg-primary/10 border border-primary/30" : "glass-card hover:bg-muted/50"}`}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                        {getInitials(d.profiles?.full_name ?? "?")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{d.profiles?.full_name ?? "Sin nombre"}</p>
                        <p className="text-xs text-muted-foreground">{d.zone ?? "Sin zona"} · {d.total_deliveries} entregas</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${statusColors[d.status]}`}>
                        {d.status.replace("_", " ")}
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            {!selectedDriver ? (
              <div className="glass-card flex h-full items-center justify-center p-10">
                <p className="text-sm text-muted-foreground">Selecciona un repartidor para ver su perfil</p>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="glass-card p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 text-xl font-bold text-primary">
                      {getInitials(selectedDriver.profiles?.full_name ?? "?")}
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-bold text-foreground">{selectedDriver.profiles?.full_name ?? "Sin nombre"}</h2>
                      <p className="text-sm text-muted-foreground">{selectedDriver.profiles?.phone ?? "Sin teléfono"}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[selectedDriver.status]}`}>{selectedDriver.status}</span>
                        <span className="flex items-center gap-1 text-xs text-warning"><Star className="h-3 w-3" />{selectedDriver.rating?.toFixed(1) ?? "0.0"}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => changeStatus.mutate({ driverId: selectedDriver.id, newStatus: "activo" })}
                        disabled={selectedDriver.status === "activo" || changeStatus.isPending}
                        className="flex items-center gap-1 rounded-lg bg-accent/10 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        <UserCheck className="h-3 w-3" /> Activar
                      </button>
                      <button onClick={() => changeStatus.mutate({ driverId: selectedDriver.id, newStatus: "suspendido" })}
                        disabled={selectedDriver.status === "suspendido" || changeStatus.isPending}
                        className="flex items-center gap-1 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        <UserX className="h-3 w-3" /> Suspender
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[
                      { label: "Entregas", value: selectedDriver.total_deliveries },
                      { label: "Tiempo Prom.", value: `${selectedDriver.avg_delivery_time ?? 0} min` },
                      { label: "Aceptación", value: `${selectedDriver.acceptance_rate?.toFixed(1) ?? 0}%` },
                      { label: "Cancelación", value: `${selectedDriver.cancellation_rate?.toFixed(1) ?? 0}%` },
                      { label: "Carga Actual", value: `${selectedDriver.current_load} pedidos` },
                      { label: "Zona", value: selectedDriver.zone ?? "Sin asignar" },
                      { label: "Calificación", value: `${selectedDriver.rating?.toFixed(1) ?? "0.0"} ★` },
                      { label: "Estado", value: selectedDriver.status },
                    ].map(m => (
                      <div key={m.label} className="rounded-lg bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">{m.label}</p>
                        <p className="text-sm font-semibold text-foreground">{m.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="glass-card p-5">
                  <h3 className="mb-3 text-sm font-semibold text-foreground">Historial de Pedidos</h3>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {driverDeliveries.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin pedidos registrados</p>
                    ) : driverDeliveries.map(d => (
                      <div key={d.id} className="flex items-center justify-between rounded-lg bg-muted/20 p-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">#{d.order_id}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{d.delivery_address}</p>
                        </div>
                        <div className="text-right">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            d.status === "entregado" ? "bg-accent/10 text-accent" :
                            d.status === "cancelado" ? "bg-destructive/10 text-destructive" :
                            d.status === "en_camino" ? "bg-primary/10 text-primary" :
                            "bg-muted text-muted-foreground"}`}>{d.status}</span>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(d.amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Drivers;
