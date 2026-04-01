import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bike, Mail, Lock, AlertCircle, User } from "lucide-react";
import { toast } from "sonner";

const DriverLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (isSignUp) {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, phone },
          emailRedirectTo: window.location.origin,
        },
      });
      if (signUpError) {
        setError(signUpError.message);
      } else {
        toast.success("Revisa tu correo para confirmar tu cuenta. Un administrador activará tu perfil.");
      }
    } else {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
      } else if (data.user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .maybeSingle();

        if (roleData?.role !== "driver") {
          await supabase.auth.signOut();
          setError("No tienes cuenta de mensajero");
        } else {
          navigate("/driver");
        }
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="glass-card p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto h-14 w-14 rounded-xl bg-gradient-success flex items-center justify-center">
              <Bike className="h-7 w-7 text-accent-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">LogiCentral</h1>
            <p className="text-sm text-muted-foreground">App del Mensajero</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nombre completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Tu nombre"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+57 300 000 0000"
                    required
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full bg-gradient-success" disabled={loading}>
              {loading ? "Cargando..." : isSignUp ? "Registrarme como mensajero" : "Iniciar sesión"}
            </Button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
              className="text-sm text-accent hover:underline"
            >
              {isSignUp ? "¿Ya tienes cuenta? Inicia sesión" : "¿Nuevo mensajero? Regístrate"}
            </button>
          </div>

          <div className="text-center">
            <a href="/admin-login" className="text-xs text-muted-foreground hover:text-foreground">
              ¿Eres administrador? Entra aquí
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverLogin;
