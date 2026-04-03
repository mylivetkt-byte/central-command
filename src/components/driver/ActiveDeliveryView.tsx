import { motion, AnimatePresence } from "framer-motion";
import {
  Phone, Navigation, CheckCircle,
  Bike, Package, User, ArrowRight, MapPin, Clock, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import { useDriverLocation } from "@/hooks/useDriverLocation";

interface ActiveDeliveryProps {
  delivery: {
    id: string;
    order_id: string;
    customer_name: string;
    customer_phone: string | null;
    pickup_address: string;
    delivery_address: string;
    amount: number;
    commission: number;
    estimated_time: number | null;
    status: string;
    zone: string | null;
    pickup_lat: number | null;
    pickup_lng: number | null;
    delivery_lat: number | null;
    delivery_lng: number | null;
  };
  onPickedUp: () => void;
  onDelivered: () => void;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

// ─── Llama a OSRM (routing real por calles, gratis, sin API key) ───────────
const fetchRoadRoute = async (
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<{ coords: [number, number][]; distanceKm: number; durationMin: number } | null> => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.[0]) return null;
    const route = data.routes[0];
    // OSRM devuelve [lng, lat], Leaflet necesita [lat, lng]
    const coords: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng]
    );
    return {
      coords,
      distanceKm: route.distance / 1000,
      durationMin: Math.round(route.duration / 60),
    };
  } catch {
    return null;
  }
};

// ─── Geocodifica una dirección con Nominatim (OpenStreetMap, gratis) ────────
const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
  try {
    const q = encodeURIComponent(`${address}, Bucaramanga, Colombia`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      { headers: { "Accept-Language": "es" } }
    );
    const data = await res.json();
    if (!data[0]) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
};

const ActiveDeliveryView = ({ delivery, onPickedUp, onDelivered }: ActiveDeliveryProps) => {
  const [expanded, setExpanded] = useState(true);
  const isPickingUp = delivery.status === "aceptado";
  const { currentLocation } = useDriverLocation();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const deliveryMarkerRef = useRef<L.Marker | null>(null);
  const lastRouteFetchRef = useRef<number>(0);

  // Coordenadas resueltas (pueden venir del delivery o geocodificarse en el cliente)
  const [resolvedCoords, setResolvedCoords] = useState<{
    pickup: { lat: number; lng: number } | null;
    delivery: { lat: number; lng: number } | null;
  }>({ pickup: null, delivery: null });

  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  // ── Resolver coordenadas: primero usa las del delivery, si no geocodifica ──
  useEffect(() => {
    const pickupCoord =
      delivery.pickup_lat && delivery.pickup_lng
        ? { lat: delivery.pickup_lat, lng: delivery.pickup_lng }
        : null;
    const deliveryCoord =
      delivery.delivery_lat && delivery.delivery_lng
        ? { lat: delivery.delivery_lat, lng: delivery.delivery_lng }
        : null;

    if (pickupCoord && deliveryCoord) {
      setResolvedCoords({ pickup: pickupCoord, delivery: deliveryCoord });
      return;
    }

    // Geocodificar las que falten
    setGeocoding(true);
    const run = async () => {
      const [p, d] = await Promise.all([
        pickupCoord ?? geocodeAddress(delivery.pickup_address),
        deliveryCoord ?? geocodeAddress(delivery.delivery_address),
      ]);
      setResolvedCoords({ pickup: p, delivery: d });
      setGeocoding(false);
    };
    run();
  }, [delivery.id]);

  // ── Inicializar mapa Leaflet ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Función para actualizar la ruta en el mapa ───────────────────────────
  const updateRoute = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;

    const destination = isPickingUp ? resolvedCoords.pickup : resolvedCoords.delivery;
    if (!destination) return;

    // Origen: posición actual del driver, o punto de recogida si no hay GPS
    const origin = currentLocation
      ? { lat: currentLocation.lat, lng: currentLocation.lng }
      : resolvedCoords.pickup;

    if (!origin) return;

    // Throttle: no buscar ruta más de 1 vez cada 30 segundos
    const now = Date.now();
    if (now - lastRouteFetchRef.current < 30000) return;
    lastRouteFetchRef.current = now;

    const route = await fetchRoadRoute(origin, destination);

    // Quitar ruta anterior
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    if (route) {
      setRouteInfo({ distanceKm: route.distanceKm, durationMin: route.durationMin });

      // Color según fase: verde=recogida, azul=entrega
      routeLayerRef.current = L.polyline(route.coords, {
        color: isPickingUp ? "#22c55e" : "#3b82f6",
        weight: 5,
        opacity: 0.85,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
    }

    // Ajustar bounds para mostrar origen + destino
    const bounds: L.LatLngExpression[] = [[origin.lat, origin.lng], [destination.lat, destination.lng]];
    map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [60, 60] });
  }, [currentLocation, resolvedCoords, isPickingUp]);

  // ── Colocar/actualizar marcadores fijos (recogida y entrega) ─────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Marcador de recogida (verde)
    if (pickupMarkerRef.current) map.removeLayer(pickupMarkerRef.current);
    if (resolvedCoords.pickup) {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:32px;height:32px;background:#22c55e;border-radius:50%;border:3px solid white;box-shadow:0 3px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;">
          <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.5'><path d='M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z'/><circle cx='12' cy='10' r='3'/></svg>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      pickupMarkerRef.current = L.marker(
        [resolvedCoords.pickup.lat, resolvedCoords.pickup.lng],
        { icon }
      ).bindTooltip("📦 Recogida", { permanent: false }).addTo(map);
    }

    // Marcador de entrega (azul/rojo)
    if (deliveryMarkerRef.current) map.removeLayer(deliveryMarkerRef.current);
    if (resolvedCoords.delivery) {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:32px;height:32px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 3px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;">
          <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.5'><path d='M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/><polyline points='9 22 9 12 15 12 15 22'/></svg>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      deliveryMarkerRef.current = L.marker(
        [resolvedCoords.delivery.lat, resolvedCoords.delivery.lng],
        { icon }
      ).bindTooltip(`🏠 ${delivery.customer_name}`, { permanent: false }).addTo(map);
    }

    // Calcular ruta inicial
    lastRouteFetchRef.current = 0; // resetear throttle para forzar fetch
    updateRoute();
  }, [resolvedCoords]);

  // ── Actualizar marcador del driver en tiempo real ─────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (driverMarkerRef.current) map.removeLayer(driverMarkerRef.current);

    if (currentLocation) {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:28px;height:28px;background:#f59e0b;border-radius:50%;border:3px solid white;box-shadow:0 3px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
          <svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.5'><circle cx='12' cy='12' r='3'/><path d='M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12'/></svg>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      driverMarkerRef.current = L.marker(
        [currentLocation.lat, currentLocation.lng],
        { icon, zIndexOffset: 1000 }
      ).addTo(map);

      // Actualizar la ruta cuando el driver se mueve (throttled)
      updateRoute();
    }
  }, [currentLocation]);

  // ── Abrir navegación GPS en Google Maps o Waze ────────────────────────────
  const openNavigation = (app: "google" | "waze") => {
    const dest = isPickingUp ? resolvedCoords.pickup : resolvedCoords.delivery;
    const address = isPickingUp ? delivery.pickup_address : delivery.delivery_address;

    if (app === "google") {
      const url = dest
        ? `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=driving`
        : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
      window.open(url, "_blank");
    } else {
      const url = dest
        ? `https://waze.com/ul?ll=${dest.lat},${dest.lng}&navigate=yes`
        : `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
      window.open(url, "_blank");
    }
  };

  const currentDestinationLabel = isPickingUp ? "Ir a recoger" : "Ir a entregar";
  const currentDestinationAddress = isPickingUp ? delivery.pickup_address : delivery.delivery_address;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full">

      {/* ── MAPA ── */}
      <div className="flex-1 relative bg-muted min-h-[45vh]">
        <div ref={mapContainerRef} className="absolute inset-0" />

        {/* Geocodificando... */}
        <AnimatePresence>
          {geocoding && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[500] flex items-center justify-center bg-background/60 backdrop-blur-sm"
            >
              <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-xl shadow-lg">
                <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium">Calculando ruta...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chip de fase (recogida / entrega) */}
        <div className="absolute top-4 left-4 z-[400]">
          <Badge className={`px-3 py-1.5 text-xs font-bold rounded-xl shadow-lg ${
            isPickingUp
              ? "bg-amber-500/95 text-white"
              : "bg-blue-600/95 text-white"
          }`}>
            {isPickingUp
              ? <><Package className="h-3.5 w-3.5 mr-1.5" />Recogiendo pedido</>
              : <><Bike className="h-3.5 w-3.5 mr-1.5" />En camino a cliente</>
            }
          </Badge>
        </div>

        {/* ETA y distancia */}
        {routeInfo && (
          <div className="absolute top-4 right-4 z-[400]">
            <div className="bg-card/95 backdrop-blur-xl rounded-2xl px-4 py-2 shadow-lg border border-border/30 text-right">
              <p className="text-xl font-extrabold text-foreground leading-none">
                {routeInfo.durationMin} <span className="text-sm font-normal text-muted-foreground">min</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {routeInfo.distanceKm.toFixed(1)} km
              </p>
            </div>
          </div>
        )}

        {/* Sin coordenadas */}
        {!geocoding && !resolvedCoords.pickup && !resolvedCoords.delivery && (
          <div className="absolute bottom-20 left-4 right-4 z-[400]">
            <div className="flex items-center gap-2 bg-warning/90 text-warning-foreground rounded-xl px-3 py-2 text-xs font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              No se pudieron obtener coordenadas. Usa la navegación manual.
            </div>
          </div>
        )}

        {/* Botones de navegación (Google Maps / Waze) */}
        <div className="absolute bottom-4 right-4 z-[400] flex flex-col gap-2">
          <button
            onClick={() => openNavigation("google")}
            className="flex items-center gap-2 bg-white text-gray-800 font-semibold text-xs px-3 py-2 rounded-xl shadow-lg border border-gray-200 hover:bg-gray-50"
          >
            <Navigation className="h-4 w-4 text-blue-600" /> Google Maps
          </button>
          <button
            onClick={() => openNavigation("waze")}
            className="flex items-center gap-2 bg-[#05C8F7] text-white font-semibold text-xs px-3 py-2 rounded-xl shadow-lg hover:opacity-90"
          >
            <Navigation className="h-4 w-4" /> Waze
          </button>
        </div>

        {/* Estado del GPS */}
        <div className="absolute bottom-4 left-4 z-[400]">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium ${
            currentLocation ? "bg-accent/20 text-accent" : "bg-muted/80 text-muted-foreground"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${currentLocation ? "bg-accent animate-pulse" : "bg-muted-foreground"}`} />
            {currentLocation ? "GPS activo" : "Sin GPS"}
          </div>
        </div>
      </div>

      {/* ── PANEL INFERIOR (deslizable) ── */}
      <motion.div
        className="bg-card rounded-t-3xl border-t border-border/50 shadow-2xl shadow-black/40 relative z-10"
        style={{ marginTop: "-1.5rem" }}
      >
        {/* Handle para expandir/colapsar */}
        <div
          className="flex justify-center pt-3 pb-2 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="px-5 pb-6 space-y-4">
          {/* Destino actual */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">
              {currentDestinationLabel}
            </p>
            <p className="text-base font-bold text-foreground leading-snug">
              {currentDestinationAddress}
            </p>
          </div>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-4 overflow-hidden"
              >
                {/* Ruta pickup → delivery */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="h-3 w-3 rounded-full bg-accent shrink-0" />
                    <span className="text-xs text-muted-foreground truncate">{delivery.pickup_address}</span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="h-3 w-3 rounded-full bg-primary shrink-0" />
                    <span className="text-xs text-muted-foreground truncate">{delivery.delivery_address}</span>
                  </div>
                </div>

                {/* Info cliente + pago */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-accent/10 border border-accent/20">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{delivery.customer_name}</p>
                      <p className="text-[10px] text-muted-foreground">#{delivery.order_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-extrabold text-foreground">{formatCurrency(Number(delivery.amount))}</p>
                      <p className="text-[10px] text-muted-foreground">Cliente paga</p>
                    </div>
                    <div className="text-right border-l border-accent/30 pl-4">
                      <p className="text-lg font-extrabold text-accent">{formatCurrency(Number(delivery.commission))}</p>
                      <p className="text-[10px] text-muted-foreground">Tu ganancia</p>
                    </div>
                  </div>
                </div>

                {/* Llamar al cliente */}
                {delivery.customer_phone && (
                  <a
                    href={`tel:${delivery.customer_phone}`}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="h-9 w-9 rounded-full bg-accent/20 flex items-center justify-center">
                      <Phone className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Llamar al cliente</p>
                      <p className="text-xs text-muted-foreground">{delivery.customer_phone}</p>
                    </div>
                  </a>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Botón de acción principal */}
          {isPickingUp && (
            <Button
              onClick={onPickedUp}
              className="w-full h-14 rounded-2xl bg-amber-500 hover:bg-amber-500/90 text-white font-bold text-base shadow-lg shadow-amber-500/25"
            >
              <Package className="h-5 w-5 mr-2" />
              Ya recogí el pedido
            </Button>
          )}
          {delivery.status === "en_camino" && (
            <Button
              onClick={onDelivered}
              className="w-full h-14 rounded-2xl bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-base shadow-lg shadow-accent/20"
            >
              <CheckCircle className="h-5 w-5 mr-2" />
              Entrega completada ✓
            </Button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ActiveDeliveryView;
