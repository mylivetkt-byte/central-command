import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Download, FileText, Table, TrendingUp, Users, Package } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const tooltipStyle = { background: "hsl(222,47%,9%)", border: "1px solid hsl(217,33%,17%)", borderRadius: 8, color: "hsl(210,40%,96%)" };

type DateFilter = "hoy" | "ayer" | "semana" | "mes";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

// ── Exportar CSV real ──────────────────────────────────────────────────────
const downloadCSV = (rows: Record<string, any>[], filename: string) => {
  if (!rows.length) { toast.error("Sin datos para exportar"); return; }
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map(r =>
      headers.map(h => {
        const val = r[h] ?? "";
        return typeof val === "string" && val.includes(",") ? `"${val}"` : val;
      }).join(",")
    ),
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM para Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast.success(`✅ ${filename} descargado`);
};

const Reports = () => {
  const [filter, setFilter] = useState<DateFilter>("semana");
  const [report, setReport] = useState<"deliveries" | "revenue" | "drivers">("deliveries");

  const { data: deliveries = [], isLoading: loadingD } = useQuery({
    queryKey: ["reports-deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deliveries").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: drivers = [], isLoading: loadingDrv } = useQuery({
    queryKey: ["reports-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("driver_profiles").select("*, profiles(full_name)");
      if (error) throw error;
      return data || [];
    },
  });

  // ── Calcular rango de fechas según filtro ─────────────────────────────────
  const getRange = (): { from: Date; to: Date; days: number } => {
    const now = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    if (filter === "hoy")   return { from: today, to: tomorrow, days: 1 };
    if (filter === "ayer")  {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      return { from: y, to: today, days: 1 };
    }
    if (filter === "semana") { const f = new Date(today); f.setDate(f.getDate() - 6); return { from: f, to: tomorrow, days: 7 }; }
    const f = new Date(today); f.setDate(f.getDate() - 29);
    return { from: f, to: tomorrow, days: 30 };
  };

  const range = getRange();

  const filteredDeliveries = deliveries.filter((d: any) => {
    const c = new Date(d.created_at);
    return c >= range.from && c < range.to;
  });

  // Datos para gráficas por día
  const chartData = Array.from({ length: range.days }, (_, i) => {
    const date = new Date(range.from);
    date.setDate(date.getDate() + i);
    const next = new Date(date); next.setDate(next.getDate() + 1);
    const day = filteredDeliveries.filter((d: any) => {
      const c = new Date(d.created_at);
      return c >= date && c < next;
    });
    return {
      date: date.toLocaleDateString("es-CO", { month: "short", day: "numeric" }),
      pedidos: day.length,
      ingresos: day.filter((d: any) => d.status === "entregado").reduce((s: number, d: any) => s + Number(d.amount || 0), 0),
      comisiones: day.filter((d: any) => d.status === "entregado").reduce((s: number, d: any) => s + Number(d.commission || 0), 0),
    };
  });

  // Totales del período
  const totals = {
    pedidos:    filteredDeliveries.length,
    entregados: filteredDeliveries.filter((d: any) => d.status === "entregado").length,
    cancelados: filteredDeliveries.filter((d: any) => d.status === "cancelado").length,
    ingresos:   filteredDeliveries.filter((d: any) => d.status === "entregado").reduce((s: number, d: any) => s + Number(d.amount || 0), 0),
    comisiones: filteredDeliveries.filter((d: any) => d.status === "entregado").reduce((s: number, d: any) => s + Number(d.commission || 0), 0),
  };
  const tasaEntrega = totals.pedidos > 0 ? Math.round((totals.entregados / totals.pedidos) * 100) : 0;

  // ── Exportar ──────────────────────────────────────────────────────────────
  const exportDeliveriesCSV = () => {
    const rows = filteredDeliveries.map((d: any) => ({
      "Pedido":       d.order_id,
      "Cliente":      d.customer_name,
      "Teléfono":     d.customer_phone || "",
      "Recogida":     d.pickup_address,
      "Entrega":      d.delivery_address,
      "Zona":         d.zone || "",
      "Estado":       d.status,
      "Valor":        d.amount,
      "Comisión":     d.commission,
      "Tiempo est.":  d.estimated_time || "",
      "Creado":       new Date(d.created_at).toLocaleString("es-CO"),
      "Actualizado":  new Date(d.updated_at).toLocaleString("es-CO"),
    }));
    downloadCSV(rows, `pedidos_${filter}_${new Date().toISOString().slice(0,10)}.csv`);
  };

  const exportDriversCSV = () => {
    const rows = (drivers as any[]).map((d: any) => ({
      "Repartidor":       d.profiles?.full_name || "Sin nombre",
      "Estado":           d.status || "inactivo",
      "Zona":             d.zone || "",
      "Entregas totales": d.total_deliveries || 0,
      "Rating":           d.rating || 0,
      "% Aceptación":     d.acceptance_rate || 0,
      "% Cancelación":    d.cancellation_rate || 0,
      "Carga actual":     d.current_load || 0,
    }));
    downloadCSV(rows, `repartidores_${new Date().toISOString().slice(0,10)}.csv`);
  };

  if (loadingD || loadingDrv) {
    return (
      <DashboardLayout>
        <div className="flex justify-center p-20">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reportes</h1>
            <p className="text-sm text-muted-foreground">Informes operativos con exportación real a CSV</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportDeliveriesCSV} className="flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/20 transition-colors">
              <Table className="h-3.5 w-3.5" /> Exportar pedidos
            </button>
            <button onClick={exportDriversCSV} className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
              <Download className="h-3.5 w-3.5" /> Exportar repartidores
            </button>
          </div>
        </div>

        {/* Filtros de período */}
        <div className="flex gap-2 flex-wrap">
          {(["hoy", "ayer", "semana", "mes"] as DateFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold capitalize transition-colors ${
                filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "hoy" ? "Hoy" : f === "ayer" ? "Ayer" : f === "semana" ? "Últimos 7 días" : "Últimos 30 días"}
            </button>
          ))}
        </div>

        {/* Resumen del período */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: "Pedidos",     value: totals.pedidos,                     color: "text-foreground" },
            { label: "Entregados",  value: totals.entregados,                  color: "text-accent" },
            { label: "Cancelados",  value: totals.cancelados,                  color: "text-destructive" },
            { label: "Ingresos",    value: formatCurrency(totals.ingresos),    color: "text-accent" },
            { label: "Tasa entrega",value: `${tasaEntrega}%`,                  color: tasaEntrega >= 80 ? "text-accent" : "text-warning" },
          ].map(k => (
            <div key={k.label} className="glass-card p-4 text-center">
              <p className={`text-xl font-extrabold ${k.color}`}>{k.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{k.label}</p>
            </div>
          ))}
        </div>

        {/* Selector de vista */}
        <div className="flex gap-2">
          {([
            ["deliveries", "📦 Pedidos por día",    Package],
            ["revenue",    "💰 Ingresos por día",   TrendingUp],
            ["drivers",    "🧑‍💼 Repartidores",       Users],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setReport(key as any)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                report === key ? "bg-secondary text-secondary-foreground" : "bg-muted/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Gráfico o tabla */}
        <motion.div key={`${report}-${filter}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">

          {report === "deliveries" && (
            <>
              <h3 className="mb-4 text-sm font-semibold text-foreground">Pedidos por Día</h3>
              {chartData.some(d => d.pedidos > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,17%)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="pedidos" fill="hsl(217,91%,60%)" radius={[6,6,0,0]} name="Pedidos" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                  Sin pedidos en el período seleccionado
                </div>
              )}
            </>
          )}

          {report === "revenue" && (
            <>
              <h3 className="mb-4 text-sm font-semibold text-foreground">
                Ingresos por Día · Comisiones pagadas a mensajeros
              </h3>
              {chartData.some(d => d.ingresos > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,17%)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="ingresos"   fill="hsl(160,84%,39%)"  radius={[6,6,0,0]} name="Ingresos"   />
                    <Bar dataKey="comisiones" fill="hsl(217,91%,60%)" radius={[6,6,0,0]} name="Comisiones" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                  Sin ingresos en el período seleccionado
                </div>
              )}
            </>
          )}

          {report === "drivers" && (
            <>
              <h3 className="mb-4 text-sm font-semibold text-foreground">Repartidores — Todos los tiempos</h3>
              {drivers.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                  Sin repartidores registrados
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                        <th className="pb-3 pr-4">#</th>
                        <th className="pb-3 pr-4">Repartidor</th>
                        <th className="pb-3 pr-4">Entregas</th>
                        <th className="pb-3 pr-4">Rating</th>
                        <th className="pb-3 pr-4">Aceptación</th>
                        <th className="pb-3 pr-4">Cancelación</th>
                        <th className="pb-3">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...(drivers as any[])]
                        .sort((a: any, b: any) => (b.total_deliveries || 0) - (a.total_deliveries || 0))
                        .map((d: any, i: number) => (
                          <tr key={d.id} className="border-b border-border/30 hover:bg-muted/20">
                            <td className="py-3 pr-4 font-bold text-primary">{i + 1}</td>
                            {/* BUG FIX: d.profiles?.full_name no d.user?.full_name */}
                            <td className="py-3 pr-4 font-medium text-foreground">{d.profiles?.full_name || "Sin nombre"}</td>
                            <td className="py-3 pr-4">{d.total_deliveries || 0}</td>
                            <td className="py-3 pr-4 text-amber-500">⭐ {d.rating || "—"}</td>
                            <td className="py-3 pr-4 text-accent">{d.acceptance_rate || 0}%</td>
                            <td className="py-3 pr-4 text-destructive">{d.cancellation_rate || 0}%</td>
                            <td className="py-3 capitalize text-muted-foreground">{d.status || "inactivo"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </motion.div>

        {/* Tabla detallada de pedidos del período */}
        {filteredDeliveries.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">
                Pedidos del período ({filteredDeliveries.length})
              </h3>
              <button onClick={exportDeliveriesCSV} className="flex items-center gap-1 text-xs text-accent hover:underline">
                <Download className="h-3 w-3" /> Descargar CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 text-left text-muted-foreground">
                    <th className="pb-2 pr-3">Pedido</th>
                    <th className="pb-2 pr-3">Cliente</th>
                    <th className="pb-2 pr-3">Estado</th>
                    <th className="pb-2 pr-3">Valor</th>
                    <th className="pb-2 pr-3">Comisión</th>
                    <th className="pb-2">Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeliveries.slice(0, 20).map((d: any) => (
                    <tr key={d.id} className="border-b border-border/20 hover:bg-muted/20">
                      <td className="py-2 pr-3 font-mono font-bold text-primary">#{d.order_id}</td>
                      <td className="py-2 pr-3 text-foreground">{d.customer_name}</td>
                      <td className="py-2 pr-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          d.status === "entregado" ? "bg-accent/10 text-accent" :
                          d.status === "cancelado" ? "bg-destructive/10 text-destructive" :
                          "bg-muted text-muted-foreground"
                        }`}>{d.status}</span>
                      </td>
                      <td className="py-2 pr-3">{formatCurrency(Number(d.amount || 0))}</td>
                      <td className="py-2 pr-3 text-accent">{formatCurrency(Number(d.commission || 0))}</td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(d.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredDeliveries.length > 20 && (
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  Mostrando 20 de {filteredDeliveries.length} — descarga el CSV para ver todos
                </p>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Reports;
