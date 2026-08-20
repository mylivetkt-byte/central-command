import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import NavBar from "../components/NavBar";

export default function Admin() {
  const [trips, setTrips] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("trips").select("*").order("requested_at", { ascending: false }).limit(100),
      supabase.from("profiles").select("*"),
    ]).then(([{ data: t }, { data: u }]) => {
      setTrips(t || []);
      setUsers(u || []);
      setLoading(false);
    });
  }, []);

  const total = trips.reduce((s, t) => s + (Number(t.price) || 0), 0);

  return (
    <div style={{ minHeight: "100dvh", padding: "20px 16px 80px" }}>
      <NavBar />
      <div style={{ maxWidth: 1000, margin: "18px auto 0" }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 14 }}>Panel admin</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 18 }}>
          <div className="card">
            <div className="small">Usuarios</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{users.length}</div>
          </div>
          <div className="card">
            <div className="small">Viajes</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{trips.length}</div>
          </div>
          <div className="card">
            <div className="small">Ingresos</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--accent)" }}>$ {total.toFixed(2)}</div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div className="card">
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Usuarios recientes</h3>
            {loading && <div className="small">Cargando...</div>}
            {users.map((u) => (
              <div key={u.id} className="row" style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ width: 32, height: 32, borderRadius: 999, background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>
                  {(u.full_name?.[0] || "?").toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{u.full_name || "Sin nombre"}</div>
                  <div className="small">{u.role} · {u.phone}</div>
                </div>
                <div className="badge">{u.role}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Viajes recientes</h3>
            {trips.map((t) => (
              <div key={t.id} className="row" style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{t.origin_name} → {t.dest_name}</div>
                  <div className="small">{new Date(t.requested_at).toLocaleString()}</div>
                </div>
                <div className={`badge ${t.status === "completed" ? "ok" : t.status === "cancelled" ? "danger" : "warn"}`}>{t.status}</div>
                <div className="price" style={{ fontSize: 14 }}>$ {Number(t.price || 0).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
