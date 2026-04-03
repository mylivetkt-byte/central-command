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

  // Mientras carga: spinner neutro (no redirige todavía)
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  // Sin sesión → login
  if (!user) return <Navigate to={redirectTo} replace />;

  // Con sesión pero sin rol todavía: puede que get_my_role aún no existe
  // Esperamos un ciclo más antes de redirigir
  if (role === null) return <Navigate to={redirectTo} replace />;

  // Rol incorrecto → login del rol correcto
  if (role !== requiredRole) return <Navigate to={redirectTo} replace />;

  return <>{children}</>;
};
