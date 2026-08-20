import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const { session } = useAuth();

  const addToast = useCallback((toast) => {
    const id = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, toast.duration || 4000);
  }, []);

  // Realtime: escuchar notificaciones propias
  useEffect(() => {
    if (!session?.user?.id) return;
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${session.user.id}` },
        (payload) => {
          const n = payload.new;
          addToast({
            title: n.title,
            message: n.message,
            type: n.type || "info",
          });
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [session, addToast]);

  return (
    <ToastCtx.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type || "info"}`}>
            <div className="toast-title">{t.title}</div>
            {t.message && <div className="toast-message">{t.message}</div>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
