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

// ─── sessionStorage helpers ───────────────────────────────────────────────────
// Guardamos el rol del usuario en sessionStorage para que al refrescar la página
// el rol esté disponible instantáneamente sin esperar a Supabase.
// sessionStorage se borra al cerrar el tab/navegador — es seguro como caché.
const ROLE_KEY = "app_role_cache";

function saveRoleCache(userId: string, role: AppRole) {
  try {
    if (role) sessionStorage.setItem(ROLE_KEY, JSON.stringify({ userId, role }));
    else sessionStorage.removeItem(ROLE_KEY);
  } catch {}
}

function readRoleCache(userId: string): AppRole {
  try {
    const raw = sessionStorage.getItem(ROLE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Solo usamos el cache si corresponde al mismo usuario
    if (parsed && typeof parsed === 'object' && parsed.userId === userId) return parsed.role as AppRole;
    return null;
  } catch { return null; }
}

function clearRoleCache() {
  try { sessionStorage.removeItem(ROLE_KEY); } catch {}
}
// ─────────────────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser]       = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole]       = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);

  const mounted        = useRef(true);
  const initDone       = useRef(false);
  const fetchingRole   = useRef(false);

  // ── fetchRole ───────────────────────────────────────────────────────────────
  // Tiene timeout de 5s. Intenta RPC primero, luego query directa.
  const fetchRole = useCallback(async (): Promise<AppRole> => {
    if (fetchingRole.current) return null;
    fetchingRole.current = true;

    // Promesa de timeout — si Supabase no responde en 5s, resolvemos con null
    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 5000));

    const queryPromise = (async (): Promise<AppRole> => {
      try {
        // Intento 1: RPC get_my_role (SECURITY DEFINER, no depende de RLS)
        const { data, error } = await (supabase.rpc as any)("get_my_role");
        if (error) {
          console.error("[useAuth] RPC get_my_role error:", error.message);
        }
        if (!error && data) return (data as unknown as AppRole) ?? null;

        // Intento 2: query directa (fallback si el RPC no existe aún)
        console.log("[useAuth] RPC falló o no existe, intentando query directa a user_roles...");
        const { data: { user: me } } = await supabase.auth.getUser();
        if (!me) return null;
        const { data: row, error: rowErr } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", me.id)
          .maybeSingle();
        
        if (rowErr) {
          console.error("[useAuth] Error query directa user_roles:", rowErr.message);
          return null;
        }
        if (!row) {
          console.warn("[useAuth] El usuario no tiene rol asignado en la tabla user_roles");
          return null;
        }
        return ((row as any).role as AppRole) ?? null;
      } catch (err) {
        console.error("[useAuth] Excepción crítica en fetchRole:", err);
        return null;
      }
    })();

    const result = await Promise.race([queryPromise, timeout]);
    fetchingRole.current = false;
    return result;
  }, []);

  // ── applySession ────────────────────────────────────────────────────────────
  const applySession = useCallback(async (s: Session | null, fromCache = false) => {
    if (!mounted.current) return;

    setSession(s);
    setUser(s?.user ?? null);

    if (s?.user) {
      // ── CLAVE: leemos el cache ANTES de llamar a Supabase ───────────────────
      // Esto hace que en un refresh la UI cargue inmediatamente.
      const cached = readRoleCache(s.user.id);
      if (cached) {
        setRole(cached);
        setLoading(false); // ← la app aparece ya, sin esperar la red
      }

      // Luego verificamos el rol real en background (o esperamos si no hay cache)
      const fetchedRole = await fetchRole();

      if (!mounted.current) return;

      if (fetchedRole !== null) {
        // Rol confirmado — actualizamos cache y estado
        setRole(fetchedRole);
        saveRoleCache(s.user.id, fetchedRole);
      } else if (!cached) {
        // No había cache Y el fetch falló — no podemos saber el rol
        // Dejamos role=null para que ProtectedRoute decida
        setRole(null);
      }
      // Si había cache y el fetch falló, mantenemos el cached (ya seteado arriba)

    } else {
      // Sin sesión → limpiar todo
      clearRoleCache();
      setRole(null);
    }

    if (mounted.current) setLoading(false);
  }, [fetchRole]);

  // ── efecto principal ────────────────────────────────────────────────────────
  useEffect(() => {
    mounted.current  = true;
    initDone.current = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted.current) return;
        console.log("[useAuth]", event, newSession?.user?.email ?? "—");

        if (event === "INITIAL_SESSION") {
          // Ignorado — getSession() es la fuente de verdad en la carga inicial
          return;
        }
        if (event === "SIGNED_IN") {
          setLoading(true);
          await applySession(newSession);
          return;
        }
        if (event === "SIGNED_OUT") {
          clearRoleCache();
          setUser(null); setSession(null); setRole(null); setLoading(false);
          return;
        }
        if (event === "TOKEN_REFRESHED") {
          // Solo actualizamos la sesión — el rol no cambia por un refresh de token
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
    supabase.auth.getSession().then(({ data, error }) => {
      const s = data?.session;
      if (!mounted.current) return;
      if (error) { console.error("[useAuth] getSession:", error.message); setLoading(false); return; }
      if (!initDone.current) {
        initDone.current = true;
        applySession(s);
      }
    });

    // Failsafe de último recurso — fuerza loading=false a los 6s
    const failsafe = setTimeout(() => {
      if (mounted.current) {
        console.warn("[useAuth] failsafe — forzando loading=false");
        setLoading(false);
      }
    }, 6000);

    return () => {
      mounted.current = false;
      clearTimeout(failsafe);
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    clearRoleCache();
    setLoading(true);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
