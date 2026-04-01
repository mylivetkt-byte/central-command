import { useDriverLocation } from '@/hooks/useDriverLocation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Navigation, 
  MapPin, 
  Zap, 
  AlertCircle, 
  CheckCircle,
  Activity
} from 'lucide-react';

export default function DriverGPSControl() {
  const { 
    isTracking, 
    currentLocation, 
    startTracking, 
    stopTracking, 
    error 
  } = useDriverLocation();

  return (
    <Card className="p-6 space-y-6 overflow-hidden relative">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <Navigation className="w-24 h-24 rotate-45" />
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Control de Tracking GPS
          </h3>
          <p className="text-muted-foreground text-sm mt-1">
            Activa tu ubicación en tiempo real para recibir pedidos cercanos
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isTracking ? (
            <Badge className="bg-green-500 text-white animate-pulse px-3 py-1">
              <Activity className="w-3 h-3 mr-1.5" />
              Transmitiendo en vivo
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground px-3 py-1">
              Inactivo
            </Badge>
          )}
        </div>
      </div>

      {/* Main Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Button 
          size="lg"
          variant={isTracking ? "outline" : "default"}
          className={`h-24 text-lg font-bold flex flex-col gap-1 ${!isTracking ? 'bg-gradient-primary hover:opacity-90 shadow-lg shadow-primary/20' : ''}`}
          onClick={startTracking}
          disabled={isTracking}
        >
          <Navigation className={`w-6 h-6 ${isTracking ? 'text-muted-foreground' : 'text-white font-bold'}`} />
          Activar GPS
        </Button>

        <Button 
          size="lg"
          variant={!isTracking ? "outline" : "destructive"}
          className="h-24 text-lg font-bold flex flex-col gap-1 transition-all"
          onClick={stopTracking}
          disabled={!isTracking}
        >
          <Zap className="w-6 h-6" />
          Detener GPS
        </Button>
      </div>

      {/* Live Data Display */}
      {isTracking && currentLocation && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-xl border border-border/50">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Latitud</p>
            <p className="font-mono text-sm">{currentLocation.lat.toFixed(6)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Longitud</p>
            <p className="font-mono text-sm">{currentLocation.lng.toFixed(6)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Velocidad</p>
            <p className="text-sm font-semibold text-primary">
              {currentLocation.speed ? `${(currentLocation.speed * 3.6).toFixed(1)} km/h` : '0 km/h'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Precisión</p>
            <p className="text-sm font-semibold text-green-600">
              {currentLocation.accuracy ? `±${currentLocation.accuracy.toFixed(0)}m` : '-'}
            </p>
          </div>
        </div>
      )}

      {/* Message States */}
      {error && (
        <div className="flex items-center gap-3 p-3 bg-destructive/10 text-destructive rounded-lg border border-destructive/20 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {!error && isTracking && (
        <div className="flex items-center gap-3 p-3 bg-green-500/10 text-green-600 rounded-lg border border-green-500/20">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">Ubicación sincronizada con el panel de control central</p>
        </div>
      )}
      
      {/* Location Access Indicator */}
      <div className="pt-2 flex items-center gap-2 text-[11px] text-muted-foreground italic">
        <MapPin className="w-3 h-3" />
        Requiere permisos de geolocalización de alta precisión para funcionar correctamente.
      </div>
    </Card>
  );
}
