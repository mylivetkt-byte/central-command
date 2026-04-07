import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import {
  Package, MapPin, Phone, Clock, CheckCircle,
  Navigation, ChevronRight, Loader2, ArrowLeft, Bike
} from 'lucide-react';

const BUCARAMANGA_CENTER: [number, number] = [-73.1198, 7.1193];

const statusMap: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pendiente: { label: 'Buscando mensajero...', color: 'text-amber-500', icon: <Package className="h-5 w-5 animate-pulse" /> },
  aceptado: { label: 'En camino a recoger', color: 'text-blue-500', icon: <Bike className="h-5 w-5 animate-pulse" /> },
  en_camino: { label: 'En camino a tu ubicaci\u00f3n', color: 'text-indigo-500', icon: <Navigation className="h-5 w-5 animate-pulse" /> },
  entregado: { label: 'Entregado', color: 'text-emerald-500', icon: <CheckCircle className="h-5 w-5" /> },
  cancelado: { label: 'Cancelado', color: 'text-red-500', icon: <ChevronRight className="h-5 w-5" /> },
};

export default function CustomerTracking() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const driverMarkerRef = useRef<maplibregl.Marker | null>(null);
  const pickupMarkerRef = useRef<maplibregl.Marker | null>(null);
  const deliveryMarkerRef = useRef<maplibregl.Marker | null>(null);
  const routeLineRef = useRef<string | null>(null);

  const [delivery, setDelivery] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [eta, setEta] = useState<string | null>(null);

  // Load delivery data
  const loadDelivery = useCallback(async () => {
    const { data, error } = await supabase
      .from('deliveries')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();
    if (error) { setLoading(false); return; }
    if (!data) { setLoading(false); return; }
    setDelivery(data as any);

    // Load driver info if assigned
    if ((data as any).driver_id) {
      const { data: driverData } = await supabase
        .from('driver_profiles')
        .select('id, rating, profiles (full_name, phone)')
        .eq('id', (data as any).driver_id)
        .maybeSingle();
      setDriver(driverData as any);

      // Load driver location
      const { data: loc } = await supabase
        .from('driver_locations')
        .select('lat, lng, heading')
        .eq('driver_id', (data as any).driver_id)
        .maybeSingle();
      if (loc) setDriver((prev: any) => ({ ...prev, lat: (loc as any).lat, lng: (loc as any).lng }));
    }

    setLoading(false);
  }, [orderId]);

  useEffect(() => { loadDelivery(); }, [loadDelivery]);

  // Realtime subscription
  useEffect(() => {
    const ch = supabase.channel('track-order')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deliveries', filter: `order_id=eq.${orderId}` }, ({ new: n }: any) => {
        setDelivery(n);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orderId]);

  // Track driver location changes
  useEffect(() => {
    if (!delivery?.driver_id) return;
    const ch = supabase.channel(`track-driver-${delivery.driver_id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'driver_locations', filter: `driver_id=eq.${delivery.driver_id}` }, ({ new: n }: any) => {
        setDriver((prev: any) => prev ? { ...prev, lat: n.lat, lng: n.lng } : null);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [delivery?.driver_id]);

  // Init map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: BUCARAMANGA_CENTER,
      zoom: 14,
      pitch: 45,
    });
    mapRef.current.addControl(new maplibregl.NavigationControl({ showCompass: false, showZoom: true }), 'bottom-right');
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  // Update map markers
  useEffect(() => {
    if (!mapRef.current || !delivery) return;
    const map = mapRef.current;
    const d = delivery as any;

    const pickupLat = d.pickup_lat || null;
    const pickupLng = d.pickup_lng || null;
    const deliveryLat = d.delivery_lat || null;
    const deliveryLng = d.delivery_lng || null;

    // Pickup marker
    if (pickupLat && pickupLng) {
      if (!pickupMarkerRef.current) {
        const el = document.createElement('div');
        el.innerHTML = '<div class="h-12 w-12 bg-emerald-500 rounded-full border-4 border-white shadow-xl flex items-center justify-center"><span class="text-xl">📦</span></div>';
        pickupMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([pickupLng, pickupLat])
          .setPopup(new maplibregl.Popup().setHTML(`<b>Recogida</b><br/>${d.pickup_address}`))
          .addTo(map);
      }
    }

    // Delivery marker
    if (deliveryLat && deliveryLng) {
      if (!deliveryMarkerRef.current) {
        const el = document.createElement('div');
        el.innerHTML = '<div class="h-12 w-12 bg-indigo-600 rounded-full border-4 border-white shadow-xl flex items-center justify-center"><span class="text-xl">🏠</span></div>';
        deliveryMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([deliveryLng, deliveryLat])
          .setPopup(new maplibregl.Popup().setHTML(`<b>Destino</b><br/>${d.delivery_address}`))
          .addTo(map);
      }
    }

    // Center map on delivery area
    if (pickupLat && pickupLng && deliveryLat && deliveryLng) {
      const bounds: [number, number][] = [[pickupLng, pickupLat], [deliveryLng, deliveryLat]];
      if (driver?.lat && driver?.lng) bounds.push([driver.lng, driver.lat]);
      map.fitBounds(bounds as maplibregl.LngLatBoundsLike, { padding: 60 });
    }
  }, [delivery, driver]);

  // Driver marker
  useEffect(() => {
    if (!mapRef.current || !driver?.lat || !driver?.lng) return;
    const map = mapRef.current;
    const pos: [number, number] = [driver.lng, driver.lat];

    if (!driverMarkerRef.current) {
      const el = document.createElement('div');
      el.innerHTML = '<div class="relative"><div class="absolute -inset-3 bg-indigo-500/30 rounded-full animate-ping"></div><div class="relative bg-indigo-600 text-white rounded-full p-3 border-4 border-white shadow-2xl"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg></div></div>';
      driverMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat(pos)
        .setPopup(new maplibregl.Popup().setHTML(`<b>${driver.profiles?.full_name || 'Mensajero'}</b>`))
        .addTo(map);
    } else {
      driverMarkerRef.current.setLngLat(pos);
    }
  }, [driver?.lat, driver?.lng, driver?.profiles]);

  // Route line
  const fetchRoute = useCallback(async () => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const d = delivery as any;

    let start: [number, number] | null = null;
    if (driver?.lat && driver?.lng) start = [driver.lng, driver.lat];
    else if (d.pickup_lat && d.pickup_lng) start = [d.pickup_lng, d.pickup_lat];

    const end: [number, number] | null = d.status === 'aceptado' && d.pickup_lat
      ? [d.pickup_lng, d.pickup_lat]
      : d.delivery_lat
        ? [d.delivery_lng, d.delivery_lat]
        : null;

    if (!start || !end) return;

    try {
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson`);
      const data = await res.json();
      if (!data.routes?.[0]) return;

      const coords = data.routes[0].geometry.coordinates;
      const srcId = 'track-route';

      // ETA calc
      const durMin = Math.ceil(data.routes[0].duration / 60);
      if (durMin > 0) setEta(durMin + ' min');

      if (!map.getSource(srcId)) {
        map.addSource(srcId, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } });
        map.addLayer({ id: 'track-route-case', type: 'line', source: srcId, paint: { 'line-color': '#6366f1', 'line-width': 8, 'line-opacity': 0.3 } });
        map.addLayer({ id: 'track-route', type: 'line', source: srcId, paint: { 'line-color': '#6366f1', 'line-width': 4, 'line-dasharray': [6, 4] } });
      } else {
        (map.getSource(srcId) as maplibregl.GeoJSONSource).setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } });
      }
    } catch { }
  }, [delivery, driver]);

  useEffect(() => { fetchRoute(); const i = setInterval(fetchRoute, 15000); return () => clearInterval(i); }, [fetchRoute]);

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-950">
        <Loader2 className="h-10 w-10 text-indigo-500 animate-spin mb-4" />
        <p className="text-sm text-white/50 font-bold uppercase tracking-widest">Cargando...</p>
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-950 px-6">
        <Package className="h-16 w-16 text-white/10 mb-6" />
        <h1 className="text-xl font-black text-white/30 mb-2">Pedido no encontrado</h1>
        <p className="text-sm text-white/20 text-center">El código #{orderId} no existe o ya fue archivado</p>
        <button onClick={() => navigate('/')} className="mt-8 flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-500 transition-all">
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
      </div>
    );
  }

  const status = statusMap[delivery.status] || { label: delivery.status, color: 'text-white/50', icon: <Clock className="h-5 w-5" /> };

  return (
    <div className="h-screen w-screen bg-slate-950 flex flex-col overflow-hidden">
      {/* Map */}
      <div ref={mapContainer} className="flex-1" />

      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 z-[1000] h-12 w-12 rounded-full bg-white/90 backdrop-blur-xl shadow-2xl flex items-center justify-center hover:bg-white transition-all"
      >
        <ArrowLeft className="h-5 w-5 text-slate-800" />
      </button>

      {/* ORDER ID pill */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000]">
        <div className="bg-slate-900/90 backdrop-blur-3xl px-6 py-3 rounded-full border border-white/10 shadow-2xl">
          <p className="text-xs font-black text-white tracking-widest">#{orderId?.slice(-6).toUpperCase()}</p>
        </div>
      </div>

      {/* Status badge */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000]">
        <div className="bg-white/90 backdrop-blur-3xl px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
          {status.icon}
          <p className={`text-sm font-bold capitalize ${status.color}`}>{status.label}</p>
        </div>
      </div>

      {/* ETA pill */}
      {eta && delivery.status !== 'entregado' && delivery.status !== 'cancelado' && (
        <div className="absolute top-6 right-6 z-[1000]">
          <div className="bg-indigo-600 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2">
            <Clock className="h-4 w-4 text-white/80 animate-pulse" />
            <p className="text-sm font-black text-white">{eta}</p>
          </div>
        </div>
      )}

      {/* Driver info card */}
      {driver && delivery.status !== 'pendiente' && (
        <div className="absolute bottom-8 left-4 right-4 z-[1000]">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white/90 backdrop-blur-3xl rounded-[32px] p-6 shadow-[0_25px_60px_rgba(0,0,0,0.7)]"
          >
            {driver.profiles?.full_name && (
              <div className="flex items-center gap-4 mb-4">
                <div className="h-14 w-14 rounded-2xl bg-indigo-100 flex items-center justify-center text-xl font-black text-indigo-600">
                  {driver.profiles.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-black text-slate-900">{driver.profiles.full_name}</p>
                  {driver.rating && <p className="text-xs text-slate-400 flex items-center gap-1">{driver.rating} ⭐</p>}
                </div>
                <button
                  onClick={() => window.open(`tel:${driver.profiles.phone}`, '_self')}
                  className="h-14 w-14 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-xl active:scale-90 transition-transform"
                >
                  <Phone className="h-6 w-6 text-white" />
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
