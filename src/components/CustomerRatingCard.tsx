import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Star, CheckCircle2, Loader2 } from "lucide-react";

interface Props {
  orderId: string;
  driverName?: string | null;
  existing?: { score: number; comment?: string | null; tip_amount?: number | null } | null;
  onRated?: () => void;
}

const TIP_PRESETS = [0, 2000, 5000, 10000];

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

export default function CustomerRatingCard({ orderId, driverName, existing, onRated }: Props) {
  const [score, setScore] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [tip, setTip] = useState(0);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(!!existing);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (existing) setDone(true); }, [existing]);

  const base = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  const submit = async () => {
    if (score < 1 || sending) return;
    setSending(true); setError(null);
    try {
      const res = await fetch(`${base}/functions/v1/public-tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          action: "rate",
          order_id: orderId,
          score,
          comment: comment.trim() || null,
          tip_amount: tip,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json?.error || "error"); return; }
      setDone(true);
      onRated?.();
    } catch {
      setError("network");
    } finally {
      setSending(false);
    }
  };

  if (done) {
    const finalScore = existing?.score ?? score;
    return (
      <motion.div
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="bg-white/95 backdrop-blur-3xl rounded-[28px] p-6 shadow-[0_25px_60px_rgba(0,0,0,0.7)] text-center"
      >
        <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
        <p className="text-sm font-black text-slate-900 mb-1">¡Gracias por calificar!</p>
        <div className="flex justify-center gap-1 my-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} className={`h-5 w-5 ${n <= finalScore ? "text-amber-400 fill-amber-400" : "text-slate-200"}`} />
          ))}
        </div>
        {(existing?.tip_amount ?? tip) > 0 && (
          <p className="text-xs text-emerald-600 font-semibold">Propina: {fmt(existing?.tip_amount ?? tip)}</p>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      className="bg-white/95 backdrop-blur-3xl rounded-[28px] p-6 shadow-[0_25px_60px_rgba(0,0,0,0.7)]"
    >
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Califica tu entrega</p>
      <p className="text-sm font-bold text-slate-900 mb-4">
        ¿Cómo estuvo {driverName || "el mensajero"}?
      </p>

      <div className="flex justify-center gap-2 mb-5" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = n <= (hover || score);
          return (
            <button
              key={n}
              onMouseEnter={() => setHover(n)}
              onClick={() => setScore(n)}
              className="p-1 active:scale-90 transition-transform"
              aria-label={`${n} estrellas`}
            >
              <Star className={`h-8 w-8 ${active ? "text-amber-400 fill-amber-400" : "text-slate-200"}`} />
            </button>
          );
        })}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value.slice(0, 500))}
        placeholder="Cuéntanos algo (opcional)"
        rows={2}
        className="w-full text-sm bg-slate-50 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4 resize-none"
      />

      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Deja una propina</p>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {TIP_PRESETS.map((amt) => (
          <button
            key={amt}
            onClick={() => setTip(amt)}
            className={`py-2 rounded-xl text-xs font-bold transition-colors ${
              tip === amt
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {amt === 0 ? "Sin" : fmt(amt)}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-red-500 mb-2">Error: {error}</p>}

      <button
        onClick={submit}
        disabled={score < 1 || sending}
        className="w-full py-3 rounded-xl bg-indigo-600 text-white text-sm font-black disabled:opacity-30 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {sending ? "Enviando..." : "Enviar calificación"}
      </button>
    </motion.div>
  );
}