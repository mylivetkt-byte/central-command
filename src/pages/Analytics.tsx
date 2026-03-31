import { DashboardLayout } from "@/components/DashboardLayout";
import { drivers, dailyStats, formatCurrency } from "@/data/mockData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts";
import { motion } from "framer-motion";
import { useState } from "react";

const tooltipStyle = { background: "hsl(222,47%,9%)", border: "1px solid hsl(217,33%,17%)", borderRadius: 8, color: "hsl(210,40%,96%)" };

const Analytics = () => {
  const [period, setPeriod] = useState<"7" | "14" | "30">("7");
  const data = dailyStats.slice(-Number(period));
  const topDrivers = [...drivers].sort((a, b) => b.totalDeliveries - a.totalDeliveries).slice(0, 10);

  const radarData = topDrivers.slice(0, 5).map(d => ({
    driver: d.name.split(" ")[0],
    entregas: d.totalDeliveries,
    aceptacion: d.acceptanceRate,
    tiempo: 100 - d.avgDeliveryTime * 2,
    rating: d.rating * 20,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analíticas de Rendimiento</h1>
            <p className="text-sm text-muted-foreground">Métricas detalladas de operación y repartidores</p>
          </div>
          <div className="flex gap-2">
            {(["7", "14", "30"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${period === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                {p} días
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Domicilios por Día</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,17%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="deliveries" stroke="hsl(217,91%,60%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Ingresos por Día</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,17%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} tickFormatter={v => `$${(v / 1000000).toFixed(1)}M`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="revenue" fill="hsl(160,84%,39%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Tiempo Promedio de Entrega (min)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,17%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="avgTime" stroke="hsl(38,92%,50%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Rendimiento Comparativo (Top 5)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(217,33%,17%)" />
                <PolarAngleAxis dataKey="driver" tick={{ fontSize: 11, fill: "hsl(215,20%,55%)" }} />
                <Radar name="Entregas" dataKey="entregas" stroke="hsl(217,91%,60%)" fill="hsl(217,91%,60%)" fillOpacity={0.15} />
                <Radar name="Aceptación" dataKey="aceptacion" stroke="hsl(160,84%,39%)" fill="hsl(160,84%,39%)" fillOpacity={0.15} />
                <Tooltip contentStyle={tooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Ranking de Repartidores — Top 10</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                  <th className="pb-3 pr-4">#</th>
                  <th className="pb-3 pr-4">Repartidor</th>
                  <th className="pb-3 pr-4">Entregas</th>
                  <th className="pb-3 pr-4">Tiempo Prom.</th>
                  <th className="pb-3 pr-4">Aceptación</th>
                  <th className="pb-3 pr-4">Cancelación</th>
                  <th className="pb-3 pr-4">Ingresos</th>
                  <th className="pb-3">Rating</th>
                </tr>
              </thead>
              <tbody>
                {topDrivers.map((d, i) => (
                  <tr key={d.id} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="py-3 pr-4 font-bold text-primary">{i + 1}</td>
                    <td className="py-3 pr-4 font-medium text-foreground">{d.name}</td>
                    <td className="py-3 pr-4">{d.totalDeliveries}</td>
                    <td className="py-3 pr-4">{d.avgDeliveryTime} min</td>
                    <td className="py-3 pr-4"><span className="text-accent">{d.acceptanceRate}%</span></td>
                    <td className="py-3 pr-4"><span className="text-destructive">{d.cancellationRate}%</span></td>
                    <td className="py-3 pr-4">{formatCurrency(d.revenue)}</td>
                    <td className="py-3">⭐ {d.rating}</td>
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

export default Analytics;
