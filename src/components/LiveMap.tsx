import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { MapStyleSwitcher, useMapStyle, MapStyle } from '@/components/MapStyleSwitcher';
import 'maplibre-gl/dist/maplibre-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useCompany } from '@/hooks/useCompany';
import { Target, Layers as LayersIcon, Bike, Package, Truck, Flame } from 'lucide-react';

interface LiveMapProps {
  height?: string;
  showDrivers?: boolean;
  showDeliveries?: boolean;
  focusedDeliveryId?: string | null;
}

interface Driver {
  id: string;
  status: string;
  last_lat: number | null;
  last_lng: number | null;
  current_load: number;
  profiles: {
    full_name: string | null;
  } | null;
}

interface Delivery {
  id: string;
  order_id: string;
  status: string;
  pickup_address: string;
  delivery_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
}

const BUCARAMANGA_CENTER: [number, number] = [-73.1198, 7.1193];

const LiveMap: React.FC<LiveMapProps> = ({
  height = "500px",
  showDrivers = true,
  showDeliveries = true,
  focusedDeliveryId = null
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: maplibregl.Marker }>({});
  const markerAnimRef = useRef<{ [key: string]: number }>({});
  const [isMapReady, setIsMapReady] = useState(false);
  const { current: mapStyle, setStyle } = useMapStyle("dark");
  const { selectedCompanyId } = useCompany();
  const didFitBoundsRef = useRef(false);
  const queryClient = useQueryClient();
  const [followDriverId, setFollowDriverId] = useState<string | null>(null);
  const [routeStats, setRouteStats] = useState<{ distance: string; duration: string } | null>(null);
  const [layers, setLayers] = useState({
    drivers: true,
    pendientes: true,
    en_camino: true,
    heatmap: false,
  });
  const [layersOpen, setLayersOpen] = useState(false);

  // Entregas completadas hoy (para heatmap de demanda)
  const { data: completedToday = [] } = useQuery({
    queryKey: ['heatmap-today', selectedCompanyId],
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      let q = supabase
        .from('deliveries')
        .select('delivery_lat, delivery_lng, pickup_lat, pickup_lng')
        .eq('status', 'entregado')
        .gte('created_at', start.toISOString());
      if (selectedCompanyId) q = q.eq('company_id', selectedCompanyId);
      const { data } = await q;
      return (data || []) as any[];
    },
    enabled: layers.heatmap,
    staleTime: 60_000,
  });

  // Consulta de drivers
  const { data: drivers = [] } = useQuery({
    queryKey: ['live-drivers', selectedCompanyId],
    queryFn: async () => {
      let q = supabase
        .from('driver_profiles')
        .select('id, status, current_load, profiles(full_name)');
      if (selectedCompanyId) q = q.eq('company_id', selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      const driverIds = (data || []).map((d: any) => d.id);
      // Fetch locations filtered by driver_id (avoids stale/NULL company_id on driver_locations)
      let locs: any[] = [];
      if (driverIds.length > 0) {
        const { data: locData } = await supabase
          .from('driver_locations')
          .select('driver_id, lat, lng')
          .in('driver_id', driverIds);
        locs = locData || [];
      }
      const locMap = new Map(locs.map((l: any) => [l.driver_id, l]));
      return (data || []).map((d: any) => ({
        ...d,
        last_lat: locMap.get(d.id)?.lat || null,
        last_lng: locMap.get(d.id)?.lng || null,
      })) as Driver[];
    },
    enabled: showDrivers,
  });

  // Consulta de entregas activas
  const { data: deliveries = [] } = useQuery({
    queryKey: ['live-deliveries', selectedCompanyId],
    queryFn: async () => {
      let q = supabase
        .from('deliveries')
        .select('*')
        .in('status', ['pendiente', 'aceptado', 'en_camino']);
      if (selectedCompanyId) q = q.eq('company_id', selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Delivery[];
    },
    enabled: showDeliveries,
  });

  // Interpolación suave del marcador entre updates
  const animateMarker = (id: string, target: [number, number]) => {
    const marker = markersRef.current[id];
    if (!marker) return;
    const start = marker.getLngLat();
    const startLng = start.lng, startLat = start.lat;
    const [endLng, endLat] = target;
    const duration = 900;
    const t0 = performance.now();
    if (markerAnimRef.current[id]) cancelAnimationFrame(markerAnimRef.current[id]);
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      marker.setLngLat([startLng + (endLng - startLng) * ease, startLat + (endLat - startLat) * ease]);
      if (p < 1) markerAnimRef.current[id] = requestAnimationFrame(step);
    };
    markerAnimRef.current[id] = requestAnimationFrame(step);
  };

  // Realtime: driver_locations
  useEffect(() => {
    if (!showDrivers) return;
    const filter = selectedCompanyId ? `company_id=eq.${selectedCompanyId}` : undefined;
    const channel = supabase
      .channel(`live-drivers-${selectedCompanyId ?? 'all'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_locations', ...(filter ? { filter } : {}) },
        (payload: any) => {
          const row = payload.new || payload.old;
          if (!row?.driver_id) return;
          const id = `driver-${row.driver_id}`;
          if (payload.eventType !== 'DELETE' && row.lat != null && row.lng != null && markersRef.current[id]) {
            animateMarker(id, [row.lng, row.lat]);
          } else {
            // Marcador nuevo o borrado → refrescar dataset
            queryClient.invalidateQueries({ queryKey: ['live-drivers', selectedCompanyId] });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedCompanyId, showDrivers, queryClient]);

  // Realtime: deliveries
  useEffect(() => {
    if (!showDeliveries) return;
    const filter = selectedCompanyId ? `company_id=eq.${selectedCompanyId}` : undefined;
    const channel = supabase
      .channel(`live-deliveries-${selectedCompanyId ?? 'all'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deliveries', ...(filter ? { filter } : {}) },
        () => {
          queryClient.invalidateQueries({ queryKey: ['live-deliveries', selectedCompanyId] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedCompanyId, showDeliveries, queryClient]);

  // Cleanup de animaciones al desmontar
  useEffect(() => {
    return () => {
      Object.values(markerAnimRef.current).forEach(id => cancelAnimationFrame(id));
      markerAnimRef.current = {};
    };
  }, []);

  // Inicializar mapa
  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    mapInstance.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle.url,
      center: BUCARAMANGA_CENTER,
      zoom: 13,
      pitch: 45 // 3D effect
    });

    mapInstance.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    mapInstance.current.on('load', () => {
      setIsMapReady(true);
    });

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  // Actualizar marcadores de Drivers
  useEffect(() => {
    if (!isMapReady || !mapInstance.current) return;
    const on = showDrivers && layers.drivers;

    const currentDriverIds = new Set(drivers.map(d => `driver-${d.id}`));
    
    // Eliminar marcadores viejos
    Object.keys(markersRef.current).forEach(id => {
      if (id.startsWith('driver-') && (!on || !currentDriverIds.has(id))) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });
    if (!on) return;

    // Agregar/Actualizar marcadores
    drivers.forEach(driver => {
      if (!driver.last_lat || !driver.last_lng) return;
      const id = `driver-${driver.id}`;
      const lngLat: [number, number] = [driver.last_lng, driver.last_lat];

      if (markersRef.current[id]) {
        animateMarker(id, lngLat);
      } else {
        const el = document.createElement('div');
        el.className = 'driver-marker-container';
        el.innerHTML = `
          <div class="relative">
            <div class="absolute -inset-2 bg-primary/30 rounded-full animate-ping"></div>
            <div class="relative bg-primary text-white p-2 rounded-full shadow-lg border-2 border-white scale-110">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
            </div>
          </div>
        `;
        
        const popup = new maplibregl.Popup({ offset: 25 })
          .setHTML(`<b class="text-black">${driver.profiles?.full_name || 'Driver'}</b><br/>Carga: ${driver.current_load} pedidos`);

        markersRef.current[id] = new maplibregl.Marker({ element: el })
          .setLngLat(lngLat)
          .setPopup(popup)
          .addTo(mapInstance.current!);
      }
    });
  }, [drivers, isMapReady, showDrivers, layers.drivers]);

  // Actualizar marcadores de Entregas (Pickup y Delivery)
  useEffect(() => {
    if (!isMapReady || !mapInstance.current || !showDeliveries) return;

    // Filtrar según capas activas
    const filtered = deliveries.filter((d: any) => {
      if (d.status === 'pendiente') return layers.pendientes;
      if (d.status === 'aceptado' || d.status === 'en_camino') return layers.en_camino;
      return true;
    });

    const currentDeliveryIds = new Set();
    filtered.forEach(d => {
      currentDeliveryIds.add(`pickup-${d.id}`);
      currentDeliveryIds.add(`delivery-${d.id}`);
    });

    // Eliminar marcadores viejos
    Object.keys(markersRef.current).forEach(id => {
      if ((id.startsWith('pickup-') || id.startsWith('delivery-')) && !currentDeliveryIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Agregar/Actualizar marcadores
    filtered.forEach(d => {
      // Pickup Marker
      if (d.pickup_lat && d.pickup_lng) {
        const pId = `pickup-${d.id}`;
        if (markersRef.current[pId]) {
          markersRef.current[pId].setLngLat([d.pickup_lng, d.pickup_lat]);
        } else {
          const el = document.createElement('div');
          el.innerHTML = `<div class="bg-accent text-white p-1.5 rounded-md shadow-md border border-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          </div>`;
          markersRef.current[pId] = new maplibregl.Marker({ element: el })
            .setLngLat([d.pickup_lng, d.pickup_lat])
            .setPopup(new maplibregl.Popup().setHTML(`<b>Recogida #${d.order_id}</b><br/>${d.pickup_address}`))
            .addTo(mapInstance.current!);
        }
      }

      // Delivery Marker
      if (d.delivery_lat && d.delivery_lng) {
        const dId = `delivery-${d.id}`;
        if (markersRef.current[dId]) {
          markersRef.current[dId].setLngLat([d.delivery_lng, d.delivery_lat]);
        } else {
          const el = document.createElement('div');
          el.innerHTML = `<div class="bg-destructive text-white p-1.5 rounded-md shadow-md border border-white pulse-marker">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
          </div>`;
          markersRef.current[dId] = new maplibregl.Marker({ element: el })
            .setLngLat([d.delivery_lng, d.delivery_lat])
            .setPopup(new maplibregl.Popup().setHTML(`<b>Entrega #${d.order_id}</b><br/>${d.delivery_address}`))
            .addTo(mapInstance.current!);
        }
      }
    });
  }, [deliveries, isMapReady, showDeliveries, layers.pendientes, layers.en_camino]);

  // Heatmap de demanda (entregas completadas hoy)
  useEffect(() => {
    if (!isMapReady || !mapInstance.current) return;
    const map = mapInstance.current;
    const remove = () => {
      if (map.getLayer('demand-heat')) map.removeLayer('demand-heat');
      if (map.getSource('demand-heat')) map.removeSource('demand-heat');
    };
    if (!layers.heatmap) { remove(); return; }

    const features = completedToday.flatMap((d: any) => {
      const arr: any[] = [];
      if (d.pickup_lat && d.pickup_lng) arr.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [d.pickup_lng, d.pickup_lat] }, properties: {} });
      if (d.delivery_lat && d.delivery_lng) arr.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [d.delivery_lng, d.delivery_lat] }, properties: {} });
      return arr;
    });
    const geo: any = { type: 'FeatureCollection', features };
    if (map.getSource('demand-heat')) {
      (map.getSource('demand-heat') as maplibregl.GeoJSONSource).setData(geo);
    } else {
      map.addSource('demand-heat', { type: 'geojson', data: geo });
      map.addLayer({
        id: 'demand-heat',
        type: 'heatmap',
        source: 'demand-heat',
        maxzoom: 17,
        paint: {
          'heatmap-weight': 1,
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.2, 'rgba(59,130,246,0.5)',
            0.4, 'rgba(16,185,129,0.6)',
            0.6, 'rgba(234,179,8,0.75)',
            0.8, 'rgba(249,115,22,0.85)',
            1, 'rgba(239,68,68,0.95)',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 10, 15, 40],
          'heatmap-opacity': 0.75,
        },
      }, 'focus-route-case');
    }
    return () => {};
  }, [layers.heatmap, completedToday, isMapReady]);

  // fitBounds automático la primera vez que hay marcadores
  useEffect(() => {
    if (!isMapReady || !mapInstance.current || didFitBoundsRef.current) return;
    const bounds = new maplibregl.LngLatBounds();
    let count = 0;
    drivers.forEach(d => {
      if (d.last_lat && d.last_lng) { bounds.extend([d.last_lng, d.last_lat]); count++; }
    });
    deliveries.forEach(d => {
      if (d.pickup_lat && d.pickup_lng) { bounds.extend([d.pickup_lng, d.pickup_lat]); count++; }
      if (d.delivery_lat && d.delivery_lng) { bounds.extend([d.delivery_lng, d.delivery_lat]); count++; }
    });
    if (count >= 1) {
      mapInstance.current.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 800 });
      didFitBoundsRef.current = true;
    }
  }, [drivers, deliveries, isMapReady]);

  // Manejar enfoque
  useEffect(() => {
    if (!isMapReady || !mapInstance.current || !focusedDeliveryId) return;
    const delivery = deliveries.find(d => d.id === focusedDeliveryId);
    if (delivery && delivery.delivery_lat && delivery.delivery_lng) {
      mapInstance.current.flyTo({
        center: [delivery.delivery_lng, delivery.delivery_lat],
        zoom: 15,
        speed: 1.2
      });
    }
  }, [focusedDeliveryId, isMapReady, deliveries]);

  // Ruta OSRM del pedido enfocado: driver (si asignado) → pickup → delivery
  useEffect(() => {
    if (!isMapReady || !mapInstance.current) return;
    const map = mapInstance.current;
    const clearRoute = () => {
      if (map.getLayer('focus-route-line')) map.removeLayer('focus-route-line');
      if (map.getLayer('focus-route-case')) map.removeLayer('focus-route-case');
      if (map.getSource('focus-route')) map.removeSource('focus-route');
      setRouteStats(null);
    };

    if (!focusedDeliveryId) { clearRoute(); return; }
    const d: any = deliveries.find(x => x.id === focusedDeliveryId);
    if (!d) { clearRoute(); return; }

    const pts: [number, number][] = [];
    if (d.driver_id) {
      const drv = drivers.find(x => x.id === d.driver_id);
      if (drv?.last_lat && drv?.last_lng) pts.push([drv.last_lng, drv.last_lat]);
    }
    if (d.pickup_lat && d.pickup_lng && d.status !== 'en_camino') pts.push([d.pickup_lng, d.pickup_lat]);
    if (d.delivery_lat && d.delivery_lng) pts.push([d.delivery_lng, d.delivery_lat]);

    if (pts.length < 2) { clearRoute(); return; }

    let cancelled = false;
    const wp = pts.map(p => `${p[0]},${p[1]}`).join(';');
    fetch(`https://router.project-osrm.org/route/v1/driving/${wp}?overview=full&geometries=geojson`)
      .then(r => r.json())
      .then(data => {
        if (cancelled || !data.routes?.[0]) return;
        const route = data.routes[0];
        const coords = route.geometry.coordinates;
        const geo: any = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } };
        if (map.getSource('focus-route')) {
          (map.getSource('focus-route') as maplibregl.GeoJSONSource).setData(geo);
        } else {
          map.addSource('focus-route', { type: 'geojson', data: geo });
          map.addLayer({ id: 'focus-route-case', type: 'line', source: 'focus-route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#a5b4fc', 'line-width': 10, 'line-opacity': 0.35 } });
          map.addLayer({ id: 'focus-route-line', type: 'line', source: 'focus-route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#4F46E5', 'line-width': 5 } });
        }
        setRouteStats({
          distance: (route.distance / 1000).toFixed(1) + ' km',
          duration: Math.max(1, Math.ceil(route.duration / 60)) + ' min',
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [focusedDeliveryId, deliveries, drivers, isMapReady]);

  // Modo seguir: cámara sigue al driver seleccionado
  useEffect(() => {
    if (!isMapReady || !mapInstance.current || !followDriverId) return;
    const drv = drivers.find(d => d.id === followDriverId);
    if (drv?.last_lat && drv?.last_lng) {
      mapInstance.current.easeTo({
        center: [drv.last_lng, drv.last_lat],
        zoom: Math.max(mapInstance.current.getZoom(), 15),
        duration: 900,
      });
    }
  }, [drivers, followDriverId, isMapReady]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-border bg-card shadow-2xl">
      {!isMapReady && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">Iniciando Mapa Premium...</p>
          </div>
        </div>
      )}
      <div ref={mapContainer} style={{ height, width: '100%' }} />

      <MapStyleSwitcher
        current={mapStyle}
        onSelect={(s) => {
          setStyle(s.id);
          mapInstance.current?.setStyle(s.url);
        }}
        position="top-right"
        dark={mapStyle.id === 'dark' || mapStyle.id === 'satellite'}
      />

      {/* Toggle de capas */}
      <div className="absolute top-16 left-4 z-10">
        <button
          onClick={() => setLayersOpen(o => !o)}
          className="h-10 px-3 rounded-lg bg-black/80 backdrop-blur-md border border-white/10 shadow-xl text-white flex items-center gap-2 text-xs font-bold"
        >
          <LayersIcon className="h-4 w-4" />
          Capas
        </button>
        {layersOpen && (
          <div className="mt-2 bg-black/85 backdrop-blur-md rounded-lg border border-white/10 shadow-xl p-2 space-y-1 min-w-[180px]">
            {[
              { key: 'drivers' as const,   label: 'Conductores', Icon: Bike,    color: 'text-primary' },
              { key: 'pendientes' as const, label: 'Pendientes', Icon: Package, color: 'text-yellow-400' },
              { key: 'en_camino' as const,  label: 'En camino',  Icon: Truck,   color: 'text-orange-400' },
              { key: 'heatmap' as const,    label: 'Zonas calientes', Icon: Flame, color: 'text-red-400' },
            ].map(({ key, label, Icon, color }) => (
              <button
                key={key}
                onClick={() => setLayers(l => ({ ...l, [key]: !l[key] }))}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 transition-colors"
              >
                <input type="checkbox" readOnly checked={layers[key]} className="accent-primary" />
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-xs font-medium text-white/90">{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ETA / distancia del pedido enfocado */}
      {routeStats && (
        <div className="absolute top-4 right-40 z-10 bg-black/80 backdrop-blur-md rounded-lg border border-white/10 shadow-xl px-4 py-2 flex items-baseline gap-3">
          <div>
            <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest">ETA</p>
            <p className="text-lg font-black text-white leading-none">{routeStats.duration}</p>
          </div>
          <div className="w-px h-8 bg-white/15" />
          <div>
            <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest">Distancia</p>
            <p className="text-lg font-black text-white leading-none">{routeStats.distance}</p>
          </div>
        </div>
      )}

      {/* Botón seguir driver del pedido enfocado */}
      {focusedDeliveryId && (() => {
        const d: any = deliveries.find(x => x.id === focusedDeliveryId);
        if (!d?.driver_id) return null;
        const active = followDriverId === d.driver_id;
        return (
          <button
            onClick={() => setFollowDriverId(active ? null : d.driver_id)}
            className={`absolute top-16 right-4 z-10 h-10 px-3 rounded-lg shadow-xl backdrop-blur-md flex items-center gap-2 text-xs font-bold transition-all border ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-black/80 text-white border-white/10'}`}
          >
            <Target className="h-4 w-4" />
            {active ? 'Siguiendo' : 'Seguir driver'}
          </button>
        );
      })()}

      <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
        <div className="bg-black/80 backdrop-blur-md p-3 rounded-lg border border-white/10 shadow-xl">
          <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2">Estado del Sistema</p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary))]"></span>
              <span className="text-xs text-white/90 font-medium">{drivers.length} Drivers</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_hsl(var(--accent))]"></span>
              <span className="text-xs text-white/90 font-medium">{deliveries.length} Entregas</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveMap;
