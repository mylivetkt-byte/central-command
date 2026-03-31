import { DashboardLayout } from "@/components/DashboardLayout";
import { drivers, deliveries, formatCurrency } from "@/data/mockData";
import { motion } from "framer-motion";
import { useState } from "react";
import { Search, UserCheck, UserX, Star } from "lucide-react";

const statusColors: Record<string, string> = {
  activo: "bg-accent/10 text-accent",
  en_ruta: "bg-primary/10 text-primary",
  inactivo: "bg-muted text-muted-foreground",
  suspendido: "bg-destructive/10 text-destructive",
};

const Drivers = () => {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const filtered = drivers.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
  const selectedDriver = drivers.find(d => d.id === selected);
  const driverDeliveries = selected ? deliveries.filter(d => d.driverId === selected) : [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestión de Repartidores</h1>
          <p className="text-sm text-muted-foreground">Perfiles, métricas y acciones de administración</p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar repartidor..."
                className="w-full rounded-lg bg-muted/50 border border-border/50 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filtered.map(d => (
                <motion.button
                  key={d.id} onClick={() => setSelected(d.id)}
                  whileHover={{ scale: 1.01 }}
                  className={`w-full rounded-lg p-3 text-left transition-colors ${selected === d.id ? "bg-primary/10 border border-primary/30" : "glass-card hover:bg-muted/50"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">{d.avatar}</div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.zone} · {d.totalDeliveries} entregas</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[d.status]}`}>
                      {d.status.replace("_", " ")}
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2">
            {!selectedDriver ? (
              <div className="glass-card flex h-full items-center justify-center p-10">
                <p className="text-sm text-muted-foreground">Seleccione un repartidor para ver su perfil</p>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="glass-card p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 text-xl font-bold text-primary">{selectedDriver.avatar}</div>
                    <div className="flex-1">
                      <h2 className="text-lg font-bold text-foreground">{selectedDriver.name}</h2>
                      <p className="text-sm text-muted-foreground">{selectedDriver.id} · {selectedDriver.phone}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[selectedDriver.status]}`}>{selectedDriver.status}</span>
                        <span className="flex items-center gap-1 text-xs text-warning"><Star className="h-3 w-3" /> {selectedDriver.rating}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="flex items-center gap-1 rounded-lg bg-accent/10 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/20 transition-colors">
                        <UserCheck className="h-3 w-3" /> Activar
                      </button>
                      <button className="flex items-center gap-1 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors">
                        <UserX className="h-3 w-3" /> Suspender
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[
                      { label: "Entregas", value: selectedDriver.totalDeliveries },
                      { label: "Tiempo Prom.", value: `${selectedDriver.avgDeliveryTime} min` },
                      { label: "Aceptación", value: `${selectedDriver.acceptanceRate}%` },
                      { label: "Cancelación", value: `${selectedDriver.cancellationRate}%` },
                      { label: "Ingresos", value: formatCurrency(selectedDriver.revenue) },
                      { label: "Comisión", value: formatCurrency(selectedDriver.commission) },
                      { label: "Carga Actual", value: `${selectedDriver.currentLoad} pedidos` },
                      { label: "Zona", value: selectedDriver.zone },
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
                    {driverDeliveries.length === 0 && <p className="text-sm text-muted-foreground">Sin pedidos registrados</p>}
                    {driverDeliveries.map(d => (
                      <div key={d.id} className="flex items-center justify-between rounded-lg bg-muted/20 p-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{d.orderId}</p>
                          <p className="text-xs text-muted-foreground">{d.deliveryAddress}</p>
                        </div>
                        <div className="text-right">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            d.status === "entregado" ? "bg-accent/10 text-accent" :
                            d.status === "cancelado" ? "bg-destructive/10 text-destructive" :
                            "bg-muted text-muted-foreground"
                          }`}>{d.status}</span>
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
