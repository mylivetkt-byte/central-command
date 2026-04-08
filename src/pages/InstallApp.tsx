import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Smartphone, CheckCircle } from "lucide-react";

const InstallApp = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-8">
        {/* Logo / Icon */}
        <div className="mx-auto w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-2xl shadow-blue-500/30">
          <Smartphone className="w-12 h-12 text-white" />
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            LogiSmart Conductor
          </h1>
          <p className="text-blue-200/70 text-sm leading-relaxed">
            Instala la app en tu teléfono para recibir pedidos, navegar rutas y gestionar entregas — incluso sin conexión.
          </p>
        </div>

        {isInstalled ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-emerald-400">
              <CheckCircle className="w-6 h-6" />
              <span className="font-semibold">¡App instalada!</span>
            </div>
            <Button
              className="w-full h-12 text-base bg-blue-600 hover:bg-blue-500"
              onClick={() => window.location.href = "/driver-login"}
            >
              Abrir App del Conductor
            </Button>
          </div>
        ) : deferredPrompt ? (
          <Button
            onClick={handleInstall}
            className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-400 hover:to-cyan-300 text-white shadow-xl shadow-blue-500/25 border-0"
          >
            <Download className="w-5 h-5 mr-2" />
            Instalar App
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-left space-y-3">
              <p className="text-white font-medium text-sm">Para instalar:</p>
              <ol className="text-blue-200/70 text-sm space-y-2 list-decimal list-inside">
                <li><strong className="text-white">Android:</strong> Toca el menú ⋮ → "Instalar app"</li>
                <li><strong className="text-white">iPhone:</strong> Toca <span className="inline-block">⬆️</span> → "Añadir a inicio"</li>
              </ol>
            </div>
            <Button
              variant="outline"
              className="w-full h-12 text-base border-white/20 text-white hover:bg-white/10"
              onClick={() => window.location.href = "/driver-login"}
            >
              Continuar en navegador
            </Button>
          </div>
        )}

        <p className="text-blue-200/30 text-xs">
          v1.0 · LogiSmart Pulse
        </p>
      </div>
    </div>
  );
};

export default InstallApp;
