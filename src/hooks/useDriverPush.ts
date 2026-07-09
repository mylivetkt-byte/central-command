import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Clave pública VAPID — segura para exponerse en el cliente
const VAPID_PUBLIC_KEY =
  "BPsBy_Pdt_oF7sFknI30CLK4jSz1FbES-AlokHLjccf8Ge4oL0vYdFKYFQXQic8_6Q6EIKmkYjkcne4tiv-KLIk";

const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer | null): string => {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

export const useDriverPush = (driverId: string | undefined) => {
  const [permission, setPermission] = useState<PushPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  useEffect(() => {
    if (!isSupported) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PushPermission);

    // Chequear si ya existe suscripción
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
        if (!reg) return;
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch {}
    })();
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!isSupported || !driverId) return false;
    setBusy(true);
    try {
      // 1. Registrar SW dedicado a push
      let reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      if (!reg) {
        reg = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
      }
      await navigator.serviceWorker.ready;

      // 2. Pedir permiso
      const perm = await Notification.requestPermission();
      setPermission(perm as PushPermission);
      if (perm !== "granted") return false;

      // 3. Suscribir en el pushManager
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      // 4. Guardar en la BD
      const json = sub.toJSON();
      const p256dh = json.keys?.p256dh ?? arrayBufferToBase64(sub.getKey("p256dh"));
      const auth = json.keys?.auth ?? arrayBufferToBase64(sub.getKey("auth"));

      const { error } = await (supabase.from("driver_push_subscriptions") as any).upsert(
        {
          driver_id: driverId,
          endpoint: sub.endpoint,
          p256dh,
          auth_key: auth,
          user_agent: navigator.userAgent,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" },
      );
      if (error) throw error;

      setSubscribed(true);
      return true;
    } catch (e) {
      console.error("[push subscribe]", e);
      return false;
    } finally {
      setBusy(false);
    }
  }, [isSupported, driverId]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await (supabase.from("driver_push_subscriptions") as any)
          .delete()
          .eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }, [isSupported]);

  return { isSupported, permission, subscribed, busy, subscribe, unsubscribe };
};