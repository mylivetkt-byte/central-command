import { DashboardLayout } from "@/components/DashboardLayout";
import { dailyStats, drivers, formatCurrency } from "@/data/mockData";
import { motion } from "framer-motion";
import { Download, FileText, Table } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const tooltipStyle = { background: "hsl(222,47%,9%)", border: "1px solid hsl(217,33%,17%)", borderRadius: 8, color: "hsl(210,40%,96%)" };

type DateFilter = "hoy" | "ayer" | "semana" | "mes" | "custom";

const Reports = () => {
  const [filter, setFilter] = useState<DateFilter>("semana");
  const [report, setReport] = useState<"deliveries" | "revenue" | "drivers">("deliveries");

  const getData = () => {
    switch (filter) {
      case "hoy": return dailyStats.slice(-1);
      case "ayer": return dailyStats.slice(-2, -1);
      case "semana": return dailyStats.slice(-7);
      case "mes": return dailyStats;
      default: return dailyStats.slice(-7);
    }
  };

  const data = getData();

  const exportReport = (format: string) => {
    toast.success(`Exportando reporte en ${format}`, { description: "El archivo se descargará en breve" });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reportes</h1>
            <p className="text-sm text-muted-foreground">Genera y exporta informes operativos</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => exportReport("Excel")} className="flex items-center gap-1 rounded-lg bg-accent/10 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/20 transition-colors">
              <Table className="h-3 w-3" /> Excel
            </button>
            <button onClick={() => exportReport("PDF")} className="flex items-center gap-1 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors">
              <FileText className="h-3 w-3" /> PDF
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["hoy", "ayer", "semana", "mes"] as DateFilter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
              {f}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {([["deliveries", "Domicilios por día"], ["revenue", "Ingresos por día"], ["drivers", "Entregas por repartidor"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setReport(key)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${report === key ? "bg-secondary text-secondary-foreground" : "bg-muted/50 text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>

        <motion.div key={`${report}-${filter}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
          {report === "deliveries" && (
            <>
              <h3 className="mb-4 text-sm font-semibold text-foreground">Domicilios por Día</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,17%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="deliveries" fill="hsl(217,91%,60%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
          {report === "revenue" && (
            <>
              <h3 className="mb-4 text-sm font-semibold text-foreground">Ingresos por Día</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,17%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} tickFormatter={v => `$${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="revenue" fill="hsl(160,84%,39%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
          {report === "drivers" && (
            <>
              <h3 className="mb-4 text-sm font-semibold text-foreground">Entregas por Repartidor</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                      <th className="pb-3 pr-4">Repartidor</th>
                      <th className="pb-3 pr-4">Entregas</th>
                      <th className="pb-3 pr-4">Ingresos</th>
                      <th className="pb-3">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.sort((a, b) => b.totalDeliveries - a.totalDeliveries).map(d => (
                      <tr key={d.id} className="border-b border-border/30 hover:bg-muted/20">
                        <td className="py-3 pr-4 font-medium text-foreground">{d.name}</td>
                        <td className="py-3 pr-4">{d.totalDeliveries}</td>
                        <td className="py-3 pr-4">{formatCurrency(d.revenue)}</td>
                        <td className="py-3">⭐ {d.rating}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default Reports;
