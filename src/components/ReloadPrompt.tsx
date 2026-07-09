import { useRegisterSW } from "virtual:pwa-register/react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

// Chequeo frecuente de actualizaciones para que las nuevas versiones lleguen
// a los conductores en segundos (no en horas).
const UPDATE_CHECK_INTERVAL_MS = 60 * 1000; // 60s

export function ReloadPrompt() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const appliedRef = useRef(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (!r) return;
      registrationRef.current = r;
      // Chequear cada 60s
      setInterval(() => { r.update().catch(() => {}); }, UPDATE_CHECK_INTERVAL_MS);
      // Chequear apenas la app vuelve a foco o recupera conexión
      const check = () => { r.update().catch(() => {}); };
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
      window.addEventListener("online", check);
      window.addEventListener("focus", check);
      // Chequear al arrancar
      check();
    },
    onRegisterError(error) {
      console.log("SW registration error", error);
    },
  });

  useEffect(() => {
    if (needRefresh && !appliedRef.current) {
      appliedRef.current = true;
      toast("Actualizando a la nueva versión…", {
        description: "La app se recargará en unos segundos.",
        duration: 3000,
        position: "top-center",
        icon: <RefreshCw className="h-5 w-5 text-indigo-500 animate-spin" />,
      });
      // Auto-actualizar sin esperar acción del usuario
      setTimeout(() => { updateServiceWorker(true); }, 1500);
    }
  }, [needRefresh, updateServiceWorker]);

  return null;
}
