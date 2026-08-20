import { useAuth } from "../context/AuthContext";

export default function NavBar() {
  const { session, profile, logout } = useAuth();

  return (
    <nav className="nav">
      <div className="brand">
        <div className="brand-dot" />
        <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: -0.2 }}>inDrive Clone</div>
        {profile && <div className={`badge ${profile.role === "conductor" ? "warn" : ""}`}>{profile.role}</div>}
      </div>
      <div className="row">
        <div className="small">{session?.user?.email}</div>
        <button className="btn btn-secondary btn-sm" onClick={logout}>Salir</button>
      </div>
    </nav>
  );
}
