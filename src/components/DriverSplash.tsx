import { motion } from "framer-motion";
import { useEffect } from "react";
import { Bike } from "lucide-react";

interface Props {
  onDone: () => void;
  durationMs?: number;
}

// Splash minimalista y rápido para la PWA del mensajero.
// Sin vibración, sin animaciones pesadas, se cierra siempre a tiempo.
export default function DriverSplash({ onDone, durationMs = 1100 }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, durationMs);
    return () => clearTimeout(t);
  }, [onDone, durationMs]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950"
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center gap-4"
      >
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-500/30">
          <Bike className="h-10 w-10 text-slate-950" strokeWidth={2.5} />
        </div>
        <div className="flex flex-col items-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            GO<span className="text-amber-400">MOTO</span>
          </h1>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/40">
            Rider
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}