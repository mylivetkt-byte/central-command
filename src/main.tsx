import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { APP_VERSION } from "./constants/appVersion";

// PWA: Unregister service workers in iframe/preview contexts
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
}

// Kill-switch: si la versión bundleada (lo que sirvió el SW viejo cacheado)
// no coincide con la versión real publicada, forzamos limpieza + reload UNA sola vez.
// Así los conductores con el SW viejo (que solo chequeaba cada 1h) se actualizan
// al abrir la app, sin tener que borrar caché manualmente.
if (!isPreviewHost && !isInIframe && "serviceWorker" in navigator) {
  const RELOAD_FLAG = "gomoto:force-reload-done";
  fetch("/version.json", { cache: "no-store" })
    .then((res) => (res.ok ? res.json() : null))
    .then(async (data) => {
      if (!data?.version) return;
      if (data.version === APP_VERSION) {
        sessionStorage.removeItem(RELOAD_FLAG);
        return;
      }
      if (sessionStorage.getItem(RELOAD_FLAG)) return; // evita loop
      sessionStorage.setItem(RELOAD_FLAG, "1");
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {}
      window.location.reload();
    })
    .catch(() => {});
}

createRoot(document.getElementById("root")!).render(<App />);
