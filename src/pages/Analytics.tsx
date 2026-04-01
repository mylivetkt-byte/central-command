import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts";
import { motion } from "framer-motion";
import { useState } from "react";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

const tooltipStyle = { background: "hsl(222,47%,9%)", border: "1px solid hsl(217,33%,17%)", borderRadius: 8, color: "hsl(210,40%,96%)" };

const Analytics = () => {
  const [period, setPeriod] = useState<"7" | "14" | "30">("7");

  const { data: deliveries = [], isLoading: isLoadingDeliveries } = useQuery({
    queryKey: ["analytics-deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deliveries").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  const { data: drivers = [], isLoading: isLoadingDrivers } = useQuery({
    queryKey: ["analytics-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("driver_profiles").select("*, user:id(full_name)");
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Re-calculate daily stats based on the desired period
  const daysDiff = parseInt(period);
  const data = Array.from({ length: daysDiff }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (daysDiff - 1 - i));
    date.setHours(0, 0, 0, 0);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const dayDeliveries = deliveries.filter((d: any) => {
      const created = new Date(d.created_at);
      return created >= date && created < nextDay;
    });

    const revenue = dayDeliveries
      .filter((d: any) => d.status === "entregado")
      .reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);

    const avgTime = dayDeliveries.length > 0
      ? Math.round(dayDeliveries.reduce((sum: number, d: any) => sum + Number(d.estimated_time || 30), 0) / dayDeliveries.length)
      : 0;

    return {
      date: date.toISOString().slice(0, 10),
      deliveries: dayDeliveries.length,
      revenue,
      avgTime,
    };
  });

  const topDrivers = [...drivers].sort((a: any, b: any) => (b.total_deliveries || 0) - (a.total_deliveries || 0)).slice(0, 10);

  const radarData = topDrivers.slice(0, 5).map((d: any) => ({
    driver: (d.user?.full_name || "M").split(" ")[0],
    entregas: d.total_deliveries || 0,
    aceptacion: d.acceptance_rate || 50,
    tiempo: 100 - (30 * 2), // Mocking performance score based on estimated time vs real time, using 30 mins average for now
    rating: (d.rating || 0) * 20,
  }));

  if (isLoadingDeliveries || isLoadingDrivers) {
    return (
      <DashboardLayout>
        <div className="flex justify-center p-20"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analíticas de Rendimiento</h1>
            <p className="text-sm text-muted-foreground">Métricas en tiempo real procesadas desde la base de datos central</p>
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
                <YAxis tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="deliveries" stroke="hsl(217,91%,60%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Ingresos Totales por Día</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,17%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="revenue" fill="hsl(160,84%,39%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Tiempo Promedio Estimado (min)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,17%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="avgTime" stroke="hsl(38,92%,50%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Rendimiento Comparativo (Top 5)</h3>
            {radarData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground pb-10">Sin suficientes datos</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(217,33%,17%)" />
                  <PolarAngleAxis dataKey="driver" tick={{ fontSize: 11, fill: "hsl(215,20%,55%)" }} />
                  <Radar name="Entregas" dataKey="entregas" stroke="hsl(217,91%,60%)" fill="hsl(217,91%,60%)" fillOpacity={0.15} />
                  <Radar name="Aceptación" dataKey="aceptacion" stroke="hsl(160,84%,39%)" fill="hsl(160,84%,39%)" fillOpacity={0.15} />
                  <Tooltip contentStyle={tooltipStyle} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Ranking de Repartidores — Top 10</h3>
          <div className="overflow-x-auto">
            {topDrivers.length === 0 ? (
              <p className="text-sm text-muted-foreground pb-2">No hay repartidores registrados.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                    <th className="pb-3 pr-4">#</th>
                    <th className="pb-3 pr-4">Repartidor</th>
                    <th className="pb-3 pr-4">Entregas Totales</th>
                    <th className="pb-3 pr-4">Aceptación</th>
                    <th className="pb-3 pr-4">Cancelaciones</th>
                    <th className="pb-3 pr-4">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {topDrivers.map((d: any, i: number) => (
                    <tr key={d.id} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="py-3 pr-4 font-bold text-primary">{i + 1}</td>
                      <td className="py-3 pr-4 font-medium text-foreground">{d.user?.full_name || "Sin nombre"}</td>
                      <td className="py-3 pr-4">{d.total_deliveries || 0}</td>
                      <td className="py-3 pr-4"><span className="text-accent">{d.acceptance_rate || 0}%</span></td>
                      <td className="py-3 pr-4"><span className="text-destructive">{d.cancellation_rate || 0}%</span></td>
                      <td className="py-3 pr-4">⭐ {d.rating || "N/A"}</td>
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

export default Analytics;
