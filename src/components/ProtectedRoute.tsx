import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";

interface Props {
  children: ReactNode;
  requiredRole: "admin" | "driver";
  redirectTo: string;
}

export const ProtectedRoute = ({ children, requiredRole, redirectTo }: Props) => {
  const { user, role, loading: authLoading, signOut } = useAuth();
  const { company, loading: companyLoading } = useCompany();

  const loading = authLoading || (role === "admin" && companyLoading);

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

  // Si es administrador, validar el estado de su empresa (super_admin queda exento)
  if (role === "admin") {
    if (!company) {
      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6 p-6">
          <div className="text-center space-y-2">
            <p className="text-lg font-black text-white uppercase tracking-tighter">Sin Empresa Asociada</p>
            <p className="text-sm text-white/40 max-w-xs mx-auto">
              No tienes una empresa vinculada a tu cuenta de administrador. Por favor comunícate con el soporte de la plataforma.
            </p>
          </div>
          <button
            onClick={() => signOut()}
            className="w-full max-w-xs rounded-none bg-white py-4 text-sm font-black text-black uppercase tracking-widest hover:bg-white/90 transition-all active:scale-95 shadow-xl"
          >
            Cerrar Sesión
          </button>
        </div>
      );
    }

    if (company.status === "pendiente") {
      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6 p-6">
          <div className="text-center space-y-3">
            <div className="h-3 w-3 rounded-full bg-amber-500 animate-ping mx-auto mb-2" />
            <p className="text-lg font-black text-white uppercase tracking-tighter">Empresa en Evaluación</p>
            <p className="text-sm text-white/40 max-w-sm mx-auto leading-relaxed">
              El registro de <strong>{company.name}</strong> está pendiente de activación por el administrador de la plataforma.
            </p>
            <p className="text-xs text-white/30 max-w-xs mx-auto">
              Te notificaremos una vez tu cuenta sea activada. Si tienes preguntas, contacta a soporte.
            </p>
          </div>
          <button
            onClick={() => signOut()}
            className="w-full max-w-xs rounded-none bg-white py-4 text-sm font-black text-black uppercase tracking-widest hover:bg-white/90 transition-all active:scale-95 shadow-xl"
          >
            Cerrar Sesión
          </button>
        </div>
      );
    }

    if (company.status === "inactiva" || company.status === "suspendida") {
      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6 p-6">
          <div className="text-center space-y-3">
            <p className="text-lg font-black text-red-500 uppercase tracking-tighter">Acceso Restringido</p>
            <p className="text-sm text-white/40 max-w-sm mx-auto leading-relaxed">
              El acceso para la empresa <strong>{company.name}</strong> ha sido temporalmente desactivado o suspendido.
            </p>
            <p className="text-xs text-white/30 max-w-xs mx-auto">
              Comunícate con administración para regularizar tu estado.
            </p>
          </div>
          <button
            onClick={() => signOut()}
            className="w-full max-w-xs rounded-none bg-white py-4 text-sm font-black text-black uppercase tracking-widest hover:bg-white/90 transition-all active:scale-95 shadow-xl"
          >
            Cerrar Sesión
          </button>
        </div>
      );
    }
  }

  // Rol incorrecto para esta ruta → login del rol correcto
  // super_admin también puede acceder a rutas de admin
  const hasAccess = role === requiredRole || (requiredRole === "admin" && role === "super_admin");
  if (!hasAccess) return <Navigate to={redirectTo} replace />;

  return <>{children}</>;
};
