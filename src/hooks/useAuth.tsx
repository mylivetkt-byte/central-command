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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted.current) return;
        
        console.log("[useAuth] event:", event, "user:", newSession?.user?.email ?? "none");

        // Start loading if we have a session to verify role
        setLoading(true);
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          const r = await fetchRole(newSession.user.id);
          if (mounted.current) setRole(r);
        } else {
          setRole(null);
        }

        if (mounted.current) setLoading(false);
      }
    );

    // Failsafe: ensure loading doesn't get stuck forever
    const failsafe = setTimeout(() => {
      if (mounted.current && loading) {
        console.warn("[useAuth] Loading failsafe triggered");
        setLoading(false);
      }
    }, 8000);

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
