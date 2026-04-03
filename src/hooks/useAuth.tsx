import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "driver" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser]       = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole]       = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);

  const mounted      = useRef(true);
  const initDone     = useRef(false);
  const fetchingRole = useRef(false);

  // Usa RPC SECURITY DEFINER — evita bloqueos por RLS durante refresco de token
  const fetchRole = useCallback(async (): Promise<AppRole> => {
    if (fetchingRole.current) return null;
    fetchingRole.current = true;
    try {
      const { data, error } = await supabase.rpc("get_my_role");
      if (error) {
        console.error("[useAuth] fetchRole error:", error.message);
        return null;
      }
      return (data as AppRole) ?? null;
    } catch (e) {
      console.error("[useAuth] fetchRole exception:", e);
      return null;
    } finally {
      fetchingRole.current = false;
    }
  }, []);

  const applySession = useCallback(async (newSession: Session | null) => {
    if (!mounted.current) return;
    setSession(newSession);
    setUser(newSession?.user ?? null);
    if (newSession?.user) {
      const r = await fetchRole();
      if (mounted.current) setRole(r);
    } else {
      setRole(null);
    }
    if (mounted.current) setLoading(false);
  }, [fetchRole]);

  useEffect(() => {
    mounted.current  = true;
    initDone.current = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted.current) return;
        console.log("[useAuth] event:", event, "user:", newSession?.user?.email ?? "none");

        if (event === "INITIAL_SESSION") {
          // Ignorado — getSession() abajo maneja la inicialización.
          // Evita doble ejecución que causaba parpadeo y logout falso.
          return;
        }

        if (event === "SIGNED_IN") {
          setLoading(true);
          await applySession(newSession);
          return;
        }

        if (event === "SIGNED_OUT") {
          setUser(null);
          setSession(null);
          setRole(null);
          setLoading(false);
          return;
        }

        if (event === "TOKEN_REFRESHED") {
          // Solo actualizamos session/user — NO re-fetchamos el rol.
          // Antes se llamaba applySession aquí, lo que disparaba un segundo
          // fetchRole que competía con el inicial y podía pisar role=null,
          // causando que ProtectedRoute redirigiera al login en medio de carga.
          if (mounted.current) {
            setSession(newSession);
            setUser(newSession?.user ?? null);
          }
          return;
        }

        if (event === "USER_UPDATED") {
          setLoading(true);
          await applySession(newSession);
          return;
        }
      }
    );

    // getSession() es la fuente de verdad para la carga inicial.
    // Se llama DESPUÉS de suscribirse para que INITIAL_SESSION (que se
    // dispara síncronamente al suscribirse si hay sesión en localStorage)
    // ya esté ignorado cuando llegamos aquí.
    supabase.auth.getSession().then(({ data: { session: currentSession }, error }) => {
      if (!mounted.current) return;
      if (error) {
        console.error("[useAuth] getSession error:", error.message);
        setLoading(false);
        return;
      }
      if (!initDone.current) {
        initDone.current = true;
        applySession(currentSession);
      }
    });

    // Failsafe: si en 3.5s nada resolvió, reintenta getSession una vez más
    const failsafe = setTimeout(async () => {
      if (!mounted.current) return;
      console.warn("[useAuth] failsafe triggered — reintentando getSession");
      const { data: { session: retrySession } } = await supabase.auth.getSession();
      if (mounted.current) {
        await applySession(retrySession);
      }
    }, 3500);

    return () => {
      mounted.current = false;
      clearTimeout(failsafe);
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    // SIGNED_OUT en onAuthStateChange limpia el estado
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
