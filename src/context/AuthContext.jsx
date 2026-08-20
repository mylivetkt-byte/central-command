import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, isConfigured } from "../lib/supabase";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) return null;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (!data) {
      const meta = (await supabase.auth.getUser()).data.user?.user_metadata || {};
      const role = meta.role || "cliente";
      const fullName = meta.full_name || "Usuario";
      const phone = meta.phone || "";
      const vehicle = role === "conductor" ? (meta.vehicle || "") : null;
      const { data: inserted } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          role,
          full_name: fullName,
          phone,
          vehicle,
          rating: 5,
          trips_done: 0,
        })
        .select("*")
        .single();
      setProfile(inserted);
      return inserted;
    }
    setProfile(data);
    return data;
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      if (s) await loadProfile(s.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) loadProfile(s.user.id);
      else setProfile(null);
    });
    return () => sub?.subscription?.unsubscribe();
  }, [loadProfile]);

  // Registro con rol (módulo 3: diferenciar cliente / conductor)
  const register = useCallback(
    async ({ email, password, fullName, phone, role, vehicle }) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, phone, role },
        },
      });
      if (error) return { error };
      const userId = data.user?.id;
      if (userId) {
        await supabase.from("profiles").upsert({
          id: userId,
          role,
          full_name: fullName,
          phone,
          vehicle: role === "conductor" ? vehicle : null,
          rating: 5,
          trips_done: 0,
        });
      }
      await loadProfile(userId);
      return { data };
    },
    [loadProfile]
  );

  const login = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (data.user) await loadProfile(data.user.id);
    return { data, error };
  }, [loadProfile]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const updateProfile = useCallback(
    async (patch) => {
      if (!session) return { error: new Error("sin sesión") };
      const { error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", session.user.id);
      if (!error) await loadProfile(session.user.id);
      return { error };
    },
    [session, loadProfile]
  );

  const value = {
    session,
    profile,
    loading,
    isConfigured,
    register,
    login,
    logout,
    updateProfile,
    refresh: () => loadProfile(session?.user?.id),
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}