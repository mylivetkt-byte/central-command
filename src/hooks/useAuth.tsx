import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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

  const fetchRole = async (userId: string): Promise<AppRole> => {
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
      const r = (data?.role as AppRole) ?? null;
      setRole(r);
      return r;
    } catch (e) {
      console.error("[useAuth] fetchRole exception:", e);
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    // onAuthStateChange fires INITIAL_SESSION immediately on mount,
    // so we don't need a separate getSession() call.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isMounted) return;

        console.log("[useAuth] event:", event, "user:", newSession?.user?.email ?? "none");

        // Always block navigation until role is resolved
        setLoading(true);
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          await fetchRole(newSession.user.id);
        } else {
          setRole(null);
        }

        if (isMounted) setLoading(false);
      }
    );

    // Safety net: never keep spinner forever (8 seconds max)
    const failsafe = setTimeout(() => {
      if (isMounted) {
        console.warn("[useAuth] failsafe triggered — forcing loading=false");
        setLoading(false);
      }
    }, 8000);

    return () => {
      isMounted = false;
      clearTimeout(failsafe);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
