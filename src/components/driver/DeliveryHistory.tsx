import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Package, TrendingUp, Calendar, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface HistoryDelivery {
  id: string;
  order_id: string;
  customer_name: string;
  delivery_address: string;
  commission: number;
  amount: number;
  status: string;
  delivered_at: string | null;
  created_at: string;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

const fmtTime = (s: string) =>
  new Date(s).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

const fmtDate = (s: string) => {
  const d = new Date(s);
  const today = new Date();
  const yest  = new Date(today); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoy";
  if (d.toDateString() === yest.toDateString())  return "Ayer";
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
};

const startOf = (period: "day"|"week"|"month") => {
  const d = new Date();
  if (period === "day")   { d.setHours(0,0,0,0); }
  if (period === "week")  { d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); }
  if (period === "month") { d.setDate(1); d.setHours(0,0,0,0); }
  return d;
};

type Period = "day" | "week" | "month" | "all";

const DeliveryHistory = () => {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState<HistoryDelivery[]>([]);
  const [loading, setLoading]       = useState(true);
  const [period, setPeriod]         = useState<Period>("week");
  const [page, setPage]             = useState(1);
  const PAGE_SIZE = 15;

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("deliveries")
      .select("id,order_id,customer_name,delivery_address,commission,amount,status,delivered_at,created_at")
      .eq("driver_id", user.id)
      .in("status", ["entregado", "cancelado"])
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => { setDeliveries(data || []); setLoading(false); });
  }, [user]);

  const filtered = deliveries.filter(d => {
    if (period === "all") return true;
    const cutoff = startOf(period as "day"|"week"|"month");
    return new Date(d.delivered_at || d.created_at) >= cutoff;
  });

  const completed  = filtered.filter(d => d.status === "entregado");
  const cancelled  = filtered.filter(d => d.status === "cancelado");
  const earnings   = completed.reduce((s, d) => s + Number(d.commission), 0);
  const displayed  = filtered.slice(0, page * PAGE_SIZE);

  if (loading) return (
    <div className="space-y-3 animate-pulse px-4">
      {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-white/5" />)}
    </div>
  );

  return (
    <div className="space-y-4 px-4">

      {/* Filtro de período */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-2xl border border-white/5">
        {(["day","week","month","all"] as Period[]).map(p => (
          <button key={p} onClick={() => { setPeriod(p); setPage(1); }}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              period === p ? "bg-indigo-600 text-white shadow-sm" : "text-white/40 hover:text-white/60"
            }`}>
            {p === "day" ? "Hoy" : p === "week" ? "Semana" : p === "month" ? "Mes" : "Todo"}
          </button>
        ))}
      </div>

      {/* Resumen del período */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
          <p className="text-lg font-black text-emerald-400 leading-none">{fmt(earnings)}</p>
          <p className="text-[9px] text-white/40 mt-1.5 flex items-center justify-center gap-1 uppercase tracking-wider font-bold">
            <TrendingUp className="h-3 w-3" /> Ganancias
          </p>
        </div>
        <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-3 text-center">
          <p className="text-lg font-black text-indigo-400 leading-none">{completed.length}</p>
          <p className="text-[9px] text-white/40 mt-1.5 flex items-center justify-center gap-1 uppercase tracking-wider font-bold">
            <CheckCircle className="h-3 w-3" /> Entregados
          </p>
        </div>
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-3 text-center">
          <p className="text-lg font-black text-red-400 leading-none">{cancelled.length}</p>
          <p className="text-[9px] text-white/40 mt-1.5 flex items-center justify-center gap-1 uppercase tracking-wider font-bold">
            <Package className="h-3 w-3" /> Cancelados
          </p>
        </div>
      </div>

      {/* Lista */}
      {displayed.length === 0 ? (
        <div className="text-center py-16">
          <Package className="h-10 w-10 text-white/20 mx-auto mb-2" />
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Sin entregas en este período</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {displayed.map((d, i) => (
              <motion.div key={d.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                className="flex items-center gap-3 p-4 rounded-2xl bg-slate-900 border border-white/5">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                  d.status === "entregado" ? "bg-emerald-500/10" : "bg-red-500/10"
                }`}>
                  {d.status === "entregado"
                    ? <CheckCircle className="h-4 w-4 text-emerald-400" />
                    : <Package className="h-4 w-4 text-red-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-white truncate">{d.customer_name}</p>
                    <span className="text-sm font-black text-emerald-400 shrink-0 ml-2">
                      {d.status === "entregado" ? fmt(Number(d.commission)) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-white/60 truncate flex-1">{d.delivery_address}</span>
                    <span className="text-[9px] text-white/40 shrink-0 flex items-center gap-0.5">
                      <Calendar className="h-2.5 w-2.5" />
                      {fmtDate(d.delivered_at || d.created_at)}
                      <Clock className="h-2.5 w-2.5 ml-1" />
                      {fmtTime(d.delivered_at || d.created_at)}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Cargar más */}
          {filtered.length > displayed.length && (
            <button onClick={() => setPage(p => p + 1)}
              className="w-full py-4 text-xs font-black text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest">
              Ver {Math.min(PAGE_SIZE, filtered.length - displayed.length)} más...
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default DeliveryHistory;
