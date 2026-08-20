import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const defaultCenter = [-12.0464, -77.0428];

function Recenter({ center, zoom, bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length >= 2) {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    } else if (center && Array.isArray(center) && center.length === 2) {
      map.setView(center, zoom || map.getZoom(), { animate: true });
    }
  }, [center, zoom, bounds, map]);
  return null;
}

// Icono tipo GPS de Navegación para Conductor (con flecha y dirección de rotación)
const createDriverIcon = (heading = 0) =>
  new L.DivIcon({
    className: "driver-nav-marker",
    html: `
      <div style="
        position: relative;
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          position: absolute;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(0, 230, 118, 0.25);
          animation: pulse-ring 1.8s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        "></div>
        <div style="
          width: 32px;
          height: 32px;
          background: #0d131a;
          border: 2.5px solid #00e676;
          border-radius: 50%;
          box-shadow: 0 0 16px rgba(0, 230, 118, 0.7), inset 0 0 6px rgba(0,230,118,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          transform: rotate(${heading}deg);
          transition: transform 0.3s ease;
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#00e676">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

// Pin de Origen / Recogida
const originPinIcon = new L.DivIcon({
  className: "origin-nav-pin",
  html: `
    <div style="
      background: #3b82f6;
      color: white;
      font-weight: 800;
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 20px;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.5);
      border: 2px solid #ffffff;
      display: flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
    ">
      <span>📍 Recoger</span>
    </div>
  `,
  iconSize: [80, 30],
  iconAnchor: [40, 15],
});

// Pin de Destino
const destPinIcon = new L.DivIcon({
  className: "dest-nav-pin",
  html: `
    <div style="
      background: #ef4444;
      color: white;
      font-weight: 800;
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 20px;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.5);
      border: 2px solid #ffffff;
      display: flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
    ">
      <span>🏁 Destino</span>
    </div>
  `,
  iconSize: [80, 30],
  iconAnchor: [40, 15],
});

export default function MapView({ origin, dest, driverPos, routeCoords, center, zoom, markers, bounds }) {
  const showRoute = Array.isArray(routeCoords) && routeCoords.length > 1;
  const currentCenter = Array.isArray(center) && center.length === 2 ? center : defaultCenter;

  return (
    <div className="map-wrap">
      <MapContainer
        center={currentCenter}
        zoom={zoom || 15}
        style={{ height: "100dvh", width: "100%" }}
        zoomControl={false}
      >
        {/* Capa de mapa estilo CartoDB Voyager / Streets Navigation moderno */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />
        <Recenter center={currentCenter} zoom={zoom} bounds={bounds} />

        {origin && (
          <Marker position={[origin.lat, origin.lng]} icon={originPinIcon}>
            <Popup><b>Punto de Recogida:</b><br />{origin.name}</Popup>
          </Marker>
        )}
        {dest && (
          <Marker position={[dest.lat, dest.lng]} icon={destPinIcon}>
            <Popup><b>Destino:</b><br />{dest.name}</Popup>
          </Marker>
        )}
        {driverPos && (
          <Marker position={[driverPos.lat, driverPos.lng]} icon={createDriverIcon(driverPos.heading || 0)}>
            <Popup><b>Tu ubicación GPS actual</b></Popup>
          </Marker>
        )}
        {markers?.map((m, i) => (
          <Marker key={i} position={[m.lat, m.lng]} icon={createDriverIcon(0)}>
            <Popup>{m.label || "Vehículo"}</Popup>
          </Marker>
        ))}

        {/* Ruta principal iluminada con borde estilo Waze/Uber */}
        {showRoute && (
          <>
            <Polyline positions={routeCoords} pathOptions={{ color: "#1e3a8a", weight: 8, opacity: 0.6, lineCap: "round" }} />
            <Polyline positions={routeCoords} pathOptions={{ color: "#00e676", weight: 5, opacity: 0.95, lineCap: "round" }} />
          </>
        )}
      </MapContainer>
    </div>
  );
}
