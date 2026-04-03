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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">No se pudo verificar tu rol</p>
          <p className="text-xs text-muted-foreground">Revisa tu conexión e intenta de nuevo</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Rol incorrecto para esta ruta → login del rol correcto
  if (role !== requiredRole) return <Navigate to={redirectTo} replace />;

  return <>{children}</>;
};
