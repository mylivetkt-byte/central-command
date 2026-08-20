# InDrive Clone — App Cliente + Conductor (Supabase + Realtime)

Sistema tipo **inDrive/Uber** construido como **web app** (sin Android Studio),
usando **Supabase** (Auth + Postgres + Realtime) como sustituto de Firebase.

Replica la estructura del curso *"Crea una App como UBER"* módulo por módulo.

## Módulos del curso → funcionalidad implementada

| Módulo | Tema del curso | Aquí se implementa en |
|---|---|---|
| 1 | Introducción / integrar backend | `supabase/schema.sql`, `src/lib/supabase.js` |
| 2 | Diseño de pantallas iniciales | `src/pages/Login.jsx`, `Register.jsx`, `src/index.css` |
| 3 | Auth (cliente / conductor) | `src/context/AuthContext.jsx` (Supabase Auth con role) |
| 4 | Mapa + GPS + conductores en mapa | `src/components/MapView.jsx`, `DriverMarkers` |
| 5 | Google Places (autocompletar) | `src/components/PlaceSearch.jsx` (Nominatim OSM) |
| 6 | Directions (ruta, tiempo, distancia) | `src/lib/geo.js` (OSRM) |
| 7 | Conductor cercano + solicitud + aceptar | Realtime en `trips` (`searching` → `driver_assigned`) |
| 8 | Tracking conductor en tiempo real | Realtime en `driver_locations`, polígono de ruta |
| 9 | Notificación / aceptación de solicitud | Panel conductor con solicitudes en vivo |
| 10 | Foto de perfil (Storage) | Supabase Storage bucket `avatars` |
| 11 | Historial de viajes | `src/pages/History.jsx` |
| 12 | Mejoras de diseño | Tema oscuro tipo inDrive, `src/index.css` |

## Requisitos

- Node.js 18+ (tienes 22) y npm
- Un proyecto gratuito en [Supabase](https://supabase.com)
- Navegador moderno (Edge/Chrome/Firefox)

## Setup en 5 pasos

1. Crear proyecto en Supabase → copiar **URL del proyecto** y **anon public key**
   en `Settings → API`.
2. Ir a **SQL Editor** → pegar todo el contenido de `supabase/schema.sql` → Run.
3. Crear `.env` dentro de `web/` (copia de `web/.env.example`) con tus credenciales.
4. Instalar y arrancar:

```bash
cd web
npm install
npm run dev
```

5. Abrir `http://localhost:5173`:
   - Registrar un usuario **conductor** (role conductor) y otro **cliente** (role cliente).
   - En el navegador conductor: activar "Disponible" (da permiso de ubicación).
   - En el navegador cliente: elegir origen/destino, estimar precio y solicitar.

## Arquitectura

- **Frontend:** React 18 + Vite + react-leaflet (OSM) + Supabase JS
- **Geocodificación:** Nominatim (OpenStreetMap)
- **Rutas/tiempo/distancia:** OSRM public router (API libre, sin key)
- **Realtime:** publicación supabase_realtime sobre `trips` y `driver_locations`
- **Seguridad:** Row Level Security (cada rol solo accede a lo suyo)

> Nota: OSRM/Nominatim públicos son para desarrollo. Para producción se apunta a
> un router propio o Mapbox/Google Directions.