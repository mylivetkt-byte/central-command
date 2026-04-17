import { useState } from "react";
import { Layers } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface MapStyle {
  id: string;
  label: string;
  emoji: string;
  url: string;
  preview: string; // color para el thumbnail
}

export const MAP_STYLES: MapStyle[] = [
  {
    id: "dark",
    label: "Oscuro",
    emoji: "🌑",
    url: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    preview: "#0f172a",
  },
  {
    id: "voyager",
    label: "Estándar",
    emoji: "🗺️",
    url: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
    preview: "#e8f0f7",
  },
  {
    id: "positron",
    label: "Claro",
    emoji: "☀️",
    url: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    preview: "#f5f5f5",
  },
  {
    id: "satellite",
    label: "Satélite",
    emoji: "🛰️",
    url: "https://api.maptiler.com/maps/hybrid/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL",
    preview: "#1a2f1a",
  },
  {
    id: "topo",
    label: "Terreno",
    emoji: "⛰️",
    url: "https://tiles.openfreemap.org/styles/liberty",
    preview: "#d4e8c2",
  },
  {
    id: "streets",
    label: "Calles",
    emoji: "🛣️",
    url: "https://basemaps.cartocdn.com/gl/voyager-nolabels-gl-style/style.json",
    preview: "#fff9f0",
  },
];

// Hook para persistir el estilo elegido
export const useMapStyle = (defaultId = "dark") => {
  const saved = typeof window !== "undefined"
    ? localStorage.getItem("preferred-map-style") ?? defaultId
    : defaultId;
  const [styleId, setStyleId] = useState(saved);

  const setStyle = (id: string) => {
    setStyleId(id);
    localStorage.setItem("preferred-map-style", id);
  };

  const current = MAP_STYLES.find(s => s.id === styleId) ?? MAP_STYLES[0];
  return { styleId, current, setStyle };
};

interface MapStyleSwitcherProps {
  current: MapStyle;
  onSelect: (style: MapStyle) => void;
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  dark?: boolean; // fondo oscuro vs claro
}

const positionClasses: Record<string, string> = {
  "top-left":     "top-3 left-3",
  "top-right":    "top-3 right-3",
  "bottom-left":  "bottom-3 left-3",
  "bottom-right": "bottom-3 right-3",
};

export const MapStyleSwitcher = ({
  current,
  onSelect,
  position = "top-right",
  dark = true,
}: MapStyleSwitcherProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className={`absolute z-[1000] ${positionClasses[position]}`}>
      {/* Botón principal */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-sm px-3 py-2 text-xs font-bold shadow-lg transition-all active:scale-95"
        style={{
          background: dark ? "#000000" : "#ffffff",
          color: dark ? "#ffffff" : "#000000",
          border: dark ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(0,0,0,0.2)",
          backdropFilter: "blur(12px)",
        }}
      >
        <Layers className="h-3.5 w-3.5" />
        {current.emoji} {current.label}
      </button>

      {/* Panel de estilos */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute mt-2 right-0 p-2 rounded-sm shadow-2xl grid grid-cols-3 gap-2"
            style={{
              background: dark ? "#0a0a0a" : "#ffffff",
              border: dark ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(0,0,0,0.15)",
              backdropFilter: "blur(20px)",
              width: 220,
            }}
          >
            {MAP_STYLES.map(style => (
              <button
                key={style.id}
                onClick={() => { onSelect(style); setOpen(false); }}
                className="flex flex-col items-center gap-1.5 rounded-sm p-2 transition-all active:scale-95"
                style={{
                  background: current.id === style.id
                    ? (dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.05)")
                    : "transparent",
                  border: current.id === style.id
                    ? "1px solid rgba(255,255,255,0.4)"
                    : "1px solid rgba(0,0,0,0.4)",
                }}
              >
                {/* Thumbnail del estilo */}
                <div
                  className="w-14 h-10 rounded-lg overflow-hidden relative shadow-md"
                  style={{ background: style.preview }}
                >
                  {/* Líneas decorativas simulando calles */}
                  <div className="absolute inset-0 opacity-30" style={{
                    backgroundImage: `linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px),
                                      linear-gradient(0deg, rgba(255,255,255,0.4) 1px, transparent 1px)`,
                    backgroundSize: "14px 14px",
                  }} />
                  {/* Emoji grande */}
                  <div className="absolute inset-0 flex items-center justify-center text-lg">
                    {style.emoji}
                  </div>
                  {/* Check si está seleccionado */}
                  {current.id === style.id && (
                    <div className="absolute top-0.5 right-0.5 h-3.5 w-3.5 rounded-full bg-white flex items-center justify-center">
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1.5 4l1.5 1.5L6.5 2" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </div>
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: dark ? "rgba(255,255,255,0.85)" : "#374151" }}
                >
                  {style.label}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MapStyleSwitcher;
