import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Package, Truck, Clock, DollarSign, Users, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { motion } from "framer-motion";

const COLORS = ["hsl(217,91%,60%)", "hsl(160,84%,39%)", "hsl(38,92%,50%)", "hsl(0,84%,60%)"];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

const tooltipStyle = { background: "hsl(222,47%,9%)", border: "1px solid hsl(217,33%,17%)", borderRadius: 8, color: "hsl(210,40%,96%)" };

const Dashboard = () => {
  // Pedidos de hoy
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: deliveries = [] } = useQuery({
    queryKey: ["dashboard-deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["dashboard-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_profiles")
        .select(`id, status, total_deliveries, rating, acceptance_rate, current_load, zone, profiles (full_name)`) as any;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  // KPIs calculados desde datos reales
  const todayDeliveries = deliveries.filter((d: any) =>
    new Date(d.created_at) >= today
  );

  const kpis = {
    enCurso: deliveries.filter((d: any) => ["aceptado", "en_camino"].includes(d.status)).length,
    pendientes: deliveries.filter((d: any) => d.status === "pendiente").length,
    finalizados: deliveries.filter((d: any) => d.status === "entregado").length,
    cancelados: deliveries.filter((d: any) => d.status === "cancelado").length,
    totalRevenue: deliveries.filter((d: any) => d.status === "entregado").reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0),
    totalCommission: deliveries.filter((d: any) => d.status === "entregado").reduce((sum: number, d: any) => sum + Number(d.commission || 0), 0),
    activeDrivers: (drivers as any[]).filter((d: any) => d.status === "activo").length,
    totalDeliveries: deliveries.length,
  };

  const statusData = [
    { name: "En curso", value: kpis.enCurso },
    { name: "Pendientes", value: kpis.pendientes },
    { name: "Finalizados", value: kpis.finalizados },
    { name: "Cancelados", value: kpis.cancelados },
  ].filter(d => d.value > 0);

  // Últimos 7 días de actividad
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    date.setHours(0, 0, 0, 0);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    const count = deliveries.filter((d: any) => {
      const created = new Date(d.created_at);
      return created >= date && created < nextDay;
    }).length;
    return {
      date: date.toISOString().slice(0, 10),
      deliveries: count,
    };
  });

  const recentDeliveries = deliveries.slice(0, 8);
  const topDrivers = [...(drivers as any[])].sort((a: any, b: any) => (b.total_deliveries || 0) - (a.total_deliveries || 0)).slice(0, 5);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Panel Central</h1>
          <p className="text-sm text-muted-foreground">
            Datos en tiempo real desde Supabase — {new Date().toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard title="Pedidos en Curso" value={kpis.enCurso} icon={<Truck className="h-5 w-5" />} variant="primary" />
          <KPICard title="Pendientes" value={kpis.pendientes} icon={<Clock className="h-5 w-5" />} variant="warning" />
          <KPICard title="Finalizados" value={kpis.finalizados} icon={<CheckCircle className="h-5 w-5" />} variant="success" />
          <KPICard title="Ingresos Totales" value={formatCurrency(kpis.totalRevenue)} icon={<DollarSign className="h-5 w-5" />} variant="success" subtitle={`Comisión: ${formatCurrency(kpis.totalCommission)}`} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard title="Mensajeros Activos" value={kpis.activeDrivers} icon={<Users className="h-5 w-5" />} variant="primary" subtitle={`de ${(drivers as any[]).length} registrados`} />
          <KPICard title="Cancelados" value={kpis.cancelados} icon={<XCircle className="h-5 w-5" />} variant="danger" />
          <KPICard title="Total Domicilios" value={kpis.totalDeliveries} icon={<Package className="h-5 w-5" />} />
          <KPICard title="Hoy" value={todayDeliveries.length} icon={<AlertTriangle className="h-5 w-5" />} variant="warning" subtitle="domicilios registrados hoy" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5 lg:col-span-2">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Domicilios — Últimos 7 días</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={last7Days}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,17%)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(215,20%,55%)" }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(215,20%,55%)" }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="deliveries" fill="hsl(217,91%,60%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Estado de Pedidos</h3>
            {statusData.length === 0 ? (
              <div className="flex h-48 items-center justify-center">
                <p className="text-sm text-muted-foreground">Sin datos aún</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Top Mensajeros</h3>
            {topDrivers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin mensajeros registrados</p>
            ) : (
              <div className="space-y-3">
                {topDrivers.map((d: any, i: number) => (
                  <div key={d.id} className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">{i + 1}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{d.profiles?.full_name || "Sin nombre"}</p>
                      <p className="text-xs text-muted-foreground">{d.total_deliveries || 0} entregas · {d.zone || "Sin zona"}</p>
                    </div>
                    <span className="text-sm font-semibold text-accent">{d.acceptance_rate || 0}%</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Últimos Pedidos</h3>
            {recentDeliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin pedidos aún. Crea uno en Despacho.</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {recentDeliveries.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">#{d.order_id}</p>
                      <p className="text-xs text-muted-foreground">{d.customer_name} · {d.zone || "Sin zona"}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        d.status === "entregado" ? "bg-accent/10 text-accent" :
                        d.status === "en_camino" ? "bg-primary/10 text-primary" :
                        d.status === "pendiente" ? "bg-yellow-500/10 text-yellow-500" :
                        d.status === "cancelado" ? "bg-destructive/10 text-destructive" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {d.status}
                      </span>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(Number(d.amount || 0))}</p>
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

export default Dashboard;
