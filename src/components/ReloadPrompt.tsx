import { useRegisterSW } from "virtual:pwa-register/react";
import { useEffect } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Opcional: chequear actualizaciones periódicamente
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000); // 1 hora
      }
    },
    onRegisterError(error) {
      console.log("SW registration error", error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      toast("Nueva versión disponible", {
        description: "Se ha encontrado una nueva versión de la aplicación.",
        duration: 20000,
        position: "top-center",
        icon: <RefreshCw className="h-5 w-5 text-indigo-500 animate-spin" />,
        action: {
          label: "Actualizar ahora",
          onClick: () => updateServiceWorker(true),
        },
      });
    }
  }, [needRefresh, updateServiceWorker]);

  return null;
}
