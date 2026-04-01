import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { Search, UserCheck, UserX, Star, Phone, Package, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  activo: "bg-accent/10 text-accent",
  en_ruta: "bg-primary/10 text-primary",
  inactivo: "bg-muted text-muted-foreground",
  suspendido: "bg-destructive/10 text-destructive",
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

const Drivers = () => {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Cargar repartidores reales desde Supabase
  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_profiles")
        .select(`
          id,
          status,
          total_deliveries,
          rating,
          acceptance_rate,
          cancellation_rate,
          current_load,
          zone,
          vehicle_type,
          phone,
          profiles (
            full_name,
            email
          )
        `) as any;
      if (error) throw error;
      return (data as any) || [];
    },
  });

  // Cargar pedidos del repartidor seleccionado
  const { data: driverDeliveries = [] } = useQuery({
    queryKey: ["driver-deliveries", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("*")
        .eq("driver_id", selected!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  // Cambiar estado del repartidor
  const updateStatus = useMutation({
    mutationFn: async ({ driverId, status }: { driverId: string; status: any }) => {
      const { error } = await supabase
        .from("driver_profiles")
        .update({ status })
        .eq("id", driverId);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      toast.success(`Estado actualizado a: ${status}`);
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
    },
    onError: () => toast.error("Error al actualizar estado"),
  });

  const filtered = drivers.filter((d: any) =>
    (d.profiles?.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.phone || "").includes(search)
  );

  const selectedDriver = drivers.find((d: any) => d.id === selected);

  const getInitials = (name: string) =>
    name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "??";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestión de Repartidores</h1>
            <p className="text-sm text-muted-foreground">
              Perfiles reales, métricas y acciones de administración ({drivers.length} registrados)
            </p>
          </div>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["drivers"] })}
            className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Actualizar
          </button>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : drivers.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold text-foreground mb-1">Sin repartidores registrados</h3>
            <p className="text-sm text-muted-foreground">
              Los mensajeros deben registrarse en la app de mensajero y tener el rol "driver" asignado.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Lista de repartidores */}
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre o teléfono..."
                  className="w-full rounded-lg bg-muted/50 border border-border/50 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filtered.map((d: any) => (
                  <motion.button
                    key={d.id}
                    onClick={() => setSelected(d.id)}
                    whileHover={{ scale: 1.01 }}
                    className={`w-full rounded-lg p-3 text-left transition-colors ${
                      selected === d.id ? "bg-primary/10 border border-primary/30" : "glass-card hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary shrink-0">
                        {getInitials(d.profiles?.full_name || "?")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {d.profiles?.full_name || "Sin nombre"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {d.zone || "Sin zona"} · {d.total_deliveries || 0} entregas
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${statusColors[d.status] || "bg-muted text-muted-foreground"}`}>
                        {d.status || "inactivo"}
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Detalle del repartidor */}
            <div className="lg:col-span-2">
              {!selectedDriver ? (
                <div className="glass-card flex h-full items-center justify-center p-10">
                  <p className="text-sm text-muted-foreground">Seleccione un repartidor para ver su perfil</p>
                </div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div className="glass-card p-6">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 text-xl font-bold text-primary">
                        {getInitials(selectedDriver.profiles?.full_name || "?")}
                      </div>
                      <div className="flex-1">
                        <h2 className="text-lg font-bold text-foreground">
                          {selectedDriver.profiles?.full_name || "Sin nombre"}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          {/* Email removed as it's not in public.profiles */}
                        </p>
                        {selectedDriver.phone && (
                          <a href={`tel:${selectedDriver.phone}`} className="flex items-center gap-1 text-xs text-primary mt-1">
                            <Phone className="h-3 w-3" /> {selectedDriver.phone}
                          </a>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[selectedDriver.status] || "bg-muted text-muted-foreground"}`}>
                            {selectedDriver.status || "inactivo"}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-yellow-500">
                            <Star className="h-3 w-3" /> {selectedDriver.rating || "N/A"}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateStatus.mutate({ driverId: selectedDriver.id, status: "activo" })}
                          disabled={updateStatus.isPending}
                          className="flex items-center gap-1 rounded-lg bg-accent/10 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/20 transition-colors"
                        >
                          <UserCheck className="h-3 w-3" /> Activar
                        </button>
                        <button
                          onClick={() => updateStatus.mutate({ driverId: selectedDriver.id, status: "suspendido" })}
                          disabled={updateStatus.isPending}
                          className="flex items-center gap-1 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors"
                        >
                          <UserX className="h-3 w-3" /> Suspender
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      {[
                        { label: "Entregas", value: selectedDriver.total_deliveries || 0 },
                        { label: "Rating", value: selectedDriver.rating || "N/A" },
                        { label: "Aceptación", value: `${selectedDriver.acceptance_rate || 0}%` },
                        { label: "Cancelación", value: `${selectedDriver.cancellation_rate || 0}%` },
                        { label: "Carga Actual", value: `${selectedDriver.current_load || 0} pedidos` },
                        { label: "Zona", value: selectedDriver.zone || "Sin zona" },
                        { label: "Vehículo", value: selectedDriver.vehicle_type || "N/A" },
                        { label: "Estado", value: selectedDriver.status || "inactivo" },
                      ].map((m) => (
                        <div key={m.label} className="rounded-lg bg-muted/30 p-3">
                          <p className="text-xs text-muted-foreground">{m.label}</p>
                          <p className="text-sm font-semibold text-foreground">{m.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="glass-card p-5">
                    <h3 className="mb-3 text-sm font-semibold text-foreground">
                      Historial de Pedidos ({driverDeliveries.length})
                    </h3>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {driverDeliveries.length === 0 && (
                        <p className="text-sm text-muted-foreground">Sin pedidos registrados</p>
                      )}
                      {driverDeliveries.map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between rounded-lg bg-muted/20 p-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">#{d.order_id}</p>
                            <p className="text-xs text-muted-foreground">{d.delivery_address}</p>
                          </div>
                          <div className="text-right">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              d.status === "entregado" ? "bg-accent/10 text-accent" :
                              d.status === "cancelado" ? "bg-destructive/10 text-destructive" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              {d.status}
                            </span>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatCurrency(Number(d.amount || 0))}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Drivers;
