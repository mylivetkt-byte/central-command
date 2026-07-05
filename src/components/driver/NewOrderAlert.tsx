import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Wallet, Clock, X, Check, Bike } from "lucide-react";

interface AlertOrder {
  id: string;
  order_id?: string;
  pickup_address?: string;
  delivery_address?: string;
  amount?: number;
  commission?: number;
  estimated_time?: number | null;
  zone?: string | null;
  distance_km?: number | null;
}

interface Props {
  order: AlertOrder | null;
  timeoutSeconds?: number;
  onAccept: () => void;
  onReject: () => void;
  onTimeout?: () => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

// Generates a repeating "ding-ding" tone using WebAudio — no external asset needed
function useAlertSound(active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;

    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    ctxRef.current = ctx;

    const beep = (freq: number, when: number, dur = 0.18) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(0.35, when + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(when);
      osc.stop(when + dur + 0.02);
    };

    const play = () => {
      const t = ctx.currentTime;
      beep(880, t);
      beep(1320, t + 0.22);
    };

    // Resume if suspended (mobile autoplay policies)
    ctx.resume?.().catch(() => {});
    play();
    intervalRef.current = window.setInterval(play, 1400);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      ctx.close().catch(() => {});
      ctxRef.current = null;
    };
  }, [active]);
}

function useVibration(active: boolean) {
  useEffect(() => {
    if (!active || !("vibrate" in navigator)) return;
    const pattern = [400, 200, 400, 200, 600];
    navigator.vibrate(pattern);
    const id = window.setInterval(() => navigator.vibrate(pattern), 1800);
    return () => {
      window.clearInterval(id);
      navigator.vibrate(0);
    };
  }, [active]);
}

const NewOrderAlert = ({ order, timeoutSeconds = 30, onAccept, onReject, onTimeout }: Props) => {
  const active = !!order;
  const [remaining, setRemaining] = useState(timeoutSeconds);

  useAlertSound(active);
  useVibration(active);

  useEffect(() => {
    if (!active) return;
    setRemaining(timeoutSeconds);
    const start = Date.now();
    const id = window.setInterval(() => {
      const left = Math.max(0, timeoutSeconds - Math.floor((Date.now() - start) / 1000));
      setRemaining(left);
      if (left <= 0) {
        window.clearInterval(id);
        (onTimeout ?? onReject)();
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [active, timeoutSeconds, onReject, onTimeout]);

  const pct = active ? remaining / timeoutSeconds : 0;
  const R = 46;
  const C = 2 * Math.PI * R;

  return (
    <AnimatePresence>
      {active && order && (
        <motion.div
          key="new-order-alert"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-xl flex items-end sm:items-center justify-center p-4"
        >
          <motion.div
            initial={{ y: 60, scale: 0.96 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 260 }}
            className="w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 rounded-[36px] border border-indigo-500/30 shadow-[0_0_80px_-10px_rgba(99,102,241,0.5)] overflow-hidden"
          >
            {/* Timer ring */}
            <div className="relative pt-6 pb-2 flex flex-col items-center">
              <div className="relative h-28 w-28">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r={R} stroke="rgba(255,255,255,0.08)" strokeWidth="6" fill="none" />
                  <motion.circle
                    cx="50" cy="50" r={R}
                    stroke={remaining <= 10 ? "#ef4444" : "#6366f1"}
                    strokeWidth="6" fill="none" strokeLinecap="round"
                    strokeDasharray={C}
                    strokeDashoffset={C * (1 - pct)}
                    style={{ transition: "stroke-dashoffset 0.2s linear, stroke 0.3s" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Bike className="h-6 w-6 text-indigo-400 mb-0.5" />
                  <span className={`text-3xl font-black leading-none ${remaining <= 10 ? "text-red-400" : "text-white"}`}>{remaining}</span>
                  <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">seg</span>
                </div>
              </div>
              <p className="mt-3 text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] animate-pulse">🔔 Nuevo pedido</p>
            </div>

            <div className="px-6 pb-6 space-y-5">
              {/* Earnings */}
              <div className="bg-white/5 border border-white/5 rounded-3xl p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-indigo-500/15 flex items-center justify-center">
                    <Wallet className="h-6 w-6 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Ganancia</p>
                    <p className="text-2xl font-black text-white tracking-tight">{fmt(Number(order.commission ?? 0))}</p>
                  </div>
                </div>
                {order.estimated_time != null && (
                  <div className="flex items-center gap-1.5 text-white/60">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-xs font-black">{order.estimated_time} min</span>
                  </div>
                )}
              </div>

              {/* Route */}
              <div className="relative space-y-4">
                <div className="absolute left-[7px] top-3 bottom-3 w-[2px] bg-white/5" />
                <div className="flex items-start gap-4 relative">
                  <div className="h-3.5 w-3.5 rounded-full bg-emerald-500 border-4 border-slate-900 mt-1" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-0.5">Recogida</p>
                    <p className="text-sm font-bold text-white/80 leading-snug truncate">{order.pickup_address || "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 relative">
                  <div className="h-3.5 w-3.5 rounded-full bg-indigo-500 border-4 border-slate-900 mt-1" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-0.5">Entrega</p>
                    <p className="text-sm font-bold text-white/80 leading-snug truncate">{order.delivery_address || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-5 gap-3 pt-1">
                <button
                  onClick={onReject}
                  className="col-span-2 h-14 rounded-2xl bg-white/5 border border-white/5 text-white/60 font-black text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <X className="h-4 w-4" /> Rechazar
                </button>
                <button
                  onClick={onAccept}
                  className="col-span-3 h-14 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/40 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Check className="h-5 w-5" /> Aceptar pedido
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NewOrderAlert;