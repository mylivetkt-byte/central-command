import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { KPICard } from "@/components/KPICard";
import { DollarSign, TrendingUp, Users, Receipt } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

const tooltipStyle = { background: "hsl(222,47%,9%)", border: "1px solid hsl(217,33%,17%)", borderRadius: 8, color: "hsl(210,40%,96%)" };

const Financial = () => {
  const { data: deliveries = [], isLoading: isLoadingDeliveries } = useQuery({
    queryKey: ["financial-deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deliveries").select("*").eq("status", "entregado").order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  const { data: drivers = [], isLoading: isLoadingDrivers } = useQuery({
    queryKey: ["financial-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("driver_profiles").select("*, profiles (full_name)");
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Calculate totals
  const totalRevenue = deliveries.reduce((s: number, d: any) => s + Number(d.amount || 0), 0);
  const totalCommission = deliveries.reduce((s: number, d: any) => s + Number(d.commission || 0), 0);
  const avgCommission = deliveries.length > 0 ? Math.floor(totalCommission / deliveries.length) : 0;

  // Driver Earnings
  const driverEarnings = deliveries.reduce((acc: Record<string, any>, d: any) => {
    if (d.driver_id) {
      if (!acc[d.driver_id]) {
        const driverName = drivers.find((dr: any) => dr.id === d.driver_id)?.profiles?.full_name || "Desconocido";
        acc[d.driver_id] = { id: d.driver_id, name: driverName, ganancia: 0, comision: 0, deliveries: 0 };
      }
      acc[d.driver_id].ganancia += Number(d.amount || 0);
      acc[d.driver_id].comision += Number(d.commission || 0);
      acc[d.driver_id].deliveries += 1;
    }
    return acc;
  }, {});

  const earningsList = Object.values(driverEarnings)
    .sort((a: any, b: any) => b.ganancia - a.ganancia)
    .slice(0, 8);

  // Last 7 days revenues
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    date.setHours(0, 0, 0, 0);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const revenue = deliveries
      .filter((d: any) => {
        const created = new Date(d.created_at);
        return created >= date && created < nextDay;
      })
      .reduce((s: number, d: any) => s + Number(d.amount || 0), 0);

    return {
      date: date.toISOString().slice(0, 10),
      revenue,
    };
  });

  if (isLoadingDeliveries || isLoadingDrivers) {
    return (
      <DashboardLayout>
        <div className="flex h-screen items-center justify-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Panel Financiero</h1>
          <p className="text-sm text-muted-foreground">Ingresos reales, comisiones y ganancias por repartidor</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard title="Ingresos Totales" value={formatCurrency(totalRevenue)} icon={<DollarSign className="h-5 w-5" />} variant="success" />
          <KPICard title="Comisiones Totales" value={formatCurrency(totalCommission)} icon={<Receipt className="h-5 w-5" />} variant="primary" />
          <KPICard title="Comisión Promedio" value={formatCurrency(avgCommission)} icon={<TrendingUp className="h-5 w-5" />} subtitle="por pedido" />
          <KPICard title="Repartidores Pagados" value={earningsList.length} icon={<Users className="h-5 w-5" />} variant="primary" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Ingresos — Últimos 7 días</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={last7}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,17%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="revenue" fill="hsl(160,84%,39%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Ganancia por Repartidor</h3>
            {earningsList.length === 0 ? (
              <div className="flex h-full items-center justify-center pb-6 text-sm text-muted-foreground">No hay ganancias registradas</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={earningsList} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,17%)" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(215,20%,55%)" }} width={90} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="ganancia" fill="hsl(217,91%,60%)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Pagos y Comisiones</h3>
          <div className="overflow-x-auto">
            {earningsList.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay repartidores con entregas finalizadas.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                    <th className="pb-3 pr-4">Repartidor</th>
                    <th className="pb-3 pr-4">Entregas Completadas</th>
                    <th className="pb-3 pr-4">Ingresos Recaudados</th>
                    <th className="pb-3 pr-4">Comisiones Ganadas</th>
                    <th className="pb-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {earningsList.map((d: any) => (
                    <tr key={d.id} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="py-3 pr-4 font-medium text-foreground">{d.name}</td>
                      <td className="py-3 pr-4">{d.deliveries}</td>
                      <td className="py-3 pr-4">{formatCurrency(d.ganancia)}</td>
                      <td className="py-3 pr-4 text-accent">{formatCurrency(d.comision)}</td>
                      <td className="py-3"><span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">Registrado</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default Financial;
