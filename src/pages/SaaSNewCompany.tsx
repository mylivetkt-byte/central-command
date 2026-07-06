import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ArrowLeft, Save } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const SaaSNewCompany = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (role !== null && role !== "super_admin") navigate("/", { replace: true });
  }, [role, navigate]);
  const [form, setForm] = useState({
    name: "",
    nit: "",
    email: "",
    phone: "",
    plan: "basico",
    max_drivers: "5",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("saas_companies")
        .insert({
          name: form.name.trim(),
          nit: form.nit.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          plan: form.plan,
          max_drivers: parseInt(form.max_drivers) || 5,
        })
        .select()
        .single();
      if (error) throw error;
      toast.success("Empresa creada correctamente");
      navigate(`/saas/companies/${data.id}`);
    } catch (err: any) {
      toast.error(err.message || "Error al crear empresa");
    }
    setSaving(false);
  };

  return (
    <DashboardLayout>
      <div className="max-w-xl mx-auto space-y-6">
        <button
          onClick={() => navigate("/saas/companies")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a empresas
        </button>

        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Nueva Empresa</h1>
            <p className="text-sm text-muted-foreground">Registra una nueva empresa en la plataforma</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">Nombre *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Nombre de la empresa"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">NIT</label>
              <input
                value={form.nit}
                onChange={(e) => setForm({ ...form, nit: e.target.value })}
                className="w-full rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="123456789-0"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">Plan</label>
              <select
                value={form.plan}
                onChange={(e) => setForm({ ...form, plan: e.target.value })}
                className="w-full rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="basico">Básico</option>
                <option value="profesional">Profesional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="empresa@ejemplo.com"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">Teléfono</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="+57 300 000 0000"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">Límite de Repartidores</label>
            <input
              type="number"
              value={form.max_drivers}
              onChange={(e) => setForm({ ...form, max_drivers: e.target.value })}
              className="w-32 rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              min={1}
              max={999}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => navigate("/saas/companies")}
              className="rounded-lg bg-muted px-5 py-2.5 text-sm font-bold text-foreground hover:bg-muted/80 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Guardando..." : "Crear Empresa"}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default SaaSNewCompany;
