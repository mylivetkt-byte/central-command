import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bike, Mail, Lock, AlertCircle, User, ArrowLeft, CheckCircle, Check, X } from "lucide-react";
import { toast } from "sonner";
import { isValidPhone, phoneToSyntheticEmail } from "@/lib/phoneAuth";

const DriverLogin = () => {
  const [email, setEmail]                       = useState("");
  const [password, setPassword]                 = useState("");
  const [submitting, setSubmitting]             = useState(false);
  const [error, setError]                       = useState("");
  const [isSignUp, setIsSignUp]                 = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetSent, setResetSent]               = useState(false);
  const [fullName, setFullName]                 = useState("");
  const [phone, setPhone]                       = useState("");
  const [companies, setCompanies]               = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [authMethod, setAuthMethod]             = useState<"email" | "phone">("email");
  const [phoneLogin, setPhoneLogin]             = useState("");

  const navigate   = useNavigate();
  const { user, role, loading: authLoading } = useAuth();

  // Reglas de contraseña (solo se aplican al registrarse)
  const pwdRules = [
    { key: "len",   label: "Al menos 8 caracteres",           test: (p: string) => p.length >= 8 },
    { key: "upper", label: "Una letra mayúscula (A-Z)",       test: (p: string) => /[A-Z]/.test(p) },
    { key: "lower", label: "Una letra minúscula (a-z)",       test: (p: string) => /[a-z]/.test(p) },
    { key: "num",   label: "Un número (0-9)",                 test: (p: string) => /\d/.test(p) },
    { key: "sym",   label: "Un símbolo (!@#$%…)",             test: (p: string) => /[^A-Za-z0-9]/.test(p) },
  ];
  const pwdChecks = pwdRules.map(r => ({ ...r, ok: r.test(password) }));
  const pwdAllOk  = pwdChecks.every(c => c.ok);

  useEffect(() => {
    if (isSignUp) {
      supabase
        .from("saas_companies")
        .select("id, name")
        .eq("status", "activa")
        .then(({ data }) => {
          if (data) setCompanies(data);
        });
    }
  }, [isSignUp]);

  useEffect(() => {
    if (authLoading || !user) return;
    if (role === "driver") navigate("/driver", { replace: true });
    else if (role === "bloqueado") {
      setError("Tu empresa se encuentra inactiva, suspendida o pendiente de activación. Por favor, comunícate con la empresa.");
      supabase.auth.signOut();
    }
  }, [user, role, authLoading, navigate]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/#/driver-login`,
    });
    if (err) setError(err.message);
    else { setResetSent(true); toast.success("Correo enviado. Revisa tu bandeja."); }
    setSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      // Resolver el identificador (email real o email sintético a partir del móvil)
      let identifier = email.trim();
      if (authMethod === "phone") {
        const src = isSignUp ? phone : phoneLogin;
        if (!isValidPhone(src)) {
          setError("Ingresa un número de móvil válido (7-15 dígitos, con o sin +).");
          setSubmitting(false);
          return;
        }
        identifier = phoneToSyntheticEmail(src);
      }

      if (isSignUp) {
        if (!selectedCompanyId) {
          setError("Debes seleccionar una empresa para registrarte.");
          setSubmitting(false);
          return;
        }
        if (!pwdAllOk) {
          setError("La contraseña no cumple con todos los requisitos.");
          setSubmitting(false);
          return;
        }
        const { data, error: err } = await supabase.auth.signUp({
          email: identifier, password,
          options: {
            data: { 
              full_name: fullName, 
              phone, 
              role: "driver",
              company_id: selectedCompanyId
            },
            emailRedirectTo: window.location.origin,
          },
        });
        if (err) setError(err.message);
        else if (data.user && data.session) toast.success("¡Cuenta creada! Bienvenido.");
        else {
          toast.success(authMethod === "phone"
            ? "Registro exitoso. Ya puedes iniciar sesión con tu móvil."
            : "Registro exitoso. Confirma tu correo antes de entrar.");
          setIsSignUp(false);
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email: identifier, password });
        if (err) {
          if (err.message.includes("Email not confirmed"))
            setError("Debes confirmar tu correo antes de entrar. Revisa tu bandeja.");
          else if (err.message.includes("Invalid login credentials"))
            setError(authMethod === "phone" ? "Móvil o contraseña incorrectos." : "Correo o contraseña incorrectos.");
          else
            setError(err.message);
        }
      }
    } catch (ex: any) {
      setError("Error inesperado: " + (ex?.message || String(ex)));
    } finally {
      setSubmitting(false);
    }
  };

  // No mostramos una segunda pantalla de "Verificando sesión…" entre el splash y la app —
  // dejamos el fondo en blanco muy breve mientras el rol se resuelve.
  if (authLoading && user) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="glass-card p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto h-14 w-14 rounded-xl bg-gradient-success flex items-center justify-center">
              <Bike className="h-7 w-7 text-accent-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">GoMoto</h1>
            <p className="text-sm text-muted-foreground">App del Mensajero</p>
          </div>

          {isForgotPassword ? (
            <div className="space-y-4">
              {resetSent ? (
                <div className="text-center space-y-3 py-4">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                  <h3 className="font-semibold text-foreground">¡Correo enviado!</h3>
                  <p className="text-sm text-muted-foreground">
                    Revisa tu bandeja en <strong>{email}</strong>.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-foreground">Recuperar contraseña</h3>
                    <p className="text-xs text-muted-foreground">Ingresa tu correo y te enviamos un enlace.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Correo electrónico</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="reset-email" type="email" value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="correo@ejemplo.com" className="pl-10" required />
                    </div>
                  </div>
                  {error && (
                    <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg p-3">
                      <AlertCircle className="h-4 w-4 shrink-0" />{error}
                    </div>
                  )}
                  <Button type="submit" className="w-full bg-gradient-success" disabled={submitting}>
                    {submitting ? "Enviando..." : "Enviar correo de recuperación"}
                  </Button>
                </form>
              )}
              <button type="button"
                onClick={() => { setIsForgotPassword(false); setResetSent(false); setError(""); }}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3 w-3" /> Volver al inicio de sesión
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex rounded-lg overflow-hidden border border-border text-xs font-bold">
                  <button type="button" onClick={() => { setAuthMethod("email"); setError(""); }}
                    className={`flex-1 py-2 transition-colors ${authMethod === "email" ? "bg-accent text-accent-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted"}`}>
                    📧 Correo
                  </button>
                  <button type="button" onClick={() => { setAuthMethod("phone"); setError(""); }}
                    className={`flex-1 py-2 transition-colors ${authMethod === "phone" ? "bg-accent text-accent-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted"}`}>
                    📱 Móvil
                  </button>
                </div>
                {isSignUp && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Nombre completo</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="fullName" value={fullName}
                          onChange={e => setFullName(e.target.value)}
                          placeholder="Tu nombre" className="pl-10" required />
                      </div>
                    </div>
                    {authMethod === "email" && (
                      <div className="space-y-2">
                        <Label htmlFor="phone">Teléfono</Label>
                        <Input id="phone" value={phone}
                          onChange={e => setPhone(e.target.value)}
                          placeholder="+57 300 000 0000" required />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="companySelect">Empresa a la que te registras *</Label>
                      <select
                        id="companySelect"
                        value={selectedCompanyId}
                        onChange={(e) => setSelectedCompanyId(e.target.value)}
                        required
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 font-bold"
                      >
                        <option value="">-- Selecciona una empresa --</option>
                        {companies.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                {authMethod === "email" ? (
                  <div className="space-y-2">
                    <Label htmlFor="email">Correo electrónico</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="email" type="email" value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="correo@ejemplo.com" className="pl-10" required />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="phoneAuth">Número de móvil</Label>
                    <Input id="phoneAuth" type="tel"
                      value={isSignUp ? phone : phoneLogin}
                      onChange={e => isSignUp ? setPhone(e.target.value) : setPhoneLogin(e.target.value)}
                      placeholder="+57 300 000 0000" required inputMode="tel" />
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Contraseña</Label>
                    {!isSignUp && authMethod === "email" && (
                      <button type="button"
                        onClick={() => { setIsForgotPassword(true); setError(""); }}
                        className="text-xs text-accent hover:underline">
                        ¿Olvidaste tu contraseña?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="password" type="password" value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••" className="pl-10" required minLength={6} />
                  </div>
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg p-3">
                    <AlertCircle className="h-4 w-4 shrink-0" />{error}
                  </div>
                )}
                <Button type="submit" className="w-full bg-gradient-success"
                  disabled={submitting || authLoading}>
                  {submitting ? "Iniciando sesión..." : isSignUp ? "Registrarme como mensajero" : "Iniciar sesión"}
                </Button>
              </form>

              <div className="text-center">
                <button type="button"
                  onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
                  className="text-sm font-semibold text-primary hover:underline">
                  {isSignUp ? "¿Ya tienes cuenta? Inicia sesión" : "¿Nuevo mensajero? Regístrate"}
                </button>
              </div>
              <div className="text-center">
                <button type="button" onClick={() => navigate("/admin-login")}
                  className="text-xs text-muted-foreground hover:text-foreground">
                  ¿Eres administrador? Entra aquí
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DriverLogin;
