import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const defaultCenter = [-12.0464, -77.0428];

function Recenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && Array.isArray(center) && center.length === 2) {
      map.setView(center, zoom || map.getZoom());
    }
  }, [center, zoom, map]);
  return null;
}

const carIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const pulseIcon = new L.DivIcon({
  className: "pulse-marker",
  html: `<div style="
    width:18px;height:18px;border-radius:50%;
    background:rgba(57,255,20,0.25);
    border:2px solid rgba(57,255,20,0.9);
    box-shadow:0 0 14px rgba(57,255,20,0.7);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export default function MapView({ origin, dest, driverPos, routeCoords, center, zoom, markers }) {
  const showRoute = Array.isArray(routeCoords) && routeCoords.length > 1;
  const currentCenter = Array.isArray(center) && center.length === 2 ? center : defaultCenter;

  return (
    <div className="map-wrap">
      <MapContainer center={currentCenter} zoom={zoom || 13} style={{ height: "100dvh", width: "100%" }} zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <Recenter center={currentCenter} zoom={zoom} />

        {origin && (
          <Marker position={[origin.lat, origin.lng]} icon={carIcon}>
            <Popup><b>Origen</b><br/>{origin.name}</Popup>
          </Marker>
        )}
        {dest && (
          <Marker position={[dest.lat, dest.lng]} icon={carIcon}>
            <Popup><b>Destino</b><br/>{dest.name}</Popup>
          </Marker>
        )}
        {driverPos && (
          <Marker position={[driverPos.lat, driverPos.lng]} icon={pulseIcon}>
            <Popup><b>Conductor en vivo</b></Popup>
          </Marker>
        )}
        {markers?.map((m, i) => (
          <Marker key={i} position={[m.lat, m.lng]} icon={carIcon}>
            <Popup>{m.label || "Conductor"}</Popup>
          </Marker>
        ))}
        {showRoute && (
          <Polyline positions={routeCoords} pathOptions={{ color: "#39ff14", weight: 5, opacity: 0.9 }} />
        )}
      </MapContainer>
    </div>
  );
}
