import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { getKPIs, formatCurrency, deliveries, drivers, dailyStats } from "@/data/mockData";
import { Package, Truck, Clock, DollarSign, Users, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { motion } from "framer-motion";

const COLORS = ["hsl(217,91%,60%)", "hsl(160,84%,39%)", "hsl(38,92%,50%)", "hsl(280,67%,60%)", "hsl(0,84%,60%)"];

const Dashboard = () => {
  const kpis = getKPIs();

  const statusData = [
    { name: "En curso", value: kpis.enCurso },
    { name: "Pendientes", value: kpis.pendientes },
    { name: "Finalizados", value: kpis.finalizados },
    { name: "Cancelados", value: kpis.cancelados },
  ];

  const recentDeliveries = deliveries.slice(0, 8);
  const topDrivers = [...drivers].sort((a, b) => b.totalDeliveries - a.totalDeliveries).slice(0, 5);
  const last7Days = dailyStats.slice(-7);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Panel Central</h1>
          <p className="text-sm text-muted-foreground">Resumen operativo en tiempo real — 31 de marzo, 2026</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard title="Pedidos en Curso" value={kpis.enCurso} icon={<Truck className="h-5 w-5" />} variant="primary" trend={{ value: 12, label: "vs ayer" }} />
          <KPICard title="Pendientes" value={kpis.pendientes} icon={<Clock className="h-5 w-5" />} variant="warning" />
          <KPICard title="Finalizados Hoy" value={kpis.finalizados} icon={<CheckCircle className="h-5 w-5" />} variant="success" trend={{ value: 8, label: "vs ayer" }} />
          <KPICard title="Ingresos del Día" value={formatCurrency(kpis.totalRevenue)} icon={<DollarSign className="h-5 w-5" />} variant="success" subtitle={`Comisión: ${formatCurrency(kpis.totalCommission)}`} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard title="Repartidores Activos" value={kpis.activeDrivers} icon={<Users className="h-5 w-5" />} variant="primary" subtitle={`de ${drivers.length} totales`} />
          <KPICard title="Cancelados" value={kpis.cancelados} icon={<XCircle className="h-5 w-5" />} variant="danger" />
          <KPICard title="Total Domicilios" value={kpis.totalDeliveries} icon={<Package className="h-5 w-5" />} />
          <KPICard title="Alertas Activas" value={3} icon={<AlertTriangle className="h-5 w-5" />} variant="warning" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5 lg:col-span-2">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Domicilios — Últimos 7 días</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={last7Days}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,17%)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(215,20%,55%)" }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(215,20%,55%)" }} />
                <Tooltip contentStyle={{ background: "hsl(222,47%,9%)", border: "1px solid hsl(217,33%,17%)", borderRadius: 8, color: "hsl(210,40%,96%)" }} />
                <Bar dataKey="deliveries" fill="hsl(217,91%,60%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Estado de Pedidos</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(222,47%,9%)", border: "1px solid hsl(217,33%,17%)", borderRadius: 8, color: "hsl(210,40%,96%)" }} />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Top Repartidores</h3>
            <div className="space-y-3">
              {topDrivers.map((d, i) => (
                <div key={d.id} className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{d.totalDeliveries} entregas · {d.avgDeliveryTime} min promedio</p>
                  </div>
                  <span className="text-sm font-semibold text-accent">{d.acceptanceRate}%</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Últimos Pedidos</h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {recentDeliveries.map(d => (
                <div key={d.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{d.orderId}</p>
                    <p className="text-xs text-muted-foreground">{d.driverName} · {d.zone}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      d.status === "entregado" ? "bg-accent/10 text-accent" :
                      d.status === "en_camino" ? "bg-primary/10 text-primary" :
                      d.status === "pendiente" ? "bg-warning/10 text-warning" :
                      d.status === "cancelado" ? "bg-destructive/10 text-destructive" :
                      "bg-muted text-muted-foreground"
                    }`}>{d.status.replace("_", " ")}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(d.amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
