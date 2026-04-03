import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { Search, UserCheck, UserX, Star, Phone, Package, RefreshCw, Plus, Edit2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@supabase/supabase-js";

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
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingDriver, setEditingDriver] = useState<any>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    zone: "",
  });
  
  const queryClient = useQueryClient();

  // Cargar repartidores reales desde Supabase
  const { data: drivers = [], isLoading, error: driversError } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      // Step 1: load all driver_profiles
      const { data: dps, error: dpError } = await (supabase.from("driver_profiles") as any)
        .select("id, status, total_deliveries, rating, acceptance_rate, cancellation_rate, current_load, zone");
      if (dpError) throw dpError;
      if (!dps || dps.length === 0) return [];

      // Step 2: load the corresponding profiles (name, email, phone)
      const ids = (dps as any[]).map((d) => d.id);
      const { data: profs, error: profError } = await (supabase.from("profiles") as any)
        .select("id, full_name, phone")
        .in("id", ids);
      if (profError) throw profError;

      // Step 3: merge
      const profileMap = Object.fromEntries(((profs as any[]) || []).map((p) => [p.id, p]));
      return (dps as any[]).map((d) => ({ ...d, profile: profileMap[d.id] ?? null }));
    },
  });

  // Cargar pedidos del repartidor seleccionado
  const { data: driverDeliveries = [] } = useQuery({
    queryKey: ["driver-deliveries", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await (supabase.from("deliveries") as any)
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
      const { error } = await (supabase.from("driver_profiles") as any)
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

  const saveDriver = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (isEditing) {
        const { error: profileError } = await (supabase.from("profiles") as any)
          .update({ full_name: data.full_name, phone: data.phone })
          .eq("id", editingDriver.id);
        if (profileError) throw profileError;

        const { error: driverError } = await (supabase.from("driver_profiles") as any)
          .update({ zone: data.zone })
          .eq("id", editingDriver.id);
        if (driverError) throw driverError;
      } else {
        // Use a secondary client so admin session is NOT overwritten
        const tempClient = createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          { auth: { persistSession: false, autoRefreshToken: false } }
        );

        const { data: signUpData, error: signUpError } = await tempClient.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: { full_name: data.full_name, phone: data.phone, role: "driver" },
          },
        });

        if (signUpError) throw signUpError;

        // If email confirmation is enabled, the user exists but identities may be empty.
        // The trigger handle_new_user_role still fires and creates driver_profiles.
        // We show a helpful message instead of silently succeeding.
        const needsConfirmation =
          signUpData?.user && signUpData.user.identities?.length === 0;
        if (needsConfirmation) {
          throw new Error(
            "El correo ya está registrado o requiere confirmación. Revisa la bandeja de entrada del repartidor."
          );
        }
      }
    },
    onSuccess: () => {
      toast.success(
        isEditing
          ? "Conductor actualizado correctamente"
          : "Conductor creado. Si Supabase pide confirmación de email, el repartidor debe confirmar antes de entrar."
      );
      setShowForm(false);
      setIsEditing(false);
      setEditingDriver(null);
      setFormData({ full_name: "", email: "", password: "", phone: "", zone: "" });
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
    },
    onError: (err: any) => toast.error(`Error: ${err.message}`),
  });

  const deleteDriver = useMutation({
    mutationFn: async (driverId: string) => {
      // Soft-delete mechanism: remove from driver_profiles, which cascades or removes their access
      const { error: rolesError } = await (supabase.from("user_roles") as any).delete().eq("user_id", driverId);
      if (rolesError) throw rolesError;
      
      const { error: driverError } = await (supabase.from("driver_profiles") as any).delete().eq("id", driverId);
      if (driverError) throw driverError;
      
      const { error: profileError } = await (supabase.from("profiles") as any).delete().eq("id", driverId);
      if (profileError) throw profileError;
    },
    onSuccess: () => {
      toast.success("Conductor eliminado (oculto) del sistema");
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
    },
    onError: (err: any) => toast.error(`Error al eliminar: ${err.message}`),
  });

  const filtered = drivers.filter((d: any) =>
    (d.profile?.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.profile?.phone || "").includes(search)
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
              {driversError && <span className="text-destructive ml-2">Error al cargar: {(driversError as any).message}</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ["drivers"] })}
              className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Actualizar
            </button>
            <button
              onClick={() => { setFormData({ full_name: "", email: "", password: "", phone: "", zone: "" });
                setIsEditing(false);
                setShowForm(true);
              }}
              className="flex items-center gap-2 rounded-lg bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" /> Nuevo Repartidor
            </button>
          </div>
        </div>

        {/* Modal / Formulario Flotante */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card w-full max-w-lg p-6 relative">
              <button 
                onClick={() => setShowForm(false)}
                className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
              <h2 className="text-xl font-bold mb-4">{isEditing ? "Editar Repartidor" : "Nuevo Repartidor"}</h2>
              <form onSubmit={(e) => { e.preventDefault(); saveDriver.mutate(formData); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">Nombre Completo *</label>
                    <input required value={formData.full_name} onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))} className="w-full rounded-lg bg-muted/50 border border-border/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">Teléfono</label>
                    <input value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} className="w-full rounded-lg bg-muted/50 border border-border/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                  {!isEditing && (
                    <>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium">Email *</label>
                        <input type="email" required value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} className="w-full rounded-lg bg-muted/50 border border-border/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium">Contraseña *</label>
                        <input type="password" required minLength={6} value={formData.password} onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} className="w-full rounded-lg bg-muted/50 border border-border/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                      </div>
                    </>
                  )}
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">Zona Asignada</label>
                    <input value={formData.zone} onChange={e => setFormData(p => ({ ...p, zone: e.target.value }))} placeholder="Ej: Norte" className="w-full rounded-lg bg-muted/50 border border-border/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted-foreground rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">Cancelar</button>
                  <button type="submit" disabled={saveDriver.isPending} className="px-5 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50">
                    {saveDriver.isPending ? "Guardando..." : "Guardar Repartidor"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

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
                        {getInitials(d.profile?.full_name || "?")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {d.profile?.full_name || "Sin nombre"}
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
                        {getInitials(selectedDriver.profile?.full_name || "?")}
                      </div>
                      <div className="flex-1">
                        <h2 className="text-lg font-bold text-foreground">
                          {selectedDriver.profile?.full_name || "Sin nombre"}
                        </h2>
                        {selectedDriver.profile?.phone && (
                          <a href={`tel:${selectedDriver.profile.phone}`} className="inline-flex items-center justify-center gap-1 rounded bg-muted/50 px-2 py-0.5 text-xs text-primary">
                            <Phone className="h-3 w-3" /> {selectedDriver.profile.phone}
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
                        
                        <div className="w-px h-8 bg-border/50 mx-1"></div>
                        
                        <button
                          onClick={() => {
                            setFormData({
                              full_name: selectedDriver.profile?.full_name || "",
                              email: "",
                              password: "",
                              phone: selectedDriver.profile?.phone || "",
                              zone: selectedDriver.zone || "",
                            });
                            setEditingDriver(selectedDriver);
                            setIsEditing(true);
                            setShowForm(true);
                          }}
                          className="flex items-center gap-1 rounded-lg bg-muted px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/80 transition-colors"
                        >
                          <Edit2 className="h-3 w-3" /> Editar
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm("¿Seguro que deseas eliminar este repartidor?")) {
                              deleteDriver.mutate(selectedDriver.id);
                            }
                          }}
                          disabled={deleteDriver.isPending}
                          className="flex items-center gap-1 rounded-lg border border-destructive/20 bg-transparent px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/5 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" /> Eliminar
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
