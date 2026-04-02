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

  const fetchRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        console.error("[useAuth] fetchRole error:", error.message);
        return null;
      }
      return (data?.role as AppRole) ?? null;
    } catch (e) {
      console.error("[useAuth] fetchRole exception:", e);
      return null;
    }
  };

  useEffect(() => {
    mounted.current = true;

    // 1. Get initial session first
    supabase.auth.getSession().then(async ({ data: { session: initSession } }) => {
      if (!mounted.current) return;
      setSession(initSession);
      setUser(initSession?.user ?? null);

      if (initSession?.user) {
        const r = await fetchRole(initSession.user.id);
        if (mounted.current) setRole(r);
      }
      if (mounted.current) setLoading(false);
    });

    // 2. Listen for future auth changes (don't await inside callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted.current) return;
        console.log("[useAuth] event:", event, "user:", newSession?.user?.email ?? "none");

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Use setTimeout to avoid deadlock when called from within auth callback
          setTimeout(async () => {
            if (!mounted.current) return;
            setLoading(true);
            const r = await fetchRole(newSession.user.id);
            if (mounted.current) {
              setRole(r);
              setLoading(false);
            }
          }, 0);
        } else {
          setRole(null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted.current = false;
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
