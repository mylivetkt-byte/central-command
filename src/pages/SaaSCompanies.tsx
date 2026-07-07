import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Users, Package, Plus, Search, RefreshCw, Power, Eye } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

const planColors: Record<string, string> = {
  basico: "bg-zinc-500/10 text-zinc-400",
  profesional: "bg-blue-500/10 text-blue-400",
  enterprise: "bg-amber-500/10 text-amber-400",
};

const statusColors: Record<string, string> = {
  pendiente: "bg-yellow-500/10 text-yellow-500",
  activa: "bg-accent/10 text-accent",
  inactiva: "bg-muted text-muted-foreground",
  suspendida: "bg-destructive/10 text-destructive",
};

const SaaSCompanies = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (role !== null && role !== "super_admin") navigate("/saas/login", { replace: true });
  }, [role, navigate]);

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["saas-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saas_companies")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === "activa" ? "inactiva" : "activa";
      const { error } = await supabase
        .from("saas_companies")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saas-companies"] });
      toast.success("Estado actualizado");
    },
    onError: () => toast.error("Error al actualizar estado"),
  });

  const filtered = companies.filter((c: any) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.nit || "").includes(search)
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Empresas</h1>
            <p className="text-sm text-muted-foreground">Gestiona las empresas registradas en la plataforma</p>
          </div>
          <button
            onClick={() => navigate("/saas/companies/new")}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus className="h-4 w-4" /> Nueva Empresa
          </button>
        </div>

        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar empresas..."
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c: any, i: number) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group rounded-xl border border-border bg-card p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer"
              onClick={() => navigate(`/saas/companies/${c.id}`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{c.name}</h3>
                    <p className="text-xs text-muted-foreground">{c.nit || "Sin NIT"}</p>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusColors[c.status] || ""}`}>
                  {c.status}
                </span>
              </div>

               <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${planColors[c.plan] || ""}`}>
                    {c.plan}
                  </span>
                  <span className="font-bold text-foreground">
                    {formatCurrency(c.plan_value || 0)}
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" /> {c.max_drivers} max
                </span>
              </div>

              {c.email && (
                <p className="mt-3 text-xs text-muted-foreground">{c.email}</p>
              )}

              <div className="mt-4 flex items-center gap-2 pt-3 border-t border-border/50">
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/saas/companies/${c.id}`); }}
                  className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <Eye className="h-3.5 w-3.5" /> Ver
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleStatus.mutate({ id: c.id, status: c.status });
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <Power className="h-3.5 w-3.5" /> {c.status === "activa" ? "Desactivar" : "Activar"}
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-sm font-medium text-muted-foreground">No hay empresas registradas</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Crea la primera empresa para comenzar</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SaaSCompanies;
