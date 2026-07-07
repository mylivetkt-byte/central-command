import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Building2, Users, Package, DollarSign, ArrowLeft, Edit2, Power, Trash2, AlertTriangle, RefreshCw, Mail, Phone, Calendar, MapPin, Check, Plus, Shield, Upload } from "lucide-react";
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

  const [changingPasswordUser, setChangingPasswordUser] = useState<{ id: string; email: string } | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState("");

  const { data: users = [], refetch: refetchUsers } = useQuery({
    queryKey: ["saas-company-users-detailed", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_company_users_list", { p_company_id: id! });
      if (error) throw error;
      return data || [];
    },
  });

  const changePassword = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      const { error } = await supabase.rpc("set_user_password", {
        p_user_id: userId,
        p_new_password: newPassword,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contraseña actualizada con éxito");
      setChangingPasswordUser(null);
      setNewPasswordVal("");
    },
    onError: (err: any) => toast.error("Error al actualizar contraseña: " + err.message),
  });

  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({ name: "", nit: "", email: "", phone: "" });

  useEffect(() => {
    if (company) {
      setInfoForm({
        name: company.name || "",
        nit: company.nit || "",
        email: company.email || "",
        phone: company.phone || "",
      });
    }
  }, [company]);

  const [showDelete, setShowDelete] = useState(false);
  const deleteCompany = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("delete_company_completely", { p_company_id: id! });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Empresa eliminada por completo con todos sus datos");
      navigate("/saas/companies");
    },
    onError: (err: any) => toast.error("Error al eliminar empresa: " + err.message),
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

  const [showAddPayment, setShowAddPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    period_start: "",
    period_end: "",
    status: "pagado",
    notes: "",
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["saas-company-payments", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saas_payments")
        .select("*")
        .eq("company_id", id!)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createPayment = useMutation({
    mutationFn: async (fields: any) => {
      const { error } = await supabase
        .from("saas_payments")
        .insert({
          ...fields,
          amount: parseFloat(fields.amount),
          company_id: id!,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saas-company-payments", id] });
      toast.success("Pago registrado con éxito");
      setShowAddPayment(false);
      setPaymentForm({
        amount: "",
        period_start: "",
        period_end: "",
        status: "pagado",
        notes: "",
      });
    },
    onError: (err: any) => toast.error("Error al registrar pago: " + err.message),
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

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from("logos")
        .getPublicUrl(filePath);
      await updateCompany.mutateAsync({ logo_url: publicUrl });
      toast.success("Logotipo subido y actualizado con éxito");
    } catch (err: any) {
      toast.error("Error al subir logotipo: " + err.message);
    } finally {
      setUploadingLogo(false);
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border bg-card p-5 relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">Información</h3>
              {!isEditingInfo ? (
                <button
                  onClick={() => setIsEditingInfo(true)}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Edit2 className="h-3 w-3" /> Editar
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      updateCompany.mutate(infoForm, {
                        onSuccess: () => setIsEditingInfo(false)
                      });
                    }}
                    disabled={updateCompany.isPending}
                    className="rounded bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground hover:opacity-90 transition-opacity"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingInfo(false);
                      setInfoForm({
                        name: company.name || "",
                        nit: company.nit || "",
                        email: company.email || "",
                        phone: company.phone || "",
                      });
                    }}
                    className="rounded bg-muted px-2.5 py-1 text-[10px] font-bold text-foreground hover:bg-muted/80 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>

            {!isEditingInfo ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{company.name}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span>NIT: {company.nit || "Sin NIT"}</span>
                </div>
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
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-bold uppercase">Nombre de la Empresa</label>
                  <input
                    type="text"
                    value={infoForm.name}
                    onChange={(e) => setInfoForm({ ...infoForm, name: e.target.value })}
                    className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-bold uppercase">NIT</label>
                  <input
                    type="text"
                    value={infoForm.nit}
                    onChange={(e) => setInfoForm({ ...infoForm, nit: e.target.value })}
                    className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-bold uppercase">Email de Contacto</label>
                  <input
                    type="email"
                    value={infoForm.email}
                    onChange={(e) => setInfoForm({ ...infoForm, email: e.target.value })}
                    className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-bold uppercase">Teléfono de Contacto</label>
                  <input
                    type="text"
                    value={infoForm.phone}
                    onChange={(e) => setInfoForm({ ...infoForm, phone: e.target.value })}
                    className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
            )}
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

        {/* Personalización de Marca y Facturación */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Marca */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-bold text-foreground mb-1">Personalización de Marca</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Logotipo de la Empresa</label>
                <div className="flex items-center gap-4 p-3 rounded-lg border border-border bg-muted/15">
                  <div className="h-16 w-16 rounded bg-muted flex items-center justify-center overflow-hidden border border-border">
                    {company.logo_url ? (
                      <img src={company.logo_url} alt="Logo preview" className="h-full w-full object-cover" />
                    ) : (
                      <Building2 className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity">
                      <Upload className="h-3.5 w-3.5" />
                      {uploadingLogo ? "Subiendo..." : "Subir Logotipo"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        disabled={uploadingLogo}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[10px] text-muted-foreground mt-1">Soporta PNG, JPG. Tamaño recomendado 256x256.</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Color de Marca (Primario)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    defaultValue={company.primary_color || "#8B5CF6"}
                    onBlur={(e) => updateCompany.mutate({ primary_color: e.target.value })}
                    className="h-9 w-12 rounded border border-border bg-card p-0.5 cursor-pointer"
                  />
                  <span className="text-xs font-mono uppercase font-bold text-foreground">{company.primary_color || "#8B5CF6"}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Facturación */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Historial de Facturación</h3>
              <button
                onClick={() => setShowAddPayment(true)}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <Plus className="h-3.5 w-3.5" /> Registrar Pago
              </button>
            </div>

            {showAddPayment && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!paymentForm.amount || !paymentForm.period_start || !paymentForm.period_end) {
                    toast.error("Monto y periodos son obligatorios.");
                    return;
                  }
                  createPayment.mutate(paymentForm);
                }}
                className="border border-border/50 rounded-xl p-4 bg-muted/20 space-y-3"
              >
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nuevo Registro de Pago</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-bold uppercase">Monto (COP) *</label>
                    <input
                      type="number"
                      required
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                      className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-bold uppercase">Estado *</label>
                    <select
                      value={paymentForm.status}
                      onChange={(e) => setPaymentForm({ ...paymentForm, status: e.target.value })}
                      className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-bold"
                    >
                      <option value="pagado">Pagado</option>
                      <option value="pendiente">Pendiente</option>
                      <option value="vencido">Vencido</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-bold uppercase">Inicio Periodo *</label>
                    <input
                      type="date"
                      required
                      value={paymentForm.period_start}
                      onChange={(e) => setPaymentForm({ ...paymentForm, period_start: e.target.value })}
                      className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-bold uppercase">Fin Periodo *</label>
                    <input
                      type="date"
                      required
                      value={paymentForm.period_end}
                      onChange={(e) => setPaymentForm({ ...paymentForm, period_end: e.target.value })}
                      className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-bold uppercase">Notas / Observación</label>
                  <input
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    placeholder="Ej: Transferencia Bancaria N° 1234"
                    className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddPayment(false)}
                    className="rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/80 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={createPayment.isPending}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {createPayment.isPending ? "Registrando..." : "Registrar"}
                  </button>
                </div>
              </form>
            )}

            {payments.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No se han registrado pagos aún.</p>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {payments.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg bg-muted/20 border border-border/40 p-3 text-xs">
                    <div>
                      <p className="font-bold text-foreground">{formatCurrency(p.amount)}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Periodo: {new Date(p.period_start).toLocaleDateString("es-CO")} al {new Date(p.period_end).toLocaleDateString("es-CO")}</p>
                      {p.notes && <p className="text-[9px] text-muted-foreground/60 italic mt-0.5">{p.notes}</p>}
                    </div>
                    <div className="text-right">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                        p.status === "pagado" ? "bg-emerald-500/10 text-emerald-500" :
                        p.status === "pendiente" ? "bg-amber-500/10 text-amber-500" : "bg-red-500/10 text-red-500"
                      }`}>
                        {p.status}
                      </span>
                      <p className="text-[9px] text-muted-foreground mt-1">{new Date(p.payment_date).toLocaleDateString("es-CO")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
            <div className="space-y-3">
              {users.map((u: any) => (
                <div key={u.user_id} className="flex items-center justify-between rounded-lg bg-muted/20 border border-border/40 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{u.full_name || "Sin nombre"}</p>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                        u.role === "admin" ? "bg-primary/20 text-primary" : "bg-cyan-500/20 text-cyan-400"
                      }`}>
                        {u.role}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{u.email}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      Registrado: {new Date(u.created_at).toLocaleDateString("es-CO")}
                    </p>
                  </div>
                  <div>
                    <button
                      onClick={() => setChangingPasswordUser({ id: u.user_id, email: u.email })}
                      className="rounded bg-muted px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted/80 transition-colors"
                    >
                      Nueva Contraseña
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {changingPasswordUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card w-full max-w-sm p-6 relative bg-card border border-border">
                <h3 className="text-sm font-bold text-foreground mb-1">Actualizar Contraseña</h3>
                <p className="text-xs text-muted-foreground mb-4">Para: <span className="text-white font-bold">{changingPasswordUser.email}</span></p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newPasswordVal.length < 6) {
                      toast.error("La contraseña debe tener al menos 6 caracteres.");
                      return;
                    }
                    changePassword.mutate({ userId: changingPasswordUser.id, newPassword: newPasswordVal });
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-bold uppercase">Nueva contraseña</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPasswordVal}
                      onChange={(e) => setNewPasswordVal(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => { setChangingPasswordUser(null); setNewPasswordVal(""); }}
                      className="rounded-lg bg-muted px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted/80 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={changePassword.isPending}
                      className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {changePassword.isPending ? "Guardando..." : "Guardar Contraseña"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-destructive/20 pb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-foreground">Restablecer Datos</h3>
                <p className="text-xs text-muted-foreground mt-1">Borra todos los pedidos, chats, logs y ubicaciones, pero conserva los usuarios.</p>
              </div>
            </div>
            <button
              onClick={() => { setShowReset(true); setShowDelete(false); }}
              className="rounded-lg bg-destructive/15 border border-destructive/30 px-4 py-2 text-xs font-bold text-destructive hover:bg-destructive/20 transition-colors"
            >
              Resetear Datos
            </button>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-foreground">Eliminar Empresa Definitivamente</h3>
                <p className="text-xs text-muted-foreground mt-1">Borra la empresa, todos sus datos operativos y todas las cuentas de usuario asociadas.</p>
              </div>
            </div>
            <button
              onClick={() => { setShowDelete(true); setShowReset(false); }}
              className="rounded-lg bg-destructive px-4 py-2 text-xs font-bold text-destructive-foreground hover:bg-destructive/95 transition-colors"
            >
              Eliminar Empresa
            </button>
          </div>

          {showReset && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4">
              <p className="text-sm font-medium text-foreground mb-3">¿Estás seguro? Se eliminarán todos los pedidos, ubicaciones, mensajes y logs de esta empresa de forma irreversible.</p>
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

          {showDelete && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4">
              <p className="text-sm font-medium text-foreground mb-3">¿Estás ABSOLUTAMENTE seguro? Se eliminará la empresa, todos sus datos y TODAS las cuentas de administradores y repartidores asociados. Esta acción no se puede deshacer.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => deleteCompany.mutate()}
                  disabled={deleteCompany.isPending}
                  className="rounded-lg bg-destructive px-4 py-2 text-xs font-bold text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                  {deleteCompany.isPending ? "Eliminando..." : "Sí, eliminar empresa y todos sus datos"}
                </button>
                <button
                  onClick={() => setShowDelete(false)}
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
