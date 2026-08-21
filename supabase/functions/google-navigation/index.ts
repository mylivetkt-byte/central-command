// Edge function: proxy a Google Maps Platform (Geocoding + Routes API v2)
// vía el Lovable Connector Gateway. Devuelve la ruta normalizada a un
// formato compatible con la lógica turn-by-turn existente (estilo OSRM).

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_maps';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');

function gwHeaders(extra: Record<string, string> = {}) {
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    'X-Connection-Api-Key': GOOGLE_MAPS_API_KEY!,
    'Content-Type': 'application/json',
    ...extra,
  };
}

// Mapea maniobras de Google Routes v2 al par (type, modifier) tipo OSRM
// para no romper el renderizado de iconos/voz existente.
function mapManeuver(m?: string): { type: string; modifier?: string; exit?: number } {
  switch (m) {
    case 'TURN_LEFT': return { type: 'turn', modifier: 'left' };
    case 'TURN_RIGHT': return { type: 'turn', modifier: 'right' };
    case 'TURN_SLIGHT_LEFT': return { type: 'turn', modifier: 'slight left' };
    case 'TURN_SLIGHT_RIGHT': return { type: 'turn', modifier: 'slight right' };
    case 'TURN_SHARP_LEFT': return { type: 'turn', modifier: 'sharp left' };
    case 'TURN_SHARP_RIGHT': return { type: 'turn', modifier: 'sharp right' };
    case 'UTURN_LEFT':
    case 'UTURN_RIGHT': return { type: 'turn', modifier: 'uturn' };
    case 'STRAIGHT': return { type: 'continue' };
    case 'DEPART': return { type: 'depart' };
    case 'DESTINATION':
    case 'DESTINATION_LEFT':
    case 'DESTINATION_RIGHT':
    case 'ARRIVE': return { type: 'arrive' };
    case 'ROUNDABOUT_LEFT':
    case 'ROUNDABOUT_RIGHT': return { type: 'roundabout' };
    case 'MERGE': return { type: 'merge' };
    case 'FORK_LEFT': return { type: 'fork', modifier: 'left' };
    case 'FORK_RIGHT': return { type: 'fork', modifier: 'right' };
    default: return { type: 'continue' };
  }
}

function parseDurationSeconds(d?: string | number | null): number {
  if (typeof d === 'number') return d;
  if (!d) return 0;
  const s = String(d);
  if (s.endsWith('s')) return parseFloat(s.slice(0, -1)) || 0;
  return parseFloat(s) || 0;
}

async function geocode(address: string, biasLat?: number, biasLng?: number) {
  const params = new URLSearchParams({
    address,
    region: 'co',
    language: 'es',
  });
  if (typeof biasLat === 'number' && typeof biasLng === 'number') {
    // Bounding box aprox 40km alrededor del bias
    const d = 0.35;
    params.set('bounds', `${biasLat - d},${biasLng - d}|${biasLat + d},${biasLng + d}`);
  }
  const r = await fetch(`${GATEWAY_URL}/maps/api/geocode/json?${params.toString()}`, {
    headers: gwHeaders(),
  });
  const body = await r.text();
  if (!r.ok) throw new Error(`geocode [${r.status}]: ${body}`);
  const data = JSON.parse(body);
  const first = data?.results?.[0]?.geometry?.location;
  if (!first) return null;
  return { lat: first.lat, lng: first.lng };
}

async function computeRoute(
  origin: { lat: number; lng: number },
  waypoints: Array<{ lat: number; lng: number }>,
) {
  if (waypoints.length === 0) throw new Error('no waypoints');
  const destination = waypoints[waypoints.length - 1];
  const intermediates = waypoints.slice(0, -1).map((w) => ({
    location: { latLng: { latitude: w.lat, longitude: w.lng } },
  }));

  const body = {
    origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
    destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
    intermediates,
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    polylineEncoding: 'GEO_JSON_LINESTRING',
    languageCode: 'es-CO',
    units: 'METRIC',
  };

  const fieldMask = [
    'routes.duration',
    'routes.distanceMeters',
    'routes.polyline.geoJsonLinestring',
    'routes.legs.steps.navigationInstruction',
    'routes.legs.steps.distanceMeters',
    'routes.legs.steps.staticDuration',
    'routes.legs.steps.startLocation',
    'routes.legs.steps.endLocation',
    'routes.legs.steps.polyline.geoJsonLinestring',
  ].join(',');

  const r = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
    method: 'POST',
    headers: gwHeaders({ 'X-Goog-FieldMask': fieldMask }),
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`routes [${r.status}]: ${text}`);
  const data = JSON.parse(text);
  const route = data?.routes?.[0];
  if (!route) return { routes: [] };

  // Normalizar a formato tipo OSRM
  const coords: [number, number][] = route.polyline?.geoJsonLinestring?.coordinates ?? [];
  const legs = (route.legs || []).map((leg: any) => ({
    steps: (leg.steps || []).map((s: any) => {
      const nav = s.navigationInstruction || {};
      const man = mapManeuver(nav.maneuver);
      const start = s.startLocation?.latLng;
      const instr: string = nav.instructions || '';
      // Extraer "calle" del texto de la instrucción (heurística ligera)
      const nameMatch = instr.match(/(?:hacia|por|en)\s+(.+?)(?:\.|$)/i);
      const streetName = nameMatch ? nameMatch[1].trim() : instr;
      return {
        name: streetName,
        instruction: instr,
        distance: s.distanceMeters ?? 0,
        duration: parseDurationSeconds(s.staticDuration),
        maneuver: {
          type: man.type,
          modifier: man.modifier,
          location: start ? [start.longitude, start.latitude] : null,
        },
      };
    }),
  }));

  return {
    routes: [{
      distance: route.distanceMeters ?? 0,
      duration: parseDurationSeconds(route.duration),
      geometry: { type: 'LineString', coordinates: coords },
      legs,
    }],
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      throw new Error('Missing Google Maps connector credentials');
    }
    const payload = await req.json();
    const action = payload?.action;

    if (action === 'geocode') {
      const address = String(payload.address || '').trim();
      if (!address) throw new Error('address required');
      const result = await geocode(address, payload.biasLat, payload.biasLng);
      return new Response(JSON.stringify({ result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'route') {
      const origin = payload.origin;
      const waypoints = payload.waypoints || [];
      if (!origin || typeof origin.lat !== 'number' || typeof origin.lng !== 'number') {
        throw new Error('origin required');
      }
      const data = await computeRoute(origin, waypoints);
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[google-navigation] error:', e?.message || e);
    return new Response(JSON.stringify({ error: e?.message || 'internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});