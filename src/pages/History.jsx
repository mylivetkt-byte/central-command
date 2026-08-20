import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import NavBar from "../components/NavBar";

export default function History() {
  const { session } = useAuth();
  const [trips, setTrips] = useState([]);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("trips")
      .select("*")
      .or(`client_id.eq.${session.user.id},driver_id.eq.${session.user.id}`)
      .order("requested_at", { ascending: false })
      .then(({ data }) => setTrips(data || []));
  }, [session]);

  const statusCls = (s) => {
    if (s === "completed") return "ok";
    if (s === "cancelled") return "danger";
    if (s === "searching" || s === "driver_assigned") return "warn";
    return "";
  };

  return (
    <div style={{ minHeight: "100dvh", padding: "20px 16px 80px" }}>
      <NavBar />
      <div style={{ maxWidth: 720, margin: "18px auto 0" }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 14 }}>Historial de viajes</h2>
        <div style={{ display: "grid", gap: 10 }}>
          {trips.length === 0 && (
            <div className="card" style={{ textAlign: "center" }}>
              <div className="small">Aún no tienes viajes registrados.</div>
            </div>
          )}
          {trips.map((t) => (
            <div key={t.id} className="card" style={{ borderLeft: `3px solid ${t.status === "completed" ? "var(--ok)" : t.status === "cancelled" ? "var(--danger)" : "var(--accent)"}` }}>
              <div className="row">
                <div className={`badge ${statusCls(t.status)}`}>{t.status}</div>
                <div className="space" />
                <div className="price">$ {Number(t.price || 0).toFixed(2)}</div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t.origin_name}</div>
                <div className="small">↓ {t.dest_name}</div>
              </div>
              <div className="small mt-1">
                {new Date(t.requested_at).toLocaleString()} · {(t.distance_m / 1000).toFixed(1)} km
              </div>
              {(t.client_rating || t.driver_rating) && (
                <div className="small">⭐ {t.client_rating || t.driver_rating}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
