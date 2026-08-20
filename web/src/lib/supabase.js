import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anon && !url.includes("TU-PROYECTO"));

export const supabase = createClient(url || "https://placeholder.supabase.co", anon || "placeholder", {
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

// Ref central para los canales realtime
export const rt = supabase.channel?.(null);