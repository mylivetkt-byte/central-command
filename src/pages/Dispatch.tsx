import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Zap, MapPin, Package, Plus, X, Send, UserCheck, Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

const statusColors: Record<string, string> = {
  pendiente: "bg-yellow-500/10 text-yellow-500",
  aceptado: "bg-blue-500/10 text-blue-500",
  en_camino: "bg-primary/10 text-primary",
  entregado: "bg-accent/10 text-accent",
  cancelado: "bg-destructive/10 text-destructive",
};

interface NewDeliveryForm {
  customer_name: string;
  customer_phone: string;
  pickup_address: string;
  delivery_address: string;
  amount: string;
  commission: string;
  estimated_time: string;
  zone: string;
  notes: string;
}

const emptyForm: NewDeliveryForm = {
  customer_name: "",
  customer_phone: "",
  pickup_address: "",
  delivery_address: "",
  amount: "",
  commission: "",
  estimated_time: "30",
  zone: "",
  notes: "",
};

const Dispatch = () => {
  const [showNewForm, setShowNewForm] = useState(false);
  const [form, setForm] = useState<NewDeliveryForm>(emptyForm);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Pedidos pendientes reales
  const { data: pending = [], isLoading: loadingPending } = useQuery({
    queryKey: ["dispatch-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("*")
        .in("status", ["pendiente", "aceptado", "en_camino"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 10000,
  });

  // Repartidores disponibles reales
  const { data: availableDrivers = [], isLoading: loadingDrivers } = useQuery({
    queryKey: ["dispatch-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_profiles")
        .select(`id, status, current_load, zone, rating, profiles (full_name)`)
        .eq("status", "activo")
        .order("current_load", { ascending: true }) as any;
      if (error) throw error;
      return (data as any) || [];
    },
    refetchInterval: 10000,
  });

  // Crear nuevo servicio/pedido
  const createDelivery = useMutation({
    mutationFn: async (formData: NewDeliveryForm) => {
      const orderId = `DOM-${Date.now().toString().slice(-6)}`;
      const { error } = await supabase.from("deliveries").insert({
        order_id: orderId,
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone || null,
        pickup_address: formData.pickup_address,
        delivery_address: formData.delivery_address,
        amount: parseFloat(formData.amount) || 0,
        commission: parseFloat(formData.commission) || 0,
        estimated_time: parseInt(formData.estimated_time) || 30,
        zone: formData.zone || null,
        notes: formData.notes || null,
        status: "pendiente",
      });
      if (error) throw error;
      return orderId;
    },
    onSuccess: (orderId) => {
      toast.success(`✅ Servicio ${orderId} publicado`, {
        description: "Los mensajeros disponibles recibirán la notificación.",
      });
      setForm(emptyForm);
      setShowNewForm(false);
      queryClient.invalidateQueries({ queryKey: ["dispatch-pending"] });
    },
    onError: (err: any) => toast.error(`Error al crear servicio: ${err.message}`),
  });

  // Asignar pedido manualmente a un repartidor
  const assignDriver = useMutation({
    mutationFn: async ({ deliveryId, driverId }: { deliveryId: string; driverId: string }) => {
      const { error } = await supabase
        .from("deliveries")
        .update({
          driver_id: driverId,
          status: "aceptado",
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", deliveryId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido asignado al repartidor");
      setSelectedOrder(null);
      queryClient.invalidateQueries({ queryKey: ["dispatch-pending"] });
      queryClient.invalidateQueries({ queryKey: ["dispatch-drivers"] });
    },
    onError: () => toast.error("Error al asignar pedido"),
  });

  // Cancelar pedido
  const cancelDelivery = useMutation({
    mutationFn: async (deliveryId: string) => {
      const { error } = await supabase
        .from("deliveries")
        .update({ status: "cancelado", updated_at: new Date().toISOString() })
        .eq("id", deliveryId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido cancelado");
      queryClient.invalidateQueries({ queryKey: ["dispatch-pending"] });
    },
    onError: () => toast.error("Error al cancelar pedido"),
  });

  const handleFormChange = (field: keyof NewDeliveryForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name || !form.pickup_address || !form.delivery_address) {
      toast.error("Completa los campos obligatorios");
      return;
    }
    createDelivery.mutate(form);
  };

  const selectedDelivery = pending.find((d: any) => d.id === selectedOrder);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Despacho de Servicios</h1>
            <p className="text-sm text-muted-foreground">
              Crea y asigna pedidos a los mensajeros en tiempo real
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => queryClient.invalidateQueries()}
              className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setShowNewForm(true)}
              className="flex items-center gap-2 rounded-lg bg-gradient-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" /> Publicar Servicio
            </button>
          </div>
        </div>

        {/* Stats rápidas */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Pendientes", value: pending.filter((d: any) => d.status === "pendiente").length, color: "text-yellow-500" },
            { label: "Aceptados", value: pending.filter((d: any) => d.status === "aceptado").length, color: "text-blue-500" },
            { label: "En Camino", value: pending.filter((d: any) => d.status === "en_camino").length, color: "text-primary" },
            { label: "Mensajeros disponibles", value: availableDrivers.length, color: "text-accent" },
          ].map((s) => (
            <div key={s.label} className="glass-card p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Formulario nuevo servicio */}
        <AnimatePresence>
          {showNewForm && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass-card p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <Send className="h-4 w-4 text-primary" />
                  Nuevo Servicio de Domicilio
                </h3>
                <button onClick={() => setShowNewForm(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium">Cliente *</label>
                  <input
                    value={form.customer_name}
                    onChange={(e) => handleFormChange("customer_name", e.target.value)}
                    placeholder="Nombre del cliente"
                    required
                    className="w-full rounded-lg bg-muted/50 border border-border/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium">Teléfono del cliente</label>
                  <input
                    value={form.customer_phone}
                    onChange={(e) => handleFormChange("customer_phone", e.target.value)}
                    placeholder="+57 300 000 0000"
                    className="w-full rounded-lg bg-muted/50 border border-border/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium">Dirección de Recogida *</label>
                  <input
                    value={form.pickup_address}
                    onChange={(e) => handleFormChange("pickup_address", e.target.value)}
                    placeholder="Ej: Cra 27 #45-10, Bucaramanga"
                    required
                    className="w-full rounded-lg bg-muted/50 border border-border/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium">Dirección de Entrega *</label>
                  <input
                    value={form.delivery_address}
                    onChange={(e) => handleFormChange("delivery_address", e.target.value)}
                    placeholder="Ej: Cll 48 #29-15, Bucaramanga"
                    required
                    className="w-full rounded-lg bg-muted/50 border border-border/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium">Valor del pedido (COP)</label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => handleFormChange("amount", e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg bg-muted/50 border border-border/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium">Comisión mensajero (COP)</label>
                  <input
                    type="number"
                    value={form.commission}
                    onChange={(e) => handleFormChange("commission", e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg bg-muted/50 border border-border/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium">Tiempo estimado (min)</label>
                  <input
                    type="number"
                    value={form.estimated_time}
                    onChange={(e) => handleFormChange("estimated_time", e.target.value)}
                    className="w-full rounded-lg bg-muted/50 border border-border/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium">Zona</label>
                  <input
                    value={form.zone}
                    onChange={(e) => handleFormChange("zone", e.target.value)}
                    placeholder="Ej: Norte, Centro, Sur"
                    className="w-full rounded-lg bg-muted/50 border border-border/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs text-muted-foreground font-medium">Notas adicionales</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => handleFormChange("notes", e.target.value)}
                    placeholder="Instrucciones especiales para el mensajero..."
                    rows={2}
                    className="w-full rounded-lg bg-muted/50 border border-border/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  />
                </div>

                <div className="sm:col-span-2 flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => { setShowNewForm(false); setForm(emptyForm); }}
                    className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border/50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={createDelivery.isPending}
                    className="flex items-center gap-2 rounded-lg bg-gradient-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {createDelivery.isPending ? "Publicando..." : "Publicar a Mensajeros"}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Panel principal */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Pedidos activos */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground flex items-center gap-2">
              <Package className="h-4 w-4" /> Servicios Activos ({pending.length})
            </h3>
            {loadingPending ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : pending.length === 0 ? (
              <div className="text-center py-10">
                <CheckCircle className="h-10 w-10 text-accent mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Sin servicios activos</p>
                <button
                  onClick={() => setShowNewForm(true)}
                  className="mt-3 text-xs text-primary hover:underline"
                >
                  + Publicar nuevo servicio
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {pending.map((d: any) => (
                  <div
                    key={d.id}
                    onClick={() => setSelectedOrder(selectedOrder === d.id ? null : d.id)}
                    className={`cursor-pointer rounded-lg p-3 transition-colors ${
                      selectedOrder === d.id
                        ? "bg-primary/10 border border-primary/30"
                        : "bg-muted/30 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-foreground">#{d.order_id}</p>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[d.status] || "bg-muted text-muted-foreground"}`}>
                          {d.status}
                        </span>
                        {d.status === "pendiente" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); cancelDelivery.mutate(d.id); }}
                            className="text-destructive/50 hover:text-destructive transition-colors"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-0.5">{d.customer_name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-accent" /> {d.pickup_address}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-primary" /> {d.delivery_address}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {d.estimated_time || "?"} min
                      </span>
                      <span className="text-xs font-semibold text-accent">
                        {formatCurrency(Number(d.commission || 0))}
                      </span>
                    </div>
                    {selectedOrder === d.id && d.status === "pendiente" && (
                      <p className="text-xs text-primary mt-2 font-medium">
                        → Selecciona un mensajero para asignar manualmente
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Mensajeros disponibles */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              {selectedOrder && selectedDelivery?.status === "pendiente"
                ? `Asignar #${selectedDelivery?.order_id} a...`
                : `Mensajeros Disponibles (${availableDrivers.length})`}
            </h3>
            {loadingDrivers ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : availableDrivers.length === 0 ? (
              <div className="text-center py-10">
                <Zap className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Sin mensajeros activos</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Los mensajeros deben activar su estado en la app
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {availableDrivers.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-sm font-bold text-accent">
                        {(d.user?.full_name || "?").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{d.profiles?.full_name || "Sin nombre"}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Package className="h-3 w-3" /> {d.current_load || 0} pedidos · {d.zone || "Sin zona"}
                        </p>
                      </div>
                    </div>
                    {selectedOrder && selectedDelivery?.status === "pendiente" ? (
                      <button
                        onClick={() => assignDriver.mutate({ deliveryId: selectedOrder, driverId: d.id })}
                        disabled={assignDriver.isPending}
                        className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                      >
                        Asignar
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        ⭐ {d.rating || "N/A"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dispatch;
