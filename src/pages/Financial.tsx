import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { drivers, deliveries, dailyStats, formatCurrency } from "@/data/mockData";
import { DollarSign, TrendingUp, Users, Receipt } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";

const tooltipStyle = { background: "hsl(222,47%,9%)", border: "1px solid hsl(217,33%,17%)", borderRadius: 8, color: "hsl(210,40%,96%)" };

const Financial = () => {
  const totalRevenue = deliveries.reduce((s, d) => s + d.amount, 0);
  const totalCommission = deliveries.reduce((s, d) => s + d.commission, 0);
  const avgCommission = Math.floor(totalCommission / deliveries.length);
  const driverEarnings = drivers.map(d => ({ name: d.name.split(" ")[0], ganancia: d.revenue, comision: d.commission }))
    .sort((a, b) => b.ganancia - a.ganancia).slice(0, 8);

  const last7 = dailyStats.slice(-7);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Panel Financiero</h1>
          <p className="text-sm text-muted-foreground">Ingresos, comisiones y ganancias por repartidor</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard title="Ingresos del Día" value={formatCurrency(totalRevenue)} icon={<DollarSign className="h-5 w-5" />} variant="success" trend={{ value: 15, label: "vs ayer" }} />
          <KPICard title="Comisiones Totales" value={formatCurrency(totalCommission)} icon={<Receipt className="h-5 w-5" />} variant="primary" />
          <KPICard title="Comisión Promedio" value={formatCurrency(avgCommission)} icon={<TrendingUp className="h-5 w-5" />} subtitle="por pedido" />
          <KPICard title="Repartidores Pagados" value={drivers.length} icon={<Users className="h-5 w-5" />} variant="primary" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Ingresos — Últimos 7 días</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={last7}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,17%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} tickFormatter={v => `$${(v / 1000000).toFixed(1)}M`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="revenue" fill="hsl(160,84%,39%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Ganancia por Repartidor</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={driverEarnings} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,17%)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} tickFormatter={v => `$${(v / 1000000).toFixed(1)}M`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(215,20%,55%)" }} width={70} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="ganancia" fill="hsl(217,91%,60%)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Historial de Pagos</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                  <th className="pb-3 pr-4">Repartidor</th>
                  <th className="pb-3 pr-4">Entregas</th>
                  <th className="pb-3 pr-4">Ingresos</th>
                  <th className="pb-3 pr-4">Comisión</th>
                  <th className="pb-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map(d => (
                  <tr key={d.id} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="py-3 pr-4 font-medium text-foreground">{d.name}</td>
                    <td className="py-3 pr-4">{d.totalDeliveries}</td>
                    <td className="py-3 pr-4">{formatCurrency(d.revenue)}</td>
                    <td className="py-3 pr-4 text-accent">{formatCurrency(d.commission)}</td>
                    <td className="py-3"><span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">Pagado</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default Financial;
