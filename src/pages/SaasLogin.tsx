import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Mail, Lock, AlertCircle } from "lucide-react";

const SaasLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user && role === "super_admin") {
      navigate("/saas/companies", { replace: true });
    }
  }, [user, role, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(
          err.message.includes("Invalid login credentials")
            ? "Correo o contraseña incorrectos."
            : err.message
        );
      }
    } catch (ex: any) {
      setError("Error inesperado: " + (ex?.message || String(ex)));
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading && user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="border border-zinc-800 bg-zinc-900/50 p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-zinc-300" />
            </div>
            <h1 className="text-lg font-semibold text-zinc-100">GoMoto SaaS</h1>
            <p className="text-sm text-zinc-500">Gestión de empresas</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="saas-email" className="text-zinc-400 text-xs">Correo electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                <Input id="saas-email" type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@ejemplo.com"
                  className="bg-zinc-800/50 border-zinc-700 text-zinc-100 pl-10 text-sm" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="saas-password" className="text-zinc-400 text-xs">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                <Input id="saas-password" type="password" value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-zinc-800/50 border-zinc-700 text-zinc-100 pl-10 text-sm" required minLength={6} />
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-red-400 text-xs bg-red-950/50 p-3">
                <AlertCircle className="h-3 w-3 shrink-0" />{error}
              </div>
            )}
            <Button type="submit" className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-none"
              disabled={submitting || authLoading}>
              {submitting ? "Entrando..." : "Entrar al panel SaaS"}
            </Button>
          </form>
          <div className="text-center">
            <button type="button" onClick={() => navigate("/admin-login")}
              className="text-xs text-zinc-600 hover:text-zinc-400">
              Volver al panel de administración
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaasLogin;
