// ============================================================
// Capa de geo: geocodificación (Nominatim) + rutas (OSRM)
// ============================================================

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OSRM = "https://router.project-osrm.org/route/v1/driving";

// Autocompletar lugares (módulo 5: Places API)
export async function searchPlaces(query, near) {
  if (!query || query.trim().length < 3) return [];
  const params = new URLSearchParams({
    q: query.trim(),
    format: "json",
    limit: 8,
    addressdetails: 1,
    countrycodes: "pe,cl,ar,mx,co,es,us",
  });

  if (near && near.lat && near.lng) {
    const lat = String(near.lat);
    const lng = String(near.lng);
    params.set("viewbox", `${Number(lng) - 0.5},${Number(lat) + 0.5},${Number(lng) + 0.5},${Number(lat) - 0.5}`);
    params.set("bounded", "0");
  }

  try {
    const res = await fetch(`${NOMINATIM}?${params}`, {
      headers: { "Accept-Language": "es", "User-Agent": "inDriveClone/1.0" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((p) => ({
      id: p.place_id,
      name: p.display_name,
      label: buildLabel(p),
      lat: parseFloat(p.lat),
      lng: parseFloat(p.lon),
    }));
  } catch {
    return [];
  }
}

function buildLabel(p) {
  const parts = [p.name, p.address?.city || p.address?.town || p.address?.state, p.address?.country]
    .filter(Boolean);
  return parts.join(", ");
}

// Obtener ruta, distancia y duración (módulo 6: Directions API)
export async function getRoute(origin, dest) {
  const url = `${OSRM}/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson&alternatives=false`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("ruta falló");
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) throw new Error("sin ruta");
    return {
      distanceM: Math.round(route.distance),
      durationS: Math.round(route.duration),
      coords: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    };
  } catch (e) {
    // fallback: distancia recta
    const d = haversineM(origin.lat, origin.lng, dest.lat, dest.lng);
    return {
      distanceM: Math.round(d),
      durationS: Math.round((d / 11.5) * 3.6),
      coords: [
        [origin.lat, origin.lng],
        [dest.lat, dest.lng],
      ],
    };
  }
}

export function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Tarifa estilo inDrive: base + por km (el conductor "oferta", aquí simulado)
export function estimatePrice(distanceM) {
  const km = distanceM / 1000;
  const price = 3.0 + km * 1.35;
  return Math.max(3.5, Math.round(price * 100) / 100);
}

export function fmtDuration(s) {
  if (s < 60) return `${Math.round(s)} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

export function fmtDistance(m) {
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function fmtMoney(n) {
  return `S/ ${Number(n || 0).toFixed(2)}`;
}

// Obtener posición del navegador (permiso GPS, módulo 4)
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("GPS no disponible"));
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, heading: pos.coords.heading }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
    );
  });
}