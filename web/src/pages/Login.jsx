import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const { error } = await login(email, password);
    if (error) setError(error.message);
    else navigate("/");
  };

  return (
    <div className="auth-layout">
      <div className="auth-left">
        <div>
          <div className="brand" style={{ marginBottom: 20 }}>
            <div className="brand-dot" />
            <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: -0.3 }}>inDrive Clone</div>
          </div>
          <h1 style={{ fontSize: 32, lineHeight: 1.15, fontWeight: 800 }}>
            Bienvenido de <span style={{ color: "var(--accent)" }}>vuelta</span>.
          </h1>
          <p className="sub" style={{ marginTop: 10 }}>
            Ingresá para continuar con tu cuenta y ver tus viajes.
          </p>
        </div>
        <div className="small">v1.0 · Demo con Supabase + React</div>
      </div>

      <div className="auth-right">
        <div className="auth-box">
          <h1>Ingresar</h1>
          <p className="sub">Usá tu email y contraseña</p>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="field">
              <label>Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
            {error && <div className="small" style={{ color: "var(--danger)", marginBottom: 10 }}>{error}</div>}
            <button type="submit" className="btn">Entrar</button>
            <div className="small mt-1 text-center">
              ¿No tenés cuenta? <a href="/register" onClick={(e) => { e.preventDefault(); navigate("/register"); }}>Registrate</a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
