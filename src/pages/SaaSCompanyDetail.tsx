import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Building2, Users, Package, DollarSign, ArrowLeft, Edit2, Power, Trash2, AlertTriangle, RefreshCw, Mail, Phone, Calendar, MapPin } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
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
  const queryClient = useQueryClient();
  const [showReset, setShowReset] = useState(false);

  useEffect(() => {
    if (role !== null && role !== "super_admin") navigate("/", { replace: true });
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

  const updatePlan = useMutation({
    mutationFn: async ({ plan }: { plan: string }) => {
      const { error } = await supabase
        .from("saas_companies")
        .update({ plan, updated_at: new Date().toISOString() })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saas-company", id] });
      toast.success("Plan actualizado");
    },
    onError: () => toast.error("Error al actualizar plan"),
  });

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
            <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
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

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold text-foreground mb-4">Plan</h3>
            <div className="flex gap-2">
              {["basico", "profesional", "enterprise"].map((p) => (
                <button
                  key={p}
                  onClick={() => updatePlan.mutate({ plan: p })}
                  disabled={updatePlan.isPending}
                  className={`flex-1 rounded-lg border px-4 py-3 text-sm font-bold transition-all ${
                    company.plan === p
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {planLabels[p]}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <p className="text-xs text-muted-foreground mb-2">Límite de repartidores</p>
              <input
                type="number"
                defaultValue={company.max_drivers}
                onBlur={async (e) => {
                  const val = parseInt(e.target.value);
                  if (val > 0) {
                    await supabase
                      .from("saas_companies")
                      .update({ max_drivers: val, updated_at: new Date().toISOString() })
                      .eq("id", id!);
                    queryClient.invalidateQueries({ queryKey: ["saas-company", id] });
                    toast.success("Límite actualizado");
                  }
                }}
                className="w-24 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">Usuarios de la empresa</h3>
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
