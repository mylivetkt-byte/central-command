import { supabase } from "./supabase";

export async function notify(userId, title, message, type = "info", tripId = null) {
  if (!userId) return;
  await supabase.from("notifications").insert({
    user_id: userId,
    title,
    message,
    type,
    trip_id: tripId,
  });
}

// Helpers específicos
export async function notifyClientTripRequested(clientId, tripId) {
  await notify(clientId, "Viaje solicitado", "Buscando conductor cerca...", "info", tripId);
}

export async function notifyClientDriverAssigned(clientId, driverName) {
  await notify(clientId, "Conductor asignado", `${driverName || "Un conductor"} aceptó tu solicitud`, "success");
}

export async function notifyClientTripStatus(clientId, status) {
  const map = {
    driver_assigned: "Conductor asignado",
    in_progress: "Viaje iniciado",
    completed: "Viaje completado",
    cancelled: "Viaje cancelado",
  };
  await notify(clientId, map[status] || "Actualización", `El estado del viaje cambió a: ${status}`, status === "cancelled" ? "error" : "info");
}

export async function notifyDriverNewRequest(driverId, tripId) {
  await notify(driverId, "Nueva solicitud", "Hay un cliente buscando viaje cerca tuyo", "info", tripId);
}

export async function notifyDriverTripAssigned(driverId, tripId) {
  await notify(driverId, "Solicitud aceptada", "Ya tenés un viaje asignado", "success", tripId);
}

export async function notifyDriverTripCompleted(driverId) {
  await notify(driverId, "Viaje completado", "El viaje finalizó correctamente", "success");
}

// Audio Beep/Chime con Web Audio API (funciona inmediatamente sin esperar voces TTS)
export function playAlertChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    // Ignorar si el navegador bloquea audio context no interactuado
  }
}

// Cache del último texto y timestamp para evitar bucles/repeticiones
let lastSpokenText = "";
let lastSpokenTime = 0;

// Función de voz por síntesis para alertar al conductor (con debounce y prevención de bucles)
export function speakAlert(text, force = false) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (!text || typeof text !== "string") return;

  const now = Date.now();
  // Si es el mismo texto en menos de 10 segundos, no repetir en bucle
  if (!force && text === lastSpokenText && (now - lastSpokenTime) < 10000) {
    return;
  }

  lastSpokenText = text;
  lastSpokenTime = now;

  try {
    // Tocar sonido previo
    playAlertChime();

    // Cancelar cualquier mensaje anterior para evitar colas atoradas
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    // Obtener voces disponibles en español
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const esVoice = voices.find((v) => v.lang.startsWith("es") || v.lang.includes("es-"));
      if (esVoice) utterance.voice = esVoice;
    } else {
      // Si aún no cargaron las voces en el navegador, suscribir evento onvoiceschanged una sola vez
      window.speechSynthesis.onvoiceschanged = () => {
        const vs = window.speechSynthesis.getVoices();
        const v = vs.find((v) => v.lang.startsWith("es") || v.lang.includes("es-"));
        if (v) utterance.voice = v;
      };
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn("Error en speakAlert:", err);
  }
}
