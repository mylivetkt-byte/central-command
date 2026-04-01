import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle, Clock, Truck, Package, XCircle } from "lucide-react";

const eventIcons: Record<string, JSX.Element> = {
  pendiente: <Clock className="h-4 w-4 text-warning" />,
  aceptado: <Package className="h-4 w-4 text-primary" />,
  en_camino: <Truck className="h-4 w-4 text-accent" />,
  entregado: <CheckCircle className="h-4 w-4 text-success" />,
  cancelado: <XCircle className="h-4 w-4 text-destructive" />,
};

const Audit = () => {
  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ["audit-deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("id, order_id, status, created_at, updated_at, accepted_at")
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Registro de Auditoría</h1>
          <p className="text-sm text-muted-foreground">Trazabilidad de cambios de estado recientes</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-10"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent flex rounded-full" /></div>
        ) : (
          <div className="space-y-6">
            {deliveries.map((delivery: any) => {
              const events = [];
              events.push({ event: "Pedido actualizado a " + delivery.status, timestamp: delivery.updated_at, icon: delivery.status, details: "Sistema / Último estado" });
              if (delivery.accepted_at) {
                events.push({ event: "Pedido aceptado por mensajero", timestamp: delivery.accepted_at, icon: "aceptado", details: "El mensajero se dirige al lugar" });
              }
              events.push({ event: "Pedido creado en el sistema", timestamp: delivery.created_at, icon: "pendiente", details: "Despacho central" });

              return (
                <motion.div key={delivery.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
                  <h3 className="mb-4 text-sm font-semibold text-foreground">Pedido {delivery.order_id}</h3>
                  <div className="relative ml-3 border-l-2 border-border/50 pl-6 space-y-4">
                    {events.map((e, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[31px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-card border border-border">
                          {eventIcons[e.icon] || <Clock className="h-3 w-3 text-muted-foreground" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{e.event}</p>
                            <span className="text-xs text-muted-foreground">{new Date(e.timestamp).toLocaleString("es-CO")}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{e.details}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Audit;
