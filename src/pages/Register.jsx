import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Register() {
  const [step, setStep] = useState("role"); // role -> form
  const [role, setRole] = useState("cliente");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    vehicle: "",
  });
  const [error, setError] = useState("");
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const { error } = await register({ ...formData, role });
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
            {step === "role" ? "¿Cómo querés participar?" : "Crear cuenta"}
          </h1>
          <p className="sub" style={{ marginTop: 10 }}>
            {step === "role"
              ? "Elegí tu rol para comenzar. Podés cambiar entre cliente y conductor cuando quieras."
              : "Completá tus datos para registrarte en la plataforma."}
          </p>
        </div>
        <div className="small">v1.0 · Demo con Supabase + React</div>
      </div>

      <div className="auth-right">
        <div className="auth-box">
          {step === "role" ? (
            <>
              <div className="role-grid">
                <div
                  className={`role-card ${role === "cliente" ? "selected" : ""}`}
                  onClick={() => setRole("cliente")}
                >
                  <div className="role-icon">🧍</div>
                  <div className="role-title">Cliente</div>
                  <div className="role-desc">Pedir viajes, ver precios y pagar por el trayecto</div>
                </div>
                <div
                  className={`role-card ${role === "conductor" ? "selected" : ""}`}
                  onClick={() => setRole("conductor")}
                >
                  <div className="role-icon">🚗</div>
                  <div className="role-title">Conductor</div>
                  <div className="role-desc">Aceptar solicitudes, generar ingresos y manejar tu disponibilidad</div>
                </div>
              </div>
              <button className="btn" onClick={() => setStep("form")}>
                Continuar
              </button>
            </>
          ) : (
            <>
              <div className="badge warn" style={{ marginBottom: 12 }}>{role === "conductor" ? "CONDUCTOR" : "CLIENTE"}</div>
              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label>Nombre completo</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="Tu nombre"
                    required
                  />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="tu@email.com"
                    required
                  />
                </div>
                <div className="field">
                  <label>Contraseña</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                  />
                </div>
                <div className="field">
                  <label>Teléfono</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+51 999 999 999"
                    required
                  />
                </div>
                {role === "conductor" && (
                  <div className="field">
                    <label>Vehículo</label>
                    <input
                      type="text"
                      value={formData.vehicle}
                      onChange={(e) => setFormData({ ...formData, vehicle: e.target.value })}
                      placeholder="Ej: Toyota Corolla 2020 · ABC-123"
                      required
                    />
                  </div>
                )}
                {error && <div className="small" style={{ color: "var(--danger)", marginBottom: 10 }}>{error}</div>}
                <div className="row">
                  <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep("role")}>
                    Volver
                  </button>
                  <button type="submit" className="btn" style={{ flex: 2 }}>
                    Crear cuenta
                  </button>
                </div>
                <div className="small mt-1 text-center">
                  ¿Ya tenés cuenta? <a href="/login" onClick={(e) => { e.preventDefault(); navigate("/login"); }}>Ingresá</a>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
