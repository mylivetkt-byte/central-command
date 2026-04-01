import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/components/ui/use-toast';

interface LocationData {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
}

interface UseDriverLocationReturn {
  isTracking: boolean;
  currentLocation: LocationData | null;
  startTracking: () => void;
  stopTracking: () => void;
  error: string | null;
}

export const useDriverLocation = (): UseDriverLocationReturn => {
  const { user, role } = useAuth();
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);

  // Función para actualizar ubicación en Supabase
  const updateLocation = useCallback(async (location: LocationData) => {
    if (!user || role !== 'driver') return;

    try {
      const { error } = await supabase
        .from('driver_locations')
        .upsert({
          driver_id: user.id,
          lat: location.lat,
          lng: location.lng,
          heading: location.heading,
          speed: location.speed,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'driver_id'
        });

      if (error) throw error;
    } catch (err) {
      console.error('Error updating location:', err);
      setError('Error al actualizar ubicación');
    }
  }, [user, role]);

  // Iniciar tracking
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocalización no soportada en este navegador');
      toast({
        title: "Error",
        description: "Tu navegador no soporta geolocalización",
        variant: "destructive"
      });
      return;
    }

    if (role !== 'driver') {
      setError('Solo los conductores pueden activar el tracking');
      return;
    }

    setIsTracking(true);
    setError(null);

    // Configuración para alta precisión
    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    // Iniciar watch position
    const id = navigator.geolocation.watchPosition(
      (position) => {
        const locationData: LocationData = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          heading: position.coords.heading,
          speed: position.coords.speed,
          accuracy: position.coords.accuracy
        };

        setCurrentLocation(locationData);
        updateLocation(locationData);
      },
      (err) => {
        console.error('Geolocation error:', err);
        let errorMessage = 'Error al obtener ubicación';
        
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMessage = 'Permiso de ubicación denegado';
            break;
          case err.POSITION_UNAVAILABLE:
            errorMessage = 'Ubicación no disponible';
            break;
          case err.TIMEOUT:
            errorMessage = 'Tiempo de espera agotado';
            break;
        }
        
        setError(errorMessage);
        toast({
          title: "Error de GPS",
          description: errorMessage,
          variant: "destructive"
        });
      },
      options
    );

    setWatchId(id);

    toast({
      title: "Tracking activado",
      description: "Tu ubicación se está compartiendo en tiempo real"
    });
  }, [role, updateLocation]);

  // Detener tracking
  const stopTracking = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }

    setIsTracking(false);
    setCurrentLocation(null);

    toast({
      title: "Tracking desactivado",
      description: "Tu ubicación ya no se está compartiendo"
    });
  }, [watchId]);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  return {
    isTracking,
    currentLocation,
    startTracking,
    stopTracking,
    error
  };
};

// Hook para obtener la ubicación de un driver específico
export const useDriverLocationById = (driverId: string | null) => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!driverId) {
      setLoading(false);
      return;
    }

    const fetchLocation = async () => {
      const { data, error } = await supabase
        .from('driver_locations')
        .select('lat, lng, heading, speed, updated_at')
        .eq('driver_id', driverId)
        .maybeSingle();

      if (!error && data) {
        setLocation({
          lat: data.lat,
          lng: data.lng,
          heading: data.heading,
          speed: data.speed,
          accuracy: null
        });
      }
      setLoading(false);
    };

    fetchLocation();

    // Suscribirse a cambios en tiempo real
    const channel = supabase
      .channel(`driver-location-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'driver_locations',
          filter: `driver_id=eq.${driverId}`
        },
        (payload) => {
          const newData = payload.new;
          setLocation({
            lat: newData.lat,
            lng: newData.lng,
            heading: newData.heading,
            speed: newData.speed,
            accuracy: null
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId]);

  return { location, loading };
};

// Hook para calcular distancia entre dos puntos
export const useDistance = (
  point1: { lat: number; lng: number } | null,
  point2: { lat: number; lng: number } | null
) => {
  const [distance, setDistance] = useState<number | null>(null);

  useEffect(() => {
    if (!point1 || !point2) {
      setDistance(null);
      return;
    }

    // Fórmula de Haversine para calcular distancia
    const R = 6371; // Radio de la Tierra en km
    const dLat = toRad(point2.lat - point1.lat);
    const dLng = toRad(point2.lng - point1.lng);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(point1.lat)) * Math.cos(toRad(point2.lat)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distancia en km

    setDistance(d);
  }, [point1, point2]);

  return distance;
};

// Función helper para convertir grados a radianes
const toRad = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

// Hook para calcular tiempo estimado de llegada
export const useETA = (
  currentLocation: { lat: number; lng: number } | null,
  destination: { lat: number; lng: number } | null,
  averageSpeed: number = 30 // km/h por defecto
) => {
  const distance = useDistance(currentLocation, destination);
  const [eta, setEta] = useState<number | null>(null); // en minutos

  useEffect(() => {
    if (distance === null || distance === 0) {
      setEta(null);
      return;
    }

    // Tiempo = Distancia / Velocidad (en minutos)
    const timeInHours = distance / averageSpeed;
    const timeInMinutes = Math.round(timeInHours * 60);
    
    setEta(timeInMinutes);
  }, [distance, averageSpeed]);

  return eta;
};
