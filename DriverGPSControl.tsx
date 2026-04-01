import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Navigation, 
  MapPin, 
  Clock, 
  Activity,
  AlertCircle
} from 'lucide-react';
import { useDriverLocation } from '@/hooks/useDriverLocation';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function DriverGPSControl() {
  const { 
    isTracking, 
    currentLocation, 
    startTracking, 
    stopTracking,
    error 
  } = useDriverLocation();

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <Navigation className="w-6 h-6" />
              Control de Ubicación GPS
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {isTracking 
                ? 'Tu ubicación se está compartiendo en tiempo real' 
                : 'Activa el GPS para recibir pedidos'
              }
            </p>
          </div>
          <Badge 
            variant={isTracking ? "default" : "secondary"}
            className={isTracking ? "bg-green-600 animate-pulse" : ""}
          >
            {isTracking ? "Activo" : "Inactivo"}
          </Badge>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Estado del GPS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Latitud</span>
            </div>
            <p className="text-lg font-semibold">
              {currentLocation?.lat.toFixed(6) || '---'}
            </p>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Longitud</span>
            </div>
            <p className="text-lg font-semibold">
              {currentLocation?.lng.toFixed(6) || '---'}
            </p>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Velocidad</span>
            </div>
            <p className="text-lg font-semibold">
              {currentLocation?.speed 
                ? `${Math.round(currentLocation.speed * 3.6)} km/h`
                : '---'
              }
            </p>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Navigation className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Precisión</span>
            </div>
            <p className="text-lg font-semibold">
              {currentLocation?.accuracy 
                ? `${Math.round(currentLocation.accuracy)}m`
                : '---'
              }
            </p>
          </div>
        </div>

        {/* Botón de Control */}
        <div className="flex gap-4">
          {isTracking ? (
            <Button 
              onClick={stopTracking}
              variant="destructive"
              className="flex-1"
              size="lg"
            >
              <Navigation className="w-5 h-5 mr-2" />
              Detener GPS
            </Button>
          ) : (
            <Button 
              onClick={startTracking}
              className="flex-1 bg-green-600 hover:bg-green-700"
              size="lg"
            >
              <Navigation className="w-5 h-5 mr-2" />
              Activar GPS
            </Button>
          )}
        </div>

        {/* Información adicional */}
        <div className="pt-4 border-t space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
            <p className="text-muted-foreground">
              Tu ubicación se actualiza automáticamente cada pocos segundos mientras 
              el GPS esté activo. Asegúrate de tener los permisos de ubicación habilitados.
            </p>
          </div>
          
          {isTracking && (
            <div className="flex items-start gap-2 text-sm">
              <Clock className="w-4 h-4 text-green-600 mt-0.5" />
              <p className="text-green-600">
                GPS activo. Los administradores pueden ver tu ubicación en el mapa.
              </p>
            </div>
          )}
        </div>

        {/* Consejos */}
        <div className="pt-4 border-t">
          <h4 className="font-semibold text-sm mb-3">Consejos para mejor precisión:</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Mantén el GPS activo durante tus entregas</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Asegúrate de tener conexión a internet estable</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Permite permisos de ubicación en tu navegador</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Para mejor rendimiento, usa Chrome o Firefox</span>
            </li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
