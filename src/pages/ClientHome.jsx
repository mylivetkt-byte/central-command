import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar";
import MapView from "../components/MapView";
import PlaceSearch from "../components/PlaceSearch";
import TripCard from "../components/TripCard";
import RatingModal from "../components/RatingModal";
import ConfirmDialog from "../components/ConfirmDialog";
import { supabase } from "../lib/supabase";
import { searchPlaces, getRoute, estimatePrice, getCurrentPosition, fmtDistance, fmtMoney, fmtDuration } from "../lib/geo";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { notifyClientTripRequested, notifyClientTripStatus } from "../lib/notifications";

export default function ClientHome() {
  const { profile, session } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [origin, setOrigin] = useState(null);
  const [dest, setDest] = useState(null);
  const [trip, setTrip] = useState(null);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [center, setCenter] = useState(null);
  const [driverPos, setDriverPos] = useState(null);
  const [showRating, setShowRating] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const [step, setStep] = useState("pick");
  const [showPanel, setShowPanel] = useState(true);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [userPos, setUserPos] = useState(null);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("trips")
      .select("*")
      .eq("client_id", session.user.id)
      .in("status", ["searching", "driver_assigned", "in_progress"])
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setActiveTrip(data);
          setTrip(data);
          setOrigin({ lat: data.origin_lat, lng: data.origin_lng, name: data.origin_name });
          setDest({ lat: data.dest_lat, lng: data.dest_lng, name: data.dest_name });
          setStep(data.status === "searching" ? "searching" : "active");
        }
      });
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel("client-trip")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "trips", filter: `client_id=eq.${session.user.id}` },
        (payload) => {
          const updated = payload.new;
          setActiveTrip(updated);
          setTrip(updated);
          if (updated.driver_lat && updated.driver_lng) {
            setDriverPos({ lat: updated.driver_lat, lng: updated.driver_lng });
          }
          if (updated.status === "completed") {
            setShowRating(true);
            notifyClientTripStatus(session.user.id, "completed");
            addToast({ title: "Viaje completado", message: "Calificá a tu conductor", type: "success" });
          }
          if (updated.status === "cancelled") {
            notifyClientTripStatus(session.user.id, "cancelled");
            addToast({ title: "Viaje cancelado", message: "La solicitud fue cancelada", type: "error" });
          }
          if (updated.status === "driver_assigned") {
            notifyClientTripStatus(session.user.id, "driver_assigned");
            addToast({ title: "Conductor asignado", message: "Tu conductor está en camino", type: "success" });
          }
          if (updated.status === "in_progress") {
            notifyClientTripStatus(session.user.id, "in_progress");
            addToast({ title: "Viaje iniciado", message: "Ya estás en camino", type: "info" });
          }
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    if (!origin || !dest) { setRoute(null); return; }
    (async () => {
      const r = await getRoute(origin, dest);
      if (cancelled) return;
      setRoute(r);
    })();
    return () => { cancelled = true; };
  }, [origin, dest]);

  useEffect(() => {
    getCurrentPosition()
      .then((pos) => {
        const c = [pos.lat, pos.lng];
        setCenter(c);
        setUserPos({ lat: pos.lat, lng: pos.lng });
      })
      .catch(() => setCenter([-12.0464, -77.0428]));
  }, []);

  const price = useMemo(() => {
    if (!route?.distanceM) return 0;
    return estimatePrice(route.distanceM);
  }, [route]);

  const ensureProfile = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    if (!data) {
      const name = session.user.user_metadata?.full_name || session.user.email || "Cliente";
      await supabase.from("profiles").upsert({
        id: session.user.id,
        role: "cliente",
        full_name: name,
        phone: "",
        rating: 5,
        trips_done: 0,
      });
    }
  }, [session]);

  const submitRequest = useCallback(async () => {
    if (!origin || !dest) return alert("Selecciona origen y destino");
    setLoading(true);
    await ensureProfile();
    const { data: tripRow, error } = await supabase
      .from("trips")
      .insert({
        client_id: session.user.id,
        origin_name: origin.name,
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        dest_name: dest.name,
        dest_lat: dest.lat,
        dest_lng: dest.lng,
        price: route?.distanceM ? estimatePrice(route.distanceM) : 5,
        distance_m: route?.distanceM || 0,
        duration_s: route?.durationS || 0,
      })
      .select("*")
      .single();
    setLoading(false);
    if (error) return alert(error.message);
    setActiveTrip(tripRow);
    setTrip(tripRow);
    setStep("searching");
    await notifyClientTripRequested(session.user.id, tripRow.id);
    addToast({ title: "Viaje solicitado", message: "Buscando conductor cerca...", type: "info" });
  }, [origin, dest, route, session, ensureProfile, addToast]);

  const cancelTrip = async () => {
    if (!activeTrip) return;
    const { error } = await supabase.from("trips").update({ status: "cancelled", cancelled_by: "cliente" }).eq("id", activeTrip.id);
    if (error) return alert(error.message);
    setActiveTrip(null);
    setTrip(null);
    setRoute(null);
    setDest(null);
    setOrigin(null);
    setStep("pick");
    setConfirmCancel(false);
  };

  const completeAndRate = () => {
    if (!activeTrip) return;
    supabase.from("trips").update({ status: "completed" }).eq("id", activeTrip.id);
    setShowRating(true);
  };

  const onTripAction = (action, currentTrip) => {
    if (action === "cancel") setConfirmCancel(true);
    if (action === "complete") completeAndRate();
  };

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
      <NavBar />
      <div style={{ flex: 1, position: "relative" }}>
        <MapView
          origin={origin}
          dest={dest}
          driverPos={driverPos}
          routeCoords={route?.coords}
          center={center}
        />

        {/* botón de ubicación actual */}
        <button
          className="fab"
          style={{ right: 16, bottom: "calc(80px + env(safe-area-inset-bottom))", background: "var(--bg-card)", color: "var(--text)", border: "1.5px solid #2a313c", width: 48, height: 48, fontSize: 20 }}
          onClick={() => getCurrentPosition().then((p) => setCenter([p.lat, p.lng])).catch(() => setCenter([-12.0464, -77.0428]))}
          title="Mi ubicación"
        >
          📍
        </button>

        {!activeTrip && showPanel && (
          <div className="panel">
            <div className="sheet-handle" />
            <div className="card">
              <div className="sheet-header">
                <div className="sheet-title">¿A dónde vas?</div>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowPanel(false)}>Cerrar</button>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <PlaceSearch
                  label=""
                  placeholder="Buscar origen"
                  near={userPos}
                  onSelect={(p) => { setOrigin(p); setCenter([p.lat, p.lng]); }}
                />
                <PlaceSearch
                  label=""
                  placeholder="Buscar destino"
                  near={userPos}
                  onSelect={(p) => { setDest(p); setCenter([p.lat, p.lng]); }}
                />
              </div>

              {route && (
                <div className="card mt-1" style={{ background: "rgba(57,255,20,0.06)", borderColor: "rgba(57,255,20,0.20)" }}>
                  <div className="row">
                    <div>
                      <div className="small">Distancia · Tiempo</div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{fmtDistance(route.distanceM)} · {fmtDuration(route.durationS)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="small">Precio</div>
                      <div className="price">{fmtMoney(price)}</div>
                    </div>
                  </div>
                </div>
              )}

              <button
                className="btn mt-1"
                disabled={loading || !origin || !dest}
                onClick={() => setStep("confirm")}
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {!activeTrip && !showPanel && (
          <button className="fab" onClick={() => setShowPanel(true)} title="Solicitar viaje">
            +
          </button>
        )}

        {activeTrip && (
          <div className="panel">
            <TripCard trip={activeTrip} onClose={() => {}} onAction={onTripAction} />
          </div>
        )}

        <RatingModal open={showRating} tripId={activeTrip?.id} role={profile?.role} onClose={() => setShowRating(false)} />
        <ConfirmDialog
          open={confirmCancel}
          title="Cancelar viaje"
          message="¿Estás seguro de que querés cancelar esta solicitud? Esta acción no se puede deshacer."
          confirmLabel="Sí, cancelar"
          onConfirm={cancelTrip}
          onCancel={() => setConfirmCancel(false)}
        />
      </div>
    </div>
  );
}
