import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Building2, Users, Package, DollarSign, ArrowLeft, Edit2, Power, Trash2, AlertTriangle, RefreshCw, Mail, Phone, Calendar, MapPin, Check, Plus, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

const planLabels: Record<string, string> = {
  basico: "Básico",
  profesional: "Profesional",
  enterprise: "Enterprise",
};

const SaaSCompanyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const { switchCompany } = useCompany();
  const queryClient = useQueryClient();
  const [showReset, setShowReset] = useState(false);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [adminForm, setAdminForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
  });

  useEffect(() => {
    if (role !== null && role !== "super_admin") navigate("/saas/login", { replace: true });
  }, [role, navigate]);

  const { data: company, isLoading } = useQuery({
    queryKey: ["saas-company", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saas_companies")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["saas-company-users", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_users")
        .select("*, auth:user_id(email)")
        .eq("company_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: stats = { deliveries: 0, drivers: 0, revenue: 0 } } = useQuery({
    queryKey: ["saas-company-stats", id],
    enabled: !!id,
    queryFn: async () => {
      const { count: deliveries } = await supabase
        .from("deliveries")
        .select("*", { count: "exact", head: true })
        .eq("company_id", id!);
      const { count: drivers } = await supabase
        .from("driver_profiles")
        .select("*", { count: "exact", head: true })
        .eq("company_id", id!);
      const { data: revenueData } = await supabase
        .from("deliveries")
        .select("amount")
        .eq("company_id", id!)
        .eq("status", "entregado");
      const revenue = (revenueData || []).reduce((s: number, d: any) => s + Number(d.amount || 0), 0);
      return { deliveries: deliveries || 0, drivers: drivers || 0, revenue };
    },
  });

  const updateCompany = useMutation({
    mutationFn: async (fields: any) => {
      const { error } = await supabase
        .from("saas_companies")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saas-company", id] });
      toast.success("Datos de empresa actualizados");
    },
    onError: (err: any) => toast.error("Error al actualizar: " + err.message),
  });
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminForm.email.trim() || !adminForm.password.trim() || !adminForm.fullName.trim()) {
      toast.error("El nombre, correo y contraseña son obligatorios.");
      return;
    }
    setCreatingAdmin(true);
    try {
      const tempClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );

      const { data: signUpData, error: signUpError } = await tempClient.auth.signUp({
        email: adminForm.email.trim(),
        password: adminForm.password.trim(),
        options: {
          data: {
            full_name: adminForm.fullName.trim(),
            phone: adminForm.phone.trim() || null,
            role: "admin",
            company_id: id!,
          },
        },
      });

      if (signUpError) throw signUpError;

      const needsConfirmation = signUpData?.user && signUpData.user.identities?.length === 0;
      if (needsConfirmation) {
        throw new Error("El correo ya está registrado o requiere confirmación.");
      }

      toast.success("Administrador creado correctamente.");
      setShowAddAdmin(false);
      setAdminForm({ fullName: "", email: "", password: "", phone: "" });
      queryClient.invalidateQueries({ queryKey: ["saas-company-users", id] });
    } catch (err: any) {
      toast.error(err.message || "Error al crear administrador");
    } finally {
      setCreatingAdmin(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!company) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <p className="text-lg font-bold">Empresa no encontrada</p>
          <button onClick={() => navigate("/saas/companies")} className="text-sm text-primary hover:underline">Volver</button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <button
          onClick={() => navigate("/saas/companies")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a empresas
        </button>

        {company.status === "pendiente" && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-foreground">Empresa Pendiente de Autorización</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Esta empresa se registró de manera autónoma y requiere aprobación.</p>
              </div>
            </div>
            <button
              onClick={() => updateCompany.mutate({ status: "activa" })}
              disabled={updateCompany.isPending}
              className="flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 text-xs font-bold text-black hover:bg-yellow-400 transition-colors disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> Autorizar y Activar
            </button>
          </motion.div>
        )}

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{company.name}</h1>
              <p className="text-sm text-muted-foreground">{company.nit || "Sin NIT"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                await switchCompany(company.id);
                navigate("/");
              }}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity mr-2"
            >
              <Shield className="h-3.5 w-3.5" /> Ver Central
            </button>
            <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
              company.status === "pendiente" ? "bg-yellow-500/10 text-yellow-500" :
              company.status === "activa" ? "bg-accent/10 text-accent" :
              company.status === "inactiva" ? "bg-muted text-muted-foreground" :
              "bg-destructive/10 text-destructive"
            }`}>
              {company.status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Pedidos</p>
            <p className="text-3xl font-black text-foreground mt-1">{stats.deliveries}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Repartidores</p>
            <p className="text-3xl font-black text-foreground mt-1">{stats.drivers} <span className="text-sm text-muted-foreground font-medium">/ {company.max_drivers}</span></p>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Ingresos</p>
            <p className="text-3xl font-black text-foreground mt-1">{formatCurrency(stats.revenue)}</p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold text-foreground mb-4">Información</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{company.email || "Sin email"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{company.phone || "Sin teléfono"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Creada: {new Date(company.created_at).toLocaleDateString("es-CO")}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span>Plan: {planLabels[company.plan] || company.plan}</span>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-bold text-foreground mb-1">Configuración del Plan</h3>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Tipo de Plan</p>
              <div className="flex gap-2">
                {["basico", "profesional", "enterprise"].map((p) => (
                  <button
                    key={p}
                    onClick={() => updateCompany.mutate({ plan: p })}
                    disabled={updateCompany.isPending}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold transition-all ${
                      company.plan === p
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {planLabels[p]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-2">Valor del Plan (COP)</p>
                <input
                  type="number"
                  defaultValue={company.plan_value || 0}
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val >= 0) {
                      updateCompany.mutate({ plan_value: val });
                    }
                  }}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-bold text-emerald-500"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Límite de repartidores</p>
                <input
                  type="number"
                  defaultValue={company.max_drivers}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value);
                    if (val > 0) {
                      updateCompany.mutate({ max_drivers: val });
                    }
                  }}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-bold"
                />
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">Estado de la Empresa</p>
              <select
                value={company.status}
                onChange={(e) => updateCompany.mutate({ status: e.target.value })}
                disabled={updateCompany.isPending}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-bold capitalize"
              >
                <option value="pendiente">Pendiente</option>
                <option value="activa">Activa</option>
                <option value="inactiva">Inactiva</option>
                <option value="suspendida">Suspendida</option>
              </select>
            </div>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Usuarios de la empresa</h3>
            <button
              onClick={() => setShowAddAdmin(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Plus className="h-3.5 w-3.5" /> Agregar Administrador
            </button>
          </div>

          {showAddAdmin && (
            <form onSubmit={handleAddAdmin} className="border border-border/50 rounded-xl p-4 bg-muted/20 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nuevo Administrador de Empresa</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-bold uppercase">Nombre Completo *</label>
                  <input
                    required
                    value={adminForm.fullName}
                    onChange={(e) => setAdminForm({ ...adminForm, fullName: e.target.value })}
                    className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-bold uppercase">Teléfono</label>
                  <input
                    value={adminForm.phone}
                    onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })}
                    className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-bold uppercase">Email *</label>
                  <input
                    type="email"
                    required
                    value={adminForm.email}
                    onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                    className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-bold uppercase">Contraseña *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={adminForm.password}
                    onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                    className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAdmin(false)}
                  className="rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/80 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingAdmin}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {creatingAdmin ? "Creando..." : "Crear Admin"}
                </button>
              </div>
            </form>
          )}

          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin usuarios registrados</p>
          ) : (
            <div className="space-y-2">
              {users.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{u.auth?.email || "Sin email"}</p>
                    <p className="text-xs text-muted-foreground">Rol: {u.role}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString("es-CO")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-foreground">Zona de Peligro</h3>
                <p className="text-xs text-muted-foreground mt-1">Resetear todos los datos de esta empresa. Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <button
              onClick={() => setShowReset(true)}
              className="rounded-lg bg-destructive px-4 py-2 text-xs font-bold text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              Resetear Datos
            </button>
          </div>

          {showReset && (
            <div className="mt-4 rounded-lg bg-destructive/10 border border-destructive/30 p-4">
              <p className="text-sm font-medium text-foreground mb-3">¿Estás seguro? Se eliminarán todos los pedidos, ubicaciones, mensajes y logs de esta empresa.</p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const { error } = await supabase.rpc("reset_company_data", { p_company_id: id! });
                    if (error) {
                      toast.error("Error al resetear: " + error.message);
                    } else {
                      toast.success("Datos reseteados correctamente");
                      queryClient.invalidateQueries({ queryKey: ["saas-company-stats", id] });
                    }
                    setShowReset(false);
                  }}
                  className="rounded-lg bg-destructive px-4 py-2 text-xs font-bold text-destructive-foreground hover:bg-destructive/90 transition-colors"
                >
                  Sí, resetear todo
                </button>
                <button
                  onClick={() => setShowReset(false)}
                  className="rounded-lg bg-muted px-4 py-2 text-xs font-bold text-foreground hover:bg-muted/80 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default SaaSCompanyDetail;
