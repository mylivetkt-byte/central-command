import { motion } from "framer-motion";
import { useEffect } from "react";

interface Props {
  onDone: () => void;
  durationMs?: number;
}

// Splash energético estilo moto — se muestra siempre al abrir la PWA del mensajero.
export default function DriverSplash({ onDone, durationMs = 1800 }: Props) {
  useEffect(() => {
    if ("vibrate" in navigator) {
      try { navigator.vibrate([30, 40, 90]); } catch {}
    }
    const t = setTimeout(onDone, durationMs);
    return () => clearTimeout(t);
  }, [onDone, durationMs]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-[9999] overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 30% 40%, #F97316 0%, #7C3AED 45%, #0B0F1A 100%)",
      }}
    >
      {/* Radial vignette top */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />

      {/* Speed lines */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 14 }).map((_, i) => {
          const top = 8 + (i * 6.2);
          const delay = 0.05 + i * 0.03;
          const w = 30 + ((i * 47) % 50);
          return (
            <motion.div
              key={i}
              initial={{ x: "-30%", opacity: 0 }}
              animate={{ x: "140%", opacity: [0, 1, 0] }}
              transition={{ duration: 0.55, delay, ease: [0.65, 0, 0.35, 1] }}
              className="absolute h-[3px] rounded-full"
              style={{
                top: `${top}%`,
                width: `${w}%`,
                background: `linear-gradient(90deg, transparent, ${i % 3 === 0 ? "#FBBF24" : "#FFFFFF"} 60%, transparent)`,
                filter: "blur(0.5px)",
                opacity: 0.75,
              }}
            />
          );
        })}
      </div>

      {/* Motorcycle silhouette rushing across */}
      <motion.div
        initial={{ x: "-60vw", rotate: -3, opacity: 0 }}
        animate={{
          x: ["-60vw", "12vw", "8vw"],
          rotate: [-3, 0, 0],
          opacity: [0, 1, 1],
        }}
        transition={{
          duration: 1.0,
          times: [0, 0.75, 1],
          ease: [0.22, 1, 0.36, 1],
        }}
        className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2"
      >
        <svg viewBox="0 0 220 120" width="280" height="150" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.4))" }}>
          <circle cx="45" cy="90" r="22" />
          <circle cx="175" cy="90" r="22" />
          <path d="M45 90 L95 45 L140 45 L175 90" />
          <path d="M95 45 L115 22 L145 22" />
          <path d="M140 45 L155 62" />
          <path d="M60 78 L75 60 L100 60" />
        </svg>
      </motion.div>

      {/* Motion blur streak behind bike */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: [0, 1, 0.4], opacity: [0, 0.6, 0] }}
        transition={{ duration: 1.0, ease: "easeOut" }}
        className="absolute top-1/2 left-0 h-2 w-full origin-left"
        style={{
          background: "linear-gradient(90deg, transparent, #FBBF24, transparent)",
          filter: "blur(6px)",
          marginTop: -4,
        }}
      />

      {/* Wordmark */}
      <motion.div
        initial={{ y: 40, opacity: 0, filter: "blur(20px)" }}
        animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
        transition={{ delay: 0.85, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="absolute bottom-[22%] left-0 right-0 flex flex-col items-center"
      >
        <h1 className="text-white text-6xl font-black tracking-[0.15em]" style={{ fontFamily: "'Space Grotesk','Inter',system-ui,sans-serif" }}>
          GO<span className="text-amber-400">MOTO</span>
        </h1>
        <motion.p
          initial={{ opacity: 0, letterSpacing: "0.1em" }}
          animate={{ opacity: 1, letterSpacing: "0.4em" }}
          transition={{ delay: 1.15, duration: 0.5 }}
          className="mt-2 text-[10px] font-black uppercase text-white/60"
        >
          Rider App
        </motion.p>
      </motion.div>

      {/* Bottom accent bar */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 1.2, duration: 0.5, ease: "easeOut" }}
        className="absolute bottom-0 left-0 h-1 w-full origin-left bg-amber-400"
      />
    </motion.div>
  );
}