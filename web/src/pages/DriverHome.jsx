import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import NavBar from "../components/NavBar";
import MapView from "../components/MapView";
import TripCard from "../components/TripCard";
import RatingModal from "../components/RatingModal";
import { supabase } from "../lib/supabase";
import { getCurrentPosition, fmtDistance, fmtMoney } from "../lib/geo";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { notifyDriverNewRequest, notifyDriverTripAssigned, notifyDriverTripCompleted } from "../lib/notifications";

export default function DriverHome() {
  const { profile, session } = useAuth();
  const { addToast } = useToast();
  const [available, setAvailable] = useState(false);
  const [pos, setPos] = useState(null);
  const [requests, setRequests] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);
  const [center, setCenter] = useState(null);
  const [showRating, setShowRating] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const watchId = useRef(null);

  useEffect(() => {
    getCurrentPosition()
      .then((p) => setCenter([p.lat, p.lng]))
      .catch(() => setCenter([-12.0464, -77.0428]));
  }, []);

  useEffect(() => {
    if (!available) {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      return;
    }
    getCurrentPosition().then((p) => setCenter([p.lat, p.lng]));
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const { latitude, longitude, heading } = p.coords;
        const coords = { lat: latitude, lng: longitude, heading: heading || 0 };
        setPos(coords);
        supabase.from("driver_locations").upsert({
          driver_id: session.user.id,
          lat: latitude,
          lng: longitude,
          heading: heading || 0,
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000 }
    );
    return () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); };
  }, [available, session]);

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel("driver-requests")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "trips", filter: "status=eq.searching" }, (payload) => {
        const trip = payload.new;
        if (pos) {
          const d = Math.sqrt((pos.lat - trip.origin_lat) ** 2 + (pos.lng - trip.origin_lng) ** 2) * 111000;
          setRequests((prev) => [{ ...trip, _dist: Math.round(d) }, ...prev].slice(0, 10));
        } else {
          setRequests((prev) => [trip, ...prev].slice(0, 10));
        }
        notifyDriverNewRequest(session.user.id, trip.id);
        addToast({ title: "Nueva solicitud", message: `${trip.origin_name} → ${trip.dest_name}`, type: "info" });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "trips", filter: `driver_id=eq.${session.user.id}` }, (payload) => {
        const updated = payload.new;
        setActiveTrip(updated);
        if (updated.status === "in_progress") {
          addToast({ title: "Viaje iniciado", message: "Dirigite al destino", type: "info" });
        }
        if (updated.status === "completed") {
          notifyDriverTripCompleted(session.user.id);
          addToast({ title: "Viaje completado", message: "El viaje finalizó", type: "success" });
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [session, pos, addToast]);

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
    addToast({ title: "Solicitud aceptada", message: "Dirigite al origen", type: "success" });
  };

  const updateStatus = async (status) => {
    const updates = { status };
    if (status === "in_progress") updates.started_at = new Date().toISOString();
    if (status === "completed") updates.completed_at = new Date().toISOString();
    const { error } = await supabase.from("trips").update(updates).eq("id", activeTrip.id);
    if (error) return alert(error.message);
    if (status === "completed") setShowRating(true);
  };

  const actions = useMemo(() => {
    if (!activeTrip) return [];
    switch (activeTrip.status) {
      case "driver_assigned":
        return [{ label: "Iniciar viaje", action: "in_progress" }];
      case "in_progress":
        return [{ label: "Finalizar", action: "completed" }];
      default:
        return [];
    }
  }, [activeTrip]);

  const onAction = (action) => updateStatus(action);

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
      <NavBar />
      <div style={{ flex: 1, position: "relative" }}>
        <MapView
          origin={activeTrip ? { lat: activeTrip.origin_lat, lng: activeTrip.origin_lng } : null}
          dest={activeTrip ? { lat: activeTrip.dest_lat, lng: activeTrip.dest_lng } : null}
          driverPos={pos}
          center={center}
        />

        {showPanel && (
          <div className="panel">
            <div className="sheet-handle" />
            <div className="card">
              <div className="sheet-header">
                <div className="sheet-title">Modo conductor</div>
                <div className="badge warn">{available ? "Disponible" : "Desconectado"}</div>
              </div>

              <div className="row" style={{ marginBottom: 12 }}>
                <button
                  className={`btn btn-sm ${available ? "btn-secondary" : ""}`}
                  style={{ flex: 1 }}
                  onClick={() => setAvailable((v) => !v)}
                >
                  {available ? "Desactivar" : "Activar"}
                </button>
              </div>

              {!activeTrip && requests.length > 0 && (
                <div>
                  <div className="small" style={{ marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 }}>Solicitudes cercanas</div>
                  {requests.map((r) => (
                    <div key={r.id} className="place-row" style={{ marginBottom: 10 }}>
                      <div className="spot red" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{r.origin_name}</div>
                        <div className="small">{r.dest_name}</div>
                        <div className="small">{fmtDistance(r._dist || 0)} · {fmtMoney(r.price)}</div>
                      </div>
                      <button className="btn btn-sm" style={{ width: "auto" }} onClick={() => acceptTrip(r)}>
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
                        <button key={a.action} className="btn" onClick={() => onAction(a.action)}>
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <RatingModal open={showRating} tripId={activeTrip?.id} role={profile?.role} onClose={() => setShowRating(false)} />
      </div>
    </div>
  );
}
