import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, QrCode } from "lucide-react";

const QR_SIZE = 256;
const INSTALL_URL = "https://logi-smart-pulse.lovable.app/install";

const DriverQR = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrReady, setQrReady] = useState(false);

  // We'll use a simple QR approach via an external API rendered as image
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&data=${encodeURIComponent(INSTALL_URL)}&bgcolor=0f172a&color=3b82f6&format=svg`;

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = `https://api.qrserver.com/v1/create-qr-code/?size=1024x1024&data=${encodeURIComponent(INSTALL_URL)}&format=png`;
    link.download = "logismart-conductor-qr.png";
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 text-blue-400">
            <QrCode className="w-6 h-6" />
            <span className="text-sm font-medium uppercase tracking-widest">QR de Instalación</span>
          </div>
          <h1 className="text-3xl font-bold text-white">App del Conductor</h1>
          <p className="text-blue-200/60 text-sm">
            Escanea este código con tu teléfono para instalar la app
          </p>
        </div>

        {/* QR Code */}
        <div className="mx-auto w-72 h-72 bg-white rounded-3xl p-4 shadow-2xl shadow-blue-500/20">
          <img
            src={qrImageUrl}
            alt="QR Code para instalar la app del conductor"
            className="w-full h-full"
            onLoad={() => setQrReady(true)}
          />
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-blue-200/50 text-xs break-all font-mono">{INSTALL_URL}</p>
        </div>

        <Button
          onClick={handleDownload}
          variant="outline"
          className="border-white/20 text-white hover:bg-white/10"
        >
          <Download className="w-4 h-4 mr-2" />
          Descargar QR (PNG)
        </Button>
      </div>
    </div>
  );
};

// Need useState import
import { useState } from "react";

export default DriverQR;
