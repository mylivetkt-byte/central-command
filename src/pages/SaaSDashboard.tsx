import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Building2, Users, DollarSign, AlertCircle, Check, Activity, FileText, ChevronRight, Package, Clock } from "lucide-react";
import { toast } from "sonner";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

const SaaSDashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 1. Cargar todas las empresas
  const { data: companies = [], isLoading: loadingCompanies } = useQuery({
    queryKey: ["saas-companies-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saas_companies")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // 2. Cargar total de repartidores y envíos globales
  const { data: globalStats = { totalDeliveries: 0, totalDrivers: 0 }, isLoading: loadingStats } = useQuery({
    queryKey: ["saas-global-stats"],
    queryFn: async () => {
      const { count: deliveries } = await supabase
        .from("deliveries")
        .select("*", { count: "exact", head: true });
      const { count: drivers } = await supabase
        .from("driver_profiles")
        .select("*", { count: "exact", head: true });
      return { totalDeliveries: deliveries || 0, totalDrivers: drivers || 0 };
    },
  });

  // 3. Cargar pagos recientes
  const { data: recentPayments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ["saas-recent-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saas_payments")
        .select("*, saas_companies(name)")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });

  // Mutación para autorizar rápido una empresa pendiente
  const authorizeCompany = useMutation({
    mutationFn: async (companyId: string) => {
      const { error } = await supabase
        .from("saas_companies")
        .update({ status: "activa", updated_at: new Date().toISOString() })
        .eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saas-companies-dashboard"] });
      toast.success("Empresa activada con éxito");
    },
    onError: (err: any) => toast.error("Error al activar: " + err.message),
  });

  // Cálculos de métricas
  const activeCompanies = companies.filter((c) => c.status === "activa");
  const pendingCompanies = companies.filter((c) => c.status === "pendiente");
  const suspendedCompanies = companies.filter((c) => c.status === "suspendida" || c.status === "inactiva");

  // Ingresos Mensuales Recurrentes (MRR) de empresas activas
  const mrr = activeCompanies.reduce((sum, c) => sum + Number(c.plan_value || 0), 0);

  const loading = loadingCompanies || loadingStats || loadingPayments;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">SaaS Central Command</h1>
          <p className="text-sm text-muted-foreground">Métricas globales y administración del servicio</p>
        </div>

        {/* Tarjetas de Métricas */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">MRR Proyectado</p>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-foreground mt-1">{formatCurrency(mrr)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Suma de planes de empresas activas</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Empresas</p>
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-black text-foreground mt-1">{companies.length}</p>
            <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
              <span className="text-emerald-500">{activeCompanies.length} Activas</span>
              <span className="text-amber-500">{pendingCompanies.length} Pendientes</span>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Repartidores Activos</p>
              <Users className="h-4 w-4 text-accent" />
            </div>
            <p className="text-2xl font-black text-foreground mt-1">{globalStats.totalDrivers}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Mensajeros operando en el sistema</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pedidos Totales</p>
              <Activity className="h-4 w-4 text-cyan-500" />
            </div>
            <p className="text-2xl font-black text-foreground mt-1">{globalStats.totalDeliveries}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Servicios completados globales</p>
          </motion.div>
        </div>

        {/* Tablas y Listas */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Solicitudes de Activación */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" /> Solicitudes Pendientes ({pendingCompanies.length})
              </h3>
              <button onClick={() => navigate("/saas/companies")} className="text-xs text-primary hover:underline flex items-center gap-0.5">
                Ver todas <ChevronRight className="h-3 w-3" />
              </button>
            </div>

            {pendingCompanies.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No hay registros pendientes de autorización.</p>
            ) : (
              <div className="space-y-3">
                {pendingCompanies.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg bg-muted/20 border border-border/40 p-3">
                    <div>
                      <p className="text-xs font-bold text-foreground">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">NIT: {c.nit || "Sin NIT"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/saas/companies/${c.id}`)}
                        className="rounded bg-muted px-2.5 py-1 text-[10px] font-bold text-foreground hover:bg-muted/80 transition-colors"
                      >
                        Revisar
                      </button>
                      <button
                        onClick={() => authorizeCompany.mutate(c.id)}
                        disabled={authorizeCompany.isPending}
                        className="flex items-center gap-1 rounded bg-yellow-500 px-2.5 py-1 text-[10px] font-bold text-black hover:bg-yellow-400 transition-colors disabled:opacity-50"
                      >
                        <Check className="h-3 w-3" /> Activar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Pagos Recientes */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-500" /> Facturación Reciente
              </h3>
            </div>

            {recentPayments.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No se han registrado pagos aún.</p>
            ) : (
              <div className="space-y-2">
                {recentPayments.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg bg-muted/10 p-3 text-xs border border-border/20">
                    <div>
                      <p className="font-bold text-foreground">{(p.saas_companies as any)?.name || "Empresa"}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Periodo: {new Date(p.period_start).toLocaleDateString("es-CO")} al {new Date(p.period_end).toLocaleDateString("es-CO")}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-500">{formatCurrency(p.amount)}</p>
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase mt-1 ${
                        p.status === "pagado" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                      }`}>
                        {p.status}
                      </span>
                    </div>
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

export default SaaSDashboard;
