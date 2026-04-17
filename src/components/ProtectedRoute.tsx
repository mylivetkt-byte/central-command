import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  children: ReactNode;
  requiredRole: "admin" | "driver";
  redirectTo: string;
}

export const ProtectedRoute = ({ children, requiredRole, redirectTo }: Props) => {
  const { user, role, loading } = useAuth();

  // Mientras se resuelve la sesión inicial: mostrar spinner, nunca redirigir
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  // Sin sesión → ir al login
  if (!user) return <Navigate to={redirectTo} replace />;

  // Hay usuario pero no se pudo obtener el rol (fallo de red, RPC no existe, etc.)
  // En este caso NO redirigimos — mostramos un estado de error con reintento.
  if (role === null) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6 p-6">
        <div className="text-center space-y-2">
          <p className="text-lg font-black text-white uppercase tracking-tighter">No se pudo verificar tu rol</p>
          <p className="text-sm text-white/40 max-w-xs mx-auto">
            Tenemos problemas para confirmar tu acceso. Revisa tu conexión a internet e intenta de nuevo.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="w-full max-w-xs rounded-none bg-white py-4 text-sm font-black text-black uppercase tracking-widest hover:bg-white/90 transition-all active:scale-95 shadow-xl"
        >
          Reintentar ahora
        </button>
      </div>
    );
  }

  // Rol incorrecto para esta ruta → login del rol correcto
  if (role !== requiredRole) return <Navigate to={redirectTo} replace />;

  return <>{children}</>;
};
