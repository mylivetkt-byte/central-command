import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, Mail, Lock, AlertCircle, ArrowLeft, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const AdminLogin = () => {
  const [email, setEmail]                   = useState("");
  const [password, setPassword]             = useState("");
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState("");
  const [isSignUp, setIsSignUp]             = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetSent, setResetSent]           = useState(false);
  const [fullName, setFullName]             = useState("");
  const [companyName, setCompanyName]       = useState("");

  const navigate   = useNavigate();
  const { user, role, loading: authLoading } = useAuth();

  // Redirige automáticamente si la sesión ya está activa.
  // El super_admin va al panel SaaS; el admin de empresa al dashboard operativo.
  useEffect(() => {
    if (authLoading || !user) return;
    if (role === "super_admin") navigate("/saas/companies", { replace: true });
    else if (role === "admin") navigate("/", { replace: true });
  }, [user, role, authLoading, navigate]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/#/admin-login`,
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
      if (isSignUp) {
        if (!companyName.trim()) {
          setError("El nombre de la empresa es obligatorio.");
          setSubmitting(false);
          return;
        }
        const { error: err } = await supabase.auth.signUp({
          email, password,
          options: {
            data: { 
              full_name: fullName, 
              role: "admin", 
              company_name: companyName.trim() 
            },
            emailRedirectTo: window.location.origin,
          },
        });
        if (err) setError(err.message);
        else { 
          toast.success("Cuenta creada y empresa registrada. Está pendiente de activación."); 
          setIsSignUp(false); 
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) {
          setError(
            err.message.includes("Invalid login credentials")
              ? "Correo o contraseña incorrectos."
              : err.message
          );
        }
        // El redirect lo maneja el useEffect de arriba una vez que role === "admin"
      }
    } catch (ex: any) {
      setError("Error inesperado: " + (ex?.message || String(ex)));
    } finally {
      setSubmitting(false);
    }
  };

  // Solo mostramos el spinner si hay usuario pero el rol aún se está resolviendo
  if (authLoading && user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="glass-card p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto h-14 w-14 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Truck className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">GoMoto Admin</h1>
            <p className="text-sm text-muted-foreground">Panel de Administración</p>
          </div>

          {isForgotPassword ? (
            <div className="space-y-4">
              {resetSent ? (
                <div className="text-center space-y-3 py-4">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                  <h3 className="font-semibold text-foreground">¡Correo enviado!</h3>
                  <p className="text-sm text-muted-foreground">
                    Revisa tu bandeja en <strong>{email}</strong> y sigue el enlace para restablecer tu contraseña.
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
                        placeholder="admin@empresa.com" className="pl-10" required />
                    </div>
                  </div>
                  {error && (
                    <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg p-3">
                      <AlertCircle className="h-4 w-4 shrink-0" />{error}
                    </div>
                  )}
                  <Button type="submit" className="w-full bg-gradient-primary" disabled={submitting}>
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
                {isSignUp && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Nombre completo</Label>
                      <Input id="fullName" value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        placeholder="Tu nombre" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Nombre de tu Empresa *</Label>
                      <Input id="companyName" value={companyName}
                        onChange={e => setCompanyName(e.target.value)}
                        placeholder="Ej: Transportes Express S.A.S." required />
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="email" type="email" value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="admin@empresa.com" className="pl-10" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Contraseña</Label>
                    {!isSignUp && (
                      <button type="button"
                        onClick={() => { setIsForgotPassword(true); setError(""); }}
                        className="text-xs text-primary hover:underline">
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
                <Button type="submit" className="w-full bg-gradient-primary" disabled={submitting || authLoading}>
                  {submitting ? "Iniciando sesión..." : isSignUp ? "Crear cuenta" : "Iniciar sesión"}
                </Button>
              </form>

              <div className="text-center">
                <button type="button"
                  onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
                  className="text-sm text-primary hover:underline">
                  {isSignUp ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Regístrate"}
                </button>
              </div>
              <div className="text-center mt-2">
                <button type="button" onClick={() => navigate("/driver-login")}
                  className="text-xs text-muted-foreground hover:text-foreground">
                  ¿Eres mensajero? Entra aquí
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
