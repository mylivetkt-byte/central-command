import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
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
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  // BUG FIX #1: usar ref para saber si ya se procesó la sesión inicial,
  // evita race condition cuando INITIAL_SESSION dispara antes del listener.
  const sessionHandled = useRef(false);

  const fetchRole = async (_userId: string): Promise<AppRole> => {
    try {
      // Usamos RPC con SECURITY DEFINER en lugar de query directa a user_roles.
      // La query directa está sujeta a RLS y puede colgarse si el token JWT
      // todavía se está refrescando al recargar la página, causando el spinner
      // infinito. La función RPC bypasea RLS y responde de inmediato.
      const rpcPromise = supabase.rpc("get_my_role");

      // Timeout de 4s: si la red falla o Supabase no responde,
      // no dependemos del failsafe de 5s — fallamos rápido y limpio.
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("fetchRole timeout")), 4000)
      );

      const { data, error } = await Promise.race([rpcPromise, timeoutPromise]);

      if (error) {
        console.error("[useAuth] fetchRole error:", error.message);
        return null;
      }
      return (data as AppRole) ?? null;
    } catch (e) {
      console.error("[useAuth] fetchRole exception:", e);
      return null;
    }
  };

  // Función compartida para procesar una sesión (evita duplicar lógica)
  const applySession = async (newSession: Session | null) => {
    if (!mounted.current) return;
    setSession(newSession);
    setUser(newSession?.user ?? null);

    if (newSession?.user) {
      const r = await fetchRole(newSession.user.id);
      if (mounted.current) setRole(r);
    } else {
      setRole(null);
    }

    if (mounted.current) setLoading(false);
    sessionHandled.current = true;
  };

  useEffect(() => {
    mounted.current = true;
    sessionHandled.current = false;

    // BUG FIX #2: NO poner setLoading(true) dentro de onAuthStateChange
    // para eventos como TOKEN_REFRESHED — evita que el spinner aparezca
    // intermitentemente cuando solo se renueva el token.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted.current) return;

        console.log("[useAuth] event:", event, "user:", newSession?.user?.email ?? "none");

        // Solo mostrar loading en eventos que realmente cambian la sesión
        const sessionChangeEvents = ["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED", "INITIAL_SESSION"];
        if (sessionChangeEvents.includes(event)) {
          setLoading(true);
          await applySession(newSession);
        }
      }
    );

    // BUG FIX #1 (principal): llamar getSession() después de suscribirse.
    // En React StrictMode y ciertos race conditions, el evento INITIAL_SESSION
    // puede disparar ANTES de que el listener esté listo, dejando loading = true
    // para siempre (hasta que el failsafe de 8s lo corrige, causando el bug
    // de "a veces inicia sesión y a veces no").
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!sessionHandled.current && mounted.current) {
        console.log("[useAuth] getSession fallback triggered");
        applySession(currentSession);
      }
    });

    // BUG FIX #3: el failsafe original usaba la variable `loading` en un
    // closure estático (siempre era `true`), haciendo la condición inútil.
    // Ahora simplemente fuerza loading=false sin condición de estado.
    const failsafe = setTimeout(() => {
      if (mounted.current) {
        console.warn("[useAuth] Loading failsafe triggered — reducido a 5s");
        setLoading(false);
      }
    }, 5000);

    return () => {
      mounted.current = false;
      clearTimeout(failsafe);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
