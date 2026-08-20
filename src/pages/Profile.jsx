import { useState, useEffect } from "react";
import NavBar from "../components/NavBar";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { profile, session, updateProfile, logout } = useAuth();
  const [form, setForm] = useState({ full_name: "", phone: "", vehicle: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) setForm({ full_name: profile.full_name || "", phone: profile.phone || "", vehicle: profile.vehicle || "" });
  }, [profile]);

  const save = async () => {
    setSaving(true);
    const { error } = await updateProfile(form);
    setSaving(false);
    if (error) alert(error.message);
    else alert("Perfil actualizado");
  };

  const uploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;
    const path = `${session.user.id}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) return alert(error.message);
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    await updateProfile({ photo_url: data.publicUrl });
  };

  if (!profile) return <div className="nav">Cargando...</div>;

  return (
    <div style={{ minHeight: "100dvh", padding: "20px 16px 80px" }}>
      <NavBar />
      <div className="card" style={{ maxWidth: 480, margin: "18px auto 0" }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 14 }}>Perfil</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: 999, background: "var(--bg-elevated)", border: "1px solid #2a313c", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700 }}>
            {(profile.photo_url ? <img src={profile.photo_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (profile.full_name?.[0] || "?").toUpperCase())}
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>{profile.full_name || "Sin nombre"}</div>
            <div className="small">{profile.role} · ★ {profile.rating?.toFixed(1)} · {profile.trips_done} viajes</div>
          </div>
        </div>

        <div className="field">
          <label>Nombre completo</label>
          <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </div>
        <div className="field">
          <label>Teléfono</label>
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        {profile.role === "conductor" && (
          <div className="field">
            <label>Vehículo</label>
            <input value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} />
          </div>
        )}
        <div className="field">
          <label>Foto de perfil</label>
          <input type="file" accept="image/*" onChange={uploadPhoto} />
        </div>
        <div className="row mt-2">
          <button className="btn" disabled={saving} onClick={save}>{saving ? "Guardando..." : "Guardar cambios"}</button>
          <button className="btn btn-secondary" onClick={logout}>Cerrar sesión</button>
        </div>
      </div>
    </div>
  );
}
