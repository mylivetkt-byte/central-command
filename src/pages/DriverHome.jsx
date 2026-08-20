import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import NavBar from "../components/NavBar";
import MapView from "../components/MapView";
import TripCard from "../components/TripCard";
import RatingModal from "../components/RatingModal";
import VersionBadge from "../components/driver/VersionBadge";
import { supabase } from "../lib/supabase";
import { getCurrentPosition, fmtDistance, fmtMoney, getRoute } from "../lib/geo";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { notifyDriverNewRequest, notifyDriverTripAssigned, notifyDriverTripCompleted, speakAlert } from "../lib/notifications";

export default function DriverHome() {
  const { profile, session } = useAuth();
  const { addToast } = useToast();
  const [available, setAvailable] = useState(false);
  const [pos, setPos] = useState(null);
  const [requests, setRequests] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);
  const [routeCoords, setRouteCoords] = useState(null);
  const [center, setCenter] = useState(null);
  const [showRating, setShowRating] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const watchId = useRef(null);

  // Cargar viaje activo previo si existe
  useEffect(() => {
    if (!session) return;
    supabase
      .from("trips")
      .select("*")
      .eq("driver_id", session.user.id)
      .in("status", ["driver_assigned", "in_progress"])
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setActiveTrip(data);
        }
      });
  }, [session]);

  useEffect(() => {
    getCurrentPosition()
      .then((p) => {
        setCenter([p.lat, p.lng]);
        setPos({ lat: p.lat, lng: p.lng, heading: p.heading || 0 });
      })
      .catch(() => setCenter([-12.0464, -77.0428]));
  }, []);

  // Calcular ruta cuando hay viaje activo
  useEffect(() => {
    let cancelled = false;
    if (!activeTrip) {
      setRouteCoords(null);
      return;
    }

    (async () => {
      // Si el conductor va a recoger al cliente: ruta desde conductor (o origen) hacia destino
      const originPoint = { lat: activeTrip.origin_lat, lng: activeTrip.origin_lng };
      const destPoint = { lat: activeTrip.dest_lat, lng: activeTrip.dest_lng };
      
      const start = (pos && activeTrip.status === "driver_assigned") ? pos : originPoint;
      const end = activeTrip.status === "driver_assigned" ? originPoint : destPoint;

      const r = await getRoute(start, end);
      if (!cancelled && r?.coords) {
        setRouteCoords(r.coords);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTrip, pos]);

  // Tracking GPS continuo
  useEffect(() => {
    if (!available) {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      return;
    }
    getCurrentPosition().then((p) => {
      setCenter([p.lat, p.lng]);
      setPos({ lat: p.lat, lng: p.lng, heading: p.heading || 0 });
    });

    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const { latitude, longitude, heading } = p.coords;
        const coords = { lat: latitude, lng: longitude, heading: heading || 0 };
        setPos(coords);
        setCenter([latitude, longitude]);

        supabase.from("driver_locations").upsert({
          driver_id: session.user.id,
          lat: latitude,
          lng: longitude,
          heading: heading || 0,
        });

        // Actualizar posición en viaje activo para el cliente
        if (activeTrip?.id) {
          supabase.from("trips").update({
            driver_lat: latitude,
            driver_lng: longitude,
          }).eq("id", activeTrip.id);
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000 }
    );
    return () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); };
  }, [available, session, activeTrip]);

  const posRef = useRef(null);
  const voiceEnabledRef = useRef(voiceEnabled);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  // Escuchar solicitudes de viaje en tiempo real con aviso de voz
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`driver-requests-${session.user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "trips", filter: "status=eq.searching" }, (payload) => {
        const trip = payload.new;
        const currentPos = posRef.current;
        if (currentPos) {
          const d = Math.sqrt((currentPos.lat - trip.origin_lat) ** 2 + (currentPos.lng - trip.origin_lng) ** 2) * 111000;
          setRequests((prev) => [{ ...trip, _dist: Math.round(d) }, ...prev.filter(r => r.id !== trip.id)].slice(0, 10));
        } else {
          setRequests((prev) => [trip, ...prev.filter(r => r.id !== trip.id)].slice(0, 10));
        }
        
        notifyDriverNewRequest(session.user.id, trip.id);
        addToast({ title: "Nueva solicitud", message: `${trip.origin_name} → ${trip.dest_name}`, type: "info" });

        // Aviso por VOZ al entrar un nuevo pedido (solo 1 vez por pedido)
        if (voiceEnabledRef.current) {
          const destino = trip.dest_name ? trip.dest_name.split(",")[0] : "destino indicado";
          speakAlert(`Nuevo pedido hacia ${destino}. Tarifa ${fmtMoney(trip.price)}`);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "trips", filter: `driver_id=eq.${session.user.id}` }, (payload) => {
        const updated = payload.new;
        setActiveTrip(updated);
        if (updated.status === "in_progress") {
          addToast({ title: "Viaje iniciado", message: "Dirígete al destino", type: "info" });
        }
        if (updated.status === "completed") {
          notifyDriverTripCompleted(session.user.id);
          addToast({ title: "Viaje completado", message: "El viaje finalizó", type: "success" });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, addToast]);


  const ensureProfile = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    if (!data) {
      const name = session.user.user_metadata?.full_name || session.user.email || "Conductor";
      await supabase.from("profiles").upsert({
        id: session.user.id,
        role: "conductor",
        full_name: name,
        phone: "",
        vehicle: "",
        rating: 5,
        trips_done: 0,
      });
    }
  }, [session]);

  const acceptTrip = async (trip) => {
    await ensureProfile();
    const { data, error } = await supabase
      .from("trips")
      .update({ driver_id: session.user.id, status: "driver_assigned" })
      .eq("id", trip.id)
      .eq("status", "searching")
      .select("*")
      .single();
    if (error) return alert("Otro conductor ya tomó esta solicitud");
    setActiveTrip(data);
    setRequests((prev) => prev.filter((r) => r.id !== trip.id));
    await notifyDriverTripAssigned(session.user.id, data.id);
    addToast({ title: "Solicitud aceptada", message: "Dirígete al origen a recoger al cliente", type: "success" });
    if (voiceEnabled) {
      const origen = data.origin_name ? data.origin_name.split(",")[0] : "el punto de recogida";
      speakAlert(`Solicitud aceptada. Dirígete a recoger al cliente en ${origen}`);
    }
  };

  const updateStatus = async (status) => {
    const updates = { status };
    if (status === "in_progress") updates.started_at = new Date().toISOString();
    if (status === "completed") updates.completed_at = new Date().toISOString();
    const { error } = await supabase.from("trips").update(updates).eq("id", activeTrip.id);
    if (error) return alert(error.message);
    if (status === "completed") {
      setShowRating(true);
      setActiveTrip(null);
      setRouteCoords(null);
    }
  };

  const actions = useMemo(() => {
    if (!activeTrip) return [];
    switch (activeTrip.status) {
      case "driver_assigned":
        return [{ label: "Llegué / Iniciar viaje", action: "in_progress" }];
      case "in_progress":
        return [{ label: "Finalizar viaje", action: "completed" }];
      default:
        return [];
    }
  }, [activeTrip]);

  const onAction = (action) => updateStatus(action);

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
      <NavBar />
      <div style={{ flex: 1, position: "relative" }}>
        {/* Mapa con interfaz de navegación y ruta activa */}
        <MapView
          origin={activeTrip ? { lat: activeTrip.origin_lat, lng: activeTrip.origin_lng, name: activeTrip.origin_name } : null}
          dest={activeTrip ? { lat: activeTrip.dest_lat, lng: activeTrip.dest_lng, name: activeTrip.dest_name } : null}
          driverPos={pos}
          routeCoords={routeCoords}
          center={center}
          zoom={16}
        />

        {showPanel && (
          <div className="panel">
            <div className="sheet-handle" />
            <div className="card">
              <div className="sheet-header">
                <div>
                  <div className="sheet-title">Panel de Conductor</div>
                  <div className="small" style={{ color: "var(--muted)", marginTop: 2 }}>
                    GPS: {pos ? "Conectado y transmitiendo" : "Buscando satélites..."}
                  </div>
                </div>
                <div className={`badge ${available ? "ok" : "warn"}`}>
                  {available ? "En Línea" : "Desconectado"}
                </div>
              </div>

              <div className="row" style={{ marginBottom: 12, gap: 8 }}>
                <button
                  className={`btn btn-sm ${available ? "btn-secondary" : ""}`}
                  style={{ flex: 2 }}
                  onClick={() => {
                    const next = !available;
                    setAvailable(next);
                    if (voiceEnabled) {
                      speakAlert(next ? "Modo conductor activado. Estás en línea." : "Modo conductor desactivado.");
                    }
                  }}
                >
                  {available ? "Ponerse en Pausa" : "Conectarse / Disponible"}
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1, fontSize: 12 }}
                  title="Activar/Desactivar avisos por voz"
                  onClick={() => {
                    setVoiceEnabled((v) => !v);
                    if (!voiceEnabled) speakAlert("Avisos por voz activados");
                  }}
                >
                  {voiceEnabled ? "🔊 Voz On" : "🔇 Voz Off"}
                </button>
              </div>

              {!activeTrip && requests.length > 0 && (
                <div>
                  <div className="small" style={{ marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700, color: "var(--accent)" }}>
                    🔔 Solicitudes entrantes ({requests.length})
                  </div>
                  {requests.map((r) => (
                    <div key={r.id} className="place-row" style={{ marginBottom: 10, background: "rgba(57,255,20,0.04)", border: "1px solid rgba(57,255,20,0.2)", borderRadius: 12, padding: "10px" }}>
                      <div className="spot red" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>📍 {r.origin_name?.split(",")[0]}</div>
                        <div className="small" style={{ color: "var(--text)" }}>🏁 Hacia: {r.dest_name?.split(",")[0]}</div>
                        <div className="small" style={{ color: "var(--muted)", marginTop: 3 }}>
                          A {fmtDistance(r._dist || 0)} · Tarifa: <strong style={{ color: "var(--accent)" }}>{fmtMoney(r.price)}</strong>
                        </div>
                      </div>
                      <button className="btn btn-sm" style={{ width: "auto", padding: "8px 14px", fontWeight: 700 }} onClick={() => acceptTrip(r)}>
                        Aceptar
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {activeTrip && (
                <div className="mt-1">
                  <TripCard trip={activeTrip} onClose={() => setActiveTrip(null)} onAction={onAction} />
                  {actions.length > 0 && (
                    <div className="row mt-2">
                      {actions.map((a) => (
                        <button key={a.action} className="btn" style={{ fontWeight: 800 }} onClick={() => onAction(a.action)}>
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <VersionBadge />
            </div>
          </div>
        )}

        <RatingModal open={showRating} tripId={activeTrip?.id} role={profile?.role} onClose={() => setShowRating(false)} />
      </div>
    </div>
  );
}
