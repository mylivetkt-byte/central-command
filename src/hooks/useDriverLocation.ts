import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

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

// Throttle: solo enviamos ubicación a Supabase cada 15s como máximo.
// Sin esto, en moto con GPS activo puede llegar a 60+ writes/min.
const LOCATION_THROTTLE_MS = 15_000;

export const useDriverLocation = (): UseDriverLocationReturn => {
  const { user, role } = useAuth();
  const [isTracking, setIsTracking]           = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [error, setError]                     = useState<string | null>(null);
  const watchIdRef     = useRef<number | null>(null);
  const lastSentRef    = useRef<number>(0);

  const updateLocation = useCallback(async (location: LocationData) => {
    if (!user || role !== 'driver') return;

    // Throttle — no enviar más de una vez cada 15s
    const now = Date.now();
    if (now - lastSentRef.current < LOCATION_THROTTLE_MS) return;
    lastSentRef.current = now;

    try {
      const { error: err } = await (supabase.from('driver_locations') as any)
        .upsert({
          driver_id:  user.id,
          lat:        location.lat,
          lng:        location.lng,
          heading:    location.heading,
          speed:      location.speed,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'driver_id' });
      if (err) console.error('[GPS] update error:', err.message);
    } catch (e) {
      console.error('[GPS] exception:', e);
    }
  }, [user, role]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocalización no soportada');
      toast.error('Tu navegador no soporta geolocalización');
      return;
    }
    if (role !== 'driver') return;
    if (watchIdRef.current !== null) return; // ya está activo

    setIsTracking(true);
    setError(null);

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const loc: LocationData = {
          lat:      pos.coords.latitude,
          lng:      pos.coords.longitude,
          heading:  pos.coords.heading,
          speed:    pos.coords.speed,
          accuracy: pos.coords.accuracy,
        };
        setCurrentLocation(loc);
        updateLocation(loc);
      },
      (err) => {
        const msgs: Record<number, string> = {
          1: 'Permiso de ubicación denegado. Actívalo en ajustes del navegador.',
          2: 'Ubicación no disponible.',
          3: 'Tiempo de espera agotado.',
        };
        const msg = msgs[err.code] ?? 'Error al obtener ubicación';
        setError(msg);
        toast.error(msg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    watchIdRef.current = id;
  }, [role, updateLocation]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
    setCurrentLocation(null);
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { isTracking, currentLocation, startTracking, stopTracking, error };
};

// ── Hook para ver ubicación de un driver específico (admin side) ──────────────
export const useDriverLocationById = (driverId: string | null) => {
  const [location, setLocation] = useState<{ lat: number; lng: number; heading: number | null; speed: number | null; accuracy: null } | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!driverId) { setLoading(false); return; }

    supabase.from('driver_locations').select('lat,lng,heading,speed')
      .eq('driver_id', driverId).maybeSingle()
      .then(({ data }) => {
        if (data) setLocation({ ...(data as any), accuracy: null });
        setLoading(false);
      });

    const ch = supabase.channel(`drv-loc-${driverId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'driver_locations',
        filter: `driver_id=eq.${driverId}`,
      }, ({ new: n }) => setLocation({ lat: n.lat, lng: n.lng, heading: n.heading, speed: n.speed, accuracy: null }))
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [driverId]);

  return { location, loading };
};

// ── Distancia Haversine ───────────────────────────────────────────────────────
const toRad = (d: number) => d * (Math.PI / 180);
export const haversineKm = (
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number }
): number => {
  const R = 6371;
  const dLat = toRad(p2.lat - p1.lat);
  const dLng = toRad(p2.lng - p1.lng);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
