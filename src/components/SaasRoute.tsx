import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export const SaasRoute = ({ children }: { children: ReactNode }) => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/saas/login" replace />;

  if (role === null) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-6 p-6">
        <p className="text-sm text-zinc-500">No se pudo verificar tu rol</p>
        <button onClick={() => window.location.reload()}
          className="bg-zinc-800 text-zinc-100 px-6 py-3 text-sm hover:bg-zinc-700 transition-all">
          Reintentar
        </button>
      </div>
    );
  }

  if (role !== "super_admin") {
    if (role === "driver") return <Navigate to="/driver" replace />;
    if (role === "admin") return <Navigate to="/" replace />;
    return <Navigate to="/saas/login" replace />;
  }

  return <>{children}</>;
};
