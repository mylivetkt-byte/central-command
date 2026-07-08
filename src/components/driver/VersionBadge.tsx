import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { APP_VERSION } from "@/constants/appVersion";
import { Info } from "lucide-react";

const CHANGELOG = [
  {
    version: "0.2.2",
    changes: [
      "Optimización de interfaz para dispositivos móviles",
      "Menú de navegación lateral adaptativo con botón hamburguesa",
    ],
  },
  {
    version: "0.2.1",
    changes: [
      "Diseño en modo claro para la central de comando",
      "Solución de redirecciones al acceder desde la PWA",
      "Actualización de caché PWA automática con notificaciones",
    ],
  },
  {
    version: "0.2.0",
    changes: [
      "Despacho dirigido: asignar pedido directamente a un mensajero específico",
      "Badge de versión visible en la pestaña Cuenta",
      "Corrección de estadísticas del día usando hora local",
      "Mejora de contraste en Historial de entregas",
    ],
  },
  {
    version: "0.1.0",
    changes: [
      "Lanzamiento inicial de la app del conductor",
      "Estadísticas del día usando hora local",
      "Mejora de contraste en Historial de entregas",
      "Agregado badge de versión con registro de cambios",
    ],
  },
];

export const VersionBadge = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 bg-slate-100 rounded-2xl border border-slate-200 p-3 text-slate-500 text-xs font-medium hover:bg-slate-200 transition-colors active:scale-95"
        aria-label="Versión de la aplicación"
      >
        <Info className="h-3.5 w-3.5" />
        Versión {APP_VERSION} — Ver cambios
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registro de cambios</DialogTitle>
            <DialogDescription>Historial de actualizaciones de la app</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2 max-h-72 overflow-y-auto pr-1">
            {CHANGELOG.map((entry) => (
              <div key={entry.version}>
                <p className="text-xs font-black text-slate-800 mb-1">v{entry.version}</p>
                <ul className="space-y-1">
                  {entry.changes.map((c) => (
                    <li key={c} className="text-xs text-slate-600 flex items-start gap-1.5">
                      <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <DialogClose asChild>
            <button className="mt-4 w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors">
              Cerrar
            </button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </>
  );
};
