import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, Share2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

interface ShareTrackingDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orderId: string;
  customerName?: string;
  customerPhone?: string;
}

export function ShareTrackingDialog({
  open, onOpenChange, orderId, customerName, customerPhone,
}: ShareTrackingDialogProps) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/#/track/${orderId}`;
  const message = `Hola${customerName ? " " + customerName : ""} 👋, sigue tu pedido #${orderId} en tiempo real: ${url}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Enlace copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const shareWhatsApp = () => {
    const phone = (customerPhone || "").replace(/\D/g, "");
    const wa = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(wa, "_blank");
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: `Pedido #${orderId}`, text: message, url }); } catch {}
    } else {
      copy();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compartir rastreo · #{orderId}</DialogTitle>
          <DialogDescription>
            El cliente podrá ver el estado y la ubicación del mensajero en vivo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <div className="rounded-2xl bg-white p-4 shadow-md">
            <QRCodeSVG value={url} size={200} level="M" includeMargin={false} />
          </div>
          <div className="w-full">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
              <span className="flex-1 truncate text-xs text-muted-foreground">{url}</span>
              <Button size="sm" variant="ghost" onClick={copy} className="h-7 px-2">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-2">
            <Button onClick={shareWhatsApp} className="gap-2 bg-emerald-600 hover:bg-emerald-500">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </Button>
            <Button onClick={nativeShare} variant="outline" className="gap-2">
              <Share2 className="h-4 w-4" /> Compartir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}