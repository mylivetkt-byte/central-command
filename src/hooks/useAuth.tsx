import {
  createContext, useContext, useEffect,
  useState, useRef, useCallback, ReactNode
} from "react";
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
  user: null, session: null, role: null, loading: true,
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

  /**
   * Obtiene el rol del usuario autenticado.
   * Intenta primero con RPC (SECURITY DEFINER, ignora RLS).
   * Si la función no existe en Supabase aún, cae en query directa.
   */
  const fetchRole = useCallback(async (): Promise<AppRole> => {
    if (fetchingRole.current) return null;
    fetchingRole.current = true;
    try {
      // Intento 1: RPC get_my_role
      const { data: rpcData, error: rpcError } = await supabase.rpc("get_my_role");
      if (!rpcError) {
        return (rpcData as AppRole) ?? null;
      }
      // Intento 2: query directa (fallback si RPC no está creado)
      const { data: { user: me } } = await supabase.auth.getUser();
      if (!me) return null;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", me.id)
        .maybeSingle();
      if (error) { console.error("[useAuth] fetchRole fallback:", error.message); return null; }
      return (data?.role as AppRole) ?? null;
    } catch (e) {
      console.error("[useAuth] fetchRole exception:", e);
      return null;
    } finally {
      fetchingRole.current = false;
    }
  }, []);

  const applySession = useCallback(async (s: Session | null) => {
    if (!mounted.current) return;
    setSession(s);
    setUser(s?.user ?? null);
    if (s?.user) {
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
        console.log("[useAuth]", event, newSession?.user?.email ?? "—");

        if (event === "INITIAL_SESSION") return; // getSession() lo maneja

        if (event === "SIGNED_IN") {
          setLoading(true);
          await applySession(newSession);
          return;
        }
        if (event === "SIGNED_OUT") {
          setUser(null); setSession(null); setRole(null); setLoading(false);
          return;
        }
        if (event === "TOKEN_REFRESHED") {
          // Solo refrescamos sesión — NO el rol, para evitar race conditions
          if (mounted.current) { setSession(newSession); setUser(newSession?.user ?? null); }
          return;
        }
        if (event === "USER_UPDATED") {
          setLoading(true);
          await applySession(newSession);
          return;
        }
      }
    );

    // Fuente de verdad para la carga inicial
    supabase.auth.getSession().then(({ data: { session: s }, error }) => {
      if (!mounted.current) return;
      if (error) { console.error("[useAuth] getSession:", error.message); setLoading(false); return; }
      if (!initDone.current) { initDone.current = true; applySession(s); }
    });

    // Último recurso: si en 4s nada resolvió, reintenta
    const failsafe = setTimeout(async () => {
      if (!mounted.current) return;
      console.warn("[useAuth] failsafe");
      const { data: { session: s } } = await supabase.auth.getSession();
      if (mounted.current) await applySession(s);
    }, 4000);

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
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
