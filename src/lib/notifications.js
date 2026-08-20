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

// Función de voz por síntesis para alertar al conductor
export function speakAlert(text) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel(); // Cancelar cualquier audio anterior
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    
    // Intentar buscar una voz en español
    const voices = window.speechSynthesis.getVoices();
    const esVoice = voices.find((v) => v.lang.startsWith("es") || v.lang.includes("es-"));
    if (esVoice) utterance.voice = esVoice;

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn("Error reproduciendo voz:", err);
  }
}

