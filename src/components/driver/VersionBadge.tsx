import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { APP_VERSION } from "@/constants/appVersion";
import { Info } from "lucide-react";

// Simple static changelog (can be extended later)
const CHANGELOG = `
Version 0.1.0
- Initial release of driver app
- Added local‑date handling for "Hoy" stats
- Improved UI contrast in Delivery History
- Added version badge (this component)
`;

export const VersionBadge = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Badge placed in bottom‑right corner */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 flex items-center gap-1 bg-slate-800/80 text-white text-xs font-medium py-1 px-2 rounded-full hover:bg-slate-700 transition-colors"
        aria-label="Versión de la aplicación"
      >
        <Info className="h-3 w-3" /> v{APP_VERSION}
      </button>

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Versión {APP_VERSION}</DialogTitle>
            <DialogDescription>Registro de cambios</DialogDescription>
          </DialogHeader>
          <pre className="whitespace-pre-wrap text-sm mt-2">
            {CHANGELOG}
          </pre>
          <DialogClose asChild>
            <button className="mt-4 w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
              Cerrar
            </button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </>
  );
};
