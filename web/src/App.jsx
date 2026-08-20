import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ClientHome from "./pages/ClientHome";
import DriverHome from "./pages/DriverHome";
import History from "./pages/History";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import Splash from "./components/Splash";

function BottomNav() {
  const { profile } = useAuth();
  const loc = useLocation();
  if (!profile) return null;
  const is = (p) => loc.pathname === p;
  const cls = (p) => `nav-item ${is(p) ? "active" : ""}`;
  return (
    <div className="bottom-nav">
      {profile.role === "cliente" && (
        <>
          <Link to="/" className={cls("/")}>Pedir</Link>
          <Link to="/history" className={cls("/history")}>Historial</Link>
        </>
      )}
      {profile.role === "conductor" && (
        <>
          <Link to="/" className={cls("/")}>Conducir</Link>
          <Link to="/history" className={cls("/history")}>Historial</Link>
        </>
      )}
      <Link to="/profile" className={cls("/profile")}>Perfil</Link>
    </div>
  );
}

function RolePicker() {
  const { session, updateProfile } = useAuth();
  const [role, setRole] = useState("cliente");

  const select = async () => {
    if (!session) return;
    await updateProfile({ role });
    window.location.reload();
  };

  return (
    <div className="auth-layout" style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 420, padding: 24 }}>
        <div className="brand" style={{ marginBottom: 20, justifyContent: "center" }}>
          <div className="brand-dot" />
          <div style={{ fontWeight: 800, fontSize: 20 }}>inDrive Clone</div>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, textAlign: "center", marginBottom: 6 }}>
          Elegí tu rol
        </h1>
        <p className="sub text-center" style={{ marginBottom: 20 }}>
          Seleccioná cómo querés usar la app
        </p>
        <div className="role-grid">
          <div
            className={`role-card ${role === "cliente" ? "selected" : ""}`}
            onClick={() => setRole("cliente")}
          >
            <div className="role-icon">🧍</div>
            <div className="role-title">Cliente</div>
            <div className="role-desc">Pedir viajes y pagar por el trayecto</div>
          </div>
          <div
            className={`role-card ${role === "conductor" ? "selected" : ""}`}
            onClick={() => setRole("conductor")}
          >
            <div className="role-icon">🚗</div>
            <div className="role-title">Conductor</div>
            <div className="role-desc">Aceptar solicitudes y generar ingresos</div>
          </div>
        </div>
        <button className="btn" onClick={select}>Confirmar</button>
      </div>
    </div>
  );
}

export default function App() {
  const [splash, setSplash] = useState(true);
  const { session, loading, profile } = useAuth();

  if (loading || splash) {
    return <Splash onFinish={() => setSplash(false)} />;
  }

  if (!session) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    );
  }

  if (!profile?.role) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<RolePicker />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Navigate to="/" />} />
        <Route path="/register" element={<Navigate to="/" />} />
        <Route path="/role" element={<RolePicker />} />
        <Route
          path="/"
          element={
            profile?.role === "conductor" ? <DriverHome /> : <ClientHome />
          }
        />
        <Route path="/history" element={<History />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <BottomNav />
    </BrowserRouter>
  );
}
