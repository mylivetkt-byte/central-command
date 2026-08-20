import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function TripCard({ trip, onClose, onAction }) {
  const [actions, setActions] = useState([]);

  useEffect(() => {
    if (!trip) return;
    const map = {
      searching: [{ label: "Cancelar solicitud", action: "cancel", variant: "danger" }],
      driver_assigned: [
        { label: "Llegué al origen", action: "arrive", variant: "warn" },
        { label: "Cancelar", action: "cancel", variant: "danger" },
      ],
      in_progress: [{ label: "Finalizar viaje", action: "complete", variant: "ok" }],
      completed: [],
      cancelled: [],
    };
    setActions(map[trip.status] || []);
  }, [trip]);

  if (!trip) return null;

  const statusMap = {
    searching: { label: "Buscando conductor...", cls: "warn" },
    driver_assigned: { label: "Conductor asignado", cls: "" },
    in_progress: { label: "Viaje en curso", cls: "" },
    completed: { label: "Completado", cls: "ok" },
    cancelled: { label: "Cancelado", cls: "danger" },
  };
  const status = statusMap[trip.status] || { label: trip.status, cls: "" };

  return (
    <div className="card" style={{ borderLeft: `3px solid ${trip.status === "completed" ? "var(--ok)" : trip.status === "cancelled" ? "var(--danger)" : "var(--accent)"}` }}>
      <div className="row" style={{ marginBottom: 10 }}>
        <div className={`badge ${status.cls}`}>{status.label}</div>
        <div className="space" />
        {trip.price > 0 && <div className="price">$ {trip.price.toFixed(2)}</div>}
      </div>

      <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
        <div className="row">
          <div className="spot" />
          <div className="small" style={{ color: "var(--text)" }}>{trip.origin_name}</div>
        </div>
        <div className="row">
          <div className="spot red" />
          <div className="small" style={{ color: "var(--text)" }}>{trip.dest_name}</div>
        </div>
      </div>

      {trip.distance_m > 0 && (
        <div className="small">
          {(trip.distance_m / 1000).toFixed(1)} km · {Math.round(trip.duration_s / 60)} min aprox.
        </div>
      )}

      {trip.driver_id && (
        <div className="small mt-1">Conductor: {trip.driver_id.slice(0, 8)}...</div>
      )}

      {actions.length > 0 && (
        <div className="row mt-2">
          {actions.map((a) => (
            <button
              key={a.action}
              className={`btn btn-sm ${a.variant === "danger" ? "btn-secondary" : a.variant === "warn" ? "btn-secondary" : ""}`}
              style={{ flex: 1 }}
              onClick={() => onAction(a.action, trip)}
            >
              {a.label}
            </button>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cerrar</button>
        </div>
      )}
    </div>
  );
}
