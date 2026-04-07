import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle, Clock, Truck, Package, XCircle, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const eventIcons: Record<string, JSX.Element> = {
  pendiente:   <Clock className="h-4 w-4 text-warning" />,
  aceptado:    <Package className="h-4 w-4 text-primary" />,
  en_camino:   <Truck className="h-4 w-4 text-accent" />,
  entregado:   <CheckCircle className="h-4 w-4 text-success" />,
  cancelado:   <XCircle className="h-4 w-4 text-destructive" />,
};

const iconForEvent = (event: string) => {
  if (event.toLowerCase().includes("entregado")) return eventIcons["entregado"];
  if (event.toLowerCase().includes("camino"))    return eventIcons["en_camino"];
  if (event.toLowerCase().includes("aceptado"))  return eventIcons["aceptado"];
  if (event.toLowerCase().includes("cancelado")) return eventIcons["cancelado"];
  return eventIcons["pendiente"];
};

const Audit = () => {
  const queryClient = useQueryClient();

  // BUG FIX: usar delivery_audit_log en lugar de deliveries
  const { data: logs = [], isLoading } = useQuery<any[]>({
    queryKey: ["audit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_audit_log")
        .select("id, delivery_id, event, details, performed_by, created_at, deliveries (order_id)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval: 15000,
  });

  // Agrupar logs por delivery_id
  const grouped = logs.reduce((acc: Record<string, any[]>, log: any) => {
    const key = log.delivery_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(log);
    return acc;
  }, {});

  const deliveryGroups = Object.entries(grouped);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Registro de Auditoría</h1>
            <p className="text-sm text-muted-foreground">
              Trazabilidad completa desde <code className="text-xs bg-muted px-1 rounded">delivery_audit_log</code>
              {" "}— {logs.length} eventos registrados
            </p>
          </div>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["audit-log"] })}
            className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Actualizar
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-10">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : deliveryGroups.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold text-foreground">Sin eventos registrados</h3>
            <p className="text-sm text-muted-foreground">
              Los eventos aparecerán aquí cuando los mensajeros acepten y completen pedidos.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {deliveryGroups.map(([deliveryId, events]) => {
              const orderId = (events[0] as any)?.deliveries?.order_id || deliveryId.slice(0, 8);
              return (
                <motion.div
                  key={deliveryId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="glass-card p-5"
                >
                  <h3 className="mb-4 text-sm font-semibold text-foreground">
                    Pedido {orderId}
                  </h3>
                  <div className="relative ml-3 border-l-2 border-border/50 pl-6 space-y-4">
                    {events.map((e: any) => (
                      <div key={e.id} className="relative">
                        <div className="absolute -left-[31px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-card border border-border">
                          {iconForEvent(e.event)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground">{e.event}</p>
                            <span className="text-xs text-muted-foreground">
                              {new Date(e.created_at).toLocaleString("es-CO")}
                            </span>
                          </div>
                          {e.details && (
                            <p className="text-xs text-muted-foreground">{e.details}</p>
                          )}
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
