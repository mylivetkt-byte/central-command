import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Download, Smartphone, X } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const isStandaloneMode = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  window.matchMedia?.("(display-mode: fullscreen)").matches ||
  Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

export function PWAInstallButton() {
  const location = useLocation();
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  const isAndroid = useMemo(() => /Android/i.test(navigator.userAgent), []);
  const isMobile = useMemo(() => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent), []);
  const bottomPosition = location.pathname === "/driver" ? "bottom-24" : "bottom-4";

  useEffect(() => {
    if (isStandaloneMode()) {
      setInstalled(true);
      return;
    }

    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      setShowBanner(true);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setShowBanner(false);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);

    const fallbackTimer = window.setTimeout(() => {
      if (!isStandaloneMode() && (isAndroid || isMobile)) {
        setShowBanner(true);
      }
    }, 1200);

    return () => {
      window.clearTimeout(fallbackTimer);
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, [isAndroid, isMobile]);

  const handleInstall = async () => {
    if (!promptEvent) {
      setShowHelp(true);
      return;
    }

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
      setShowBanner(false);
    }
    setPromptEvent(null);
  };

  if (installed || dismissed || !showBanner) return null;

  return (
    <>
      <div className={`fixed left-3 right-3 ${bottomPosition} z-[70] md:left-auto md:right-5 md:w-80`}>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground shadow-lg">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-tight">Instalar app</p>
            <p className="text-xs text-muted-foreground">Agrega GoMoto a tu pantalla de inicio.</p>
          </div>
          <button
            type="button"
            onClick={handleInstall}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground"
            aria-label="Instalar app"
          >
            <Download className="mr-1.5 h-4 w-4" />
            Instalar
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground"
            aria-label="Cerrar aviso de instalación"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showHelp && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/70 p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-background p-5 text-foreground shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Smartphone className="h-5 w-5" />
              </div>
              <h2 className="text-base font-bold">Instalar en Android</h2>
            </div>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li>1. Abre el sitio publicado en Chrome.</li>
              <li>2. Toca el menú de tres puntos ⋮.</li>
              <li>3. Selecciona “Instalar app” o “Agregar a pantalla principal”.</li>
            </ol>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="mt-5 h-11 w-full rounded-md bg-primary text-sm font-bold text-primary-foreground"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}