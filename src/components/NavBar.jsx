import { useAuth } from "../context/AuthContext";
import { APP_VERSION } from "../constants/appVersion";

export default function NavBar() {
  const { session, profile, logout } = useAuth();

  return (
    <nav className="nav">
      <div className="brand">
        <div className="brand-dot" />
        <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: -0.2 }}>inDrive Clone</div>
        <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, background: "rgba(255,255,255,0.08)", padding: "2px 6px", borderRadius: 6 }}>
          v{APP_VERSION}
        </span>
        {profile && <div className={`badge ${profile.role === "conductor" ? "warn" : ""}`}>{profile.role}</div>}
      </div>
      <div className="row">
        <div className="small">{session?.user?.email}</div>
        <button className="btn btn-secondary btn-sm" onClick={logout}>Salir</button>
      </div>
    </nav>
  );
}
