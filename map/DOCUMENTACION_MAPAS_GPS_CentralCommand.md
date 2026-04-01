# 🗺️ Sistema de Mapas y Tracking GPS - Central Command

## 📋 Tabla de Contenidos
1. [Visión General](#visión-general)
2. [Componentes Creados](#componentes-creados)
3. [Instalación y Configuración](#instalación-y-configuración)
4. [Guía de Uso](#guía-de-uso)
5. [API y Hooks](#api-y-hooks)
6. [Integración con Supabase](#integración-con-supabase)
7. [Personalización](#personalización)
8. [Solución de Problemas](#solución-de-problemas)

---

## 🎯 Visión General

Sistema completo de **mapas interactivos** y **tracking GPS en tiempo real** para la plataforma Central Command. Permite:

- ✅ **Visualización en vivo** de todos los drivers activos
- ✅ **Tracking de entregas** en tiempo real
- ✅ **Rutas dinámicas** entre puntos de recogida y entrega
- ✅ **Actualización automática** de ubicaciones cada 5 segundos
- ✅ **Sistema de geolocalización** para drivers con alta precisión
- ✅ **Cálculo de distancias** y tiempos estimados
- ✅ **Panel de control GPS** para conductores
- ✅ **Timeline de estados** de cada entrega

### Tecnologías Utilizadas

- **Leaflet.js** - Librería de mapas open-source
- **OpenStreetMap** - Tiles de mapas gratuitos
- **Geolocation API** - API nativa del navegador
- **Supabase Realtime** - Sincronización en tiempo real
- **React Hooks** - Gestión de estado y efectos
- **TypeScript** - Type safety completo

---

## 📦 Componentes Creados

### 1. `LiveMap.tsx` - Mapa General en Vivo

**Ubicación:** `src/components/LiveMap.tsx`

**Propósito:** Mapa principal que muestra todos los drivers y entregas activas del sistema.

**Props:**
```typescript
interface LiveMapProps {
  center?: [number, number];        // Centro del mapa [lat, lng]
  zoom?: number;                    // Nivel de zoom (default: 13)
  height?: string;                  // Altura del mapa (default: '600px')
  showDrivers?: boolean;            // Mostrar drivers (default: true)
  showDeliveries?: boolean;         // Mostrar entregas (default: true)
  focusedDeliveryId?: string | null; // ID de entrega a enfocar
}
```

**Características:**
- 🚗 **Marcadores de drivers** con estado visual (activo/en ruta/inactivo)
- 📦 **Marcadores de pickup** (punto de recogida - verde)
- 🏠 **Marcadores de delivery** (punto de entrega - rojo)
- 📍 **Popups informativos** al hacer clic en marcadores
- 🔄 **Actualización en tiempo real** vía Supabase Realtime
- 🎨 **Rutas visuales** entre puntos con líneas punteadas
- 📊 **Panel de información** del driver seleccionado

**Ejemplo de uso:**
```tsx
import LiveMap from '@/components/LiveMap';

function Dashboard() {
  return (
    <LiveMap 
      center={[7.119, -73.122]}  // Bucaramanga
      zoom={13}
      height="700px"
      showDrivers={true}
      showDeliveries={true}
    />
  );
}
```

---

### 2. `DeliveryTracker.tsx` - Seguimiento Individual de Entrega

**Ubicación:** `src/components/DeliveryTracker.tsx`

**Propósito:** Componente completo para seguir una entrega específica con mapa, timeline y detalles.

**Props:**
```typescript
interface DeliveryTrackerProps {
  deliveryId: string;  // ID de la entrega a rastrear
  height?: string;     // Altura del mapa (default: '500px')
}
```

**Características:**
- 📍 **Mapa centrado** en la entrega específica
- 📝 **Timeline completo** de estados (creado → asignado → recogido → entregado)
- 🚗 **Ubicación del driver en tiempo real** (si está en camino)
- ⏱️ **Tiempo estimado** de entrega
- 👤 **Información del cliente** completa
- 📞 **Datos de contacto** del cliente
- 🔔 **Alertas visuales** cuando el driver está en camino
- 🎨 **Código de colores** según estado

**Ejemplo de uso:**
```tsx
import DeliveryTracker from '@/components/DeliveryTracker';

function TrackingPage({ deliveryId }) {
  return (
    <DeliveryTracker 
      deliveryId={deliveryId} 
      height="600px"
    />
  );
}
```

**Estados Visuales:**

| Estado | Color | Descripción |
|--------|-------|-------------|
| `pendiente` | Amarillo | Esperando asignación de driver |
| `aceptado` | Azul | Driver asignado, preparándose |
| `en_camino` | Naranja | Driver en ruta hacia destino |
| `entregado` | Verde | Entrega completada con éxito |
| `cancelado` | Gris | Entrega cancelada |

---

### 3. `DriverGPSControl.tsx` - Control GPS para Conductores

**Ubicación:** `src/components/DriverGPSControl.tsx`

**Propósito:** Panel de control para que los drivers activen/desactiven el GPS.

**Características:**
- 🎮 **Botones de control** grandes y claros
- 📊 **Métricas en vivo** (latitud, longitud, velocidad, precisión)
- 🔋 **Estado visual** del GPS (activo/inactivo)
- ⚠️ **Alertas de errores** si hay problemas con permisos
- 💡 **Consejos** para mejor precisión
- 📱 **Responsive** para uso móvil

**Ejemplo de uso:**
```tsx
import DriverGPSControl from '@/components/DriverGPSControl';

function DriverDashboard() {
  return (
    <div>
      <h1>Mi Dashboard</h1>
      <DriverGPSControl />
    </div>
  );
}
```

---

### 4. `MapTracking.tsx` - Página Completa de Mapas

**Ubicación:** `src/pages/MapTracking.tsx`

**Propósito:** Página completa del admin con todos los mapas integrados.

**Características:**
- 📑 **Dos pestañas principales:**
  - **Vista General:** Mapa con todos los drivers y entregas
  - **Seguimiento:** Tracking individual de entregas
- 🔍 **Buscador** de pedidos por número
- 📋 **Lista lateral** de entregas activas
- 📊 **Estadísticas rápidas** (total, en camino, pendientes)
- 🎯 **Enfoque automático** al seleccionar una entrega

**Agregar al Router:**
```tsx
// En src/App.tsx
import MapTracking from './pages/MapTracking';

// Agregar ruta protegida
<Route 
  path="/map-tracking" 
  element={
    <AdminRoute>
      <MapTracking />
    </AdminRoute>
  } 
/>
```

---

## 🔌 API y Hooks

### Hook: `useDriverLocation`

**Ubicación:** `src/hooks/useDriverLocation.ts`

**Propósito:** Gestión completa del GPS del conductor.

**Interfaz:**
```typescript
interface UseDriverLocationReturn {
  isTracking: boolean;                    // Si el GPS está activo
  currentLocation: LocationData | null;   // Ubicación actual
  startTracking: () => void;              // Activar GPS
  stopTracking: () => void;               // Desactivar GPS
  error: string | null;                   // Error si lo hay
}

interface LocationData {
  lat: number;           // Latitud
  lng: number;           // Longitud
  heading: number | null; // Dirección de movimiento
  speed: number | null;   // Velocidad en m/s
  accuracy: number | null; // Precisión en metros
}
```

**Uso:**
```tsx
import { useDriverLocation } from '@/hooks/useDriverLocation';

function DriverPanel() {
  const { 
    isTracking, 
    currentLocation, 
    startTracking, 
    stopTracking 
  } = useDriverLocation();

  return (
    <div>
      <p>Estado: {isTracking ? 'Activo' : 'Inactivo'}</p>
      {currentLocation && (
        <p>Ubicación: {currentLocation.lat}, {currentLocation.lng}</p>
      )}
      <button onClick={startTracking}>Activar GPS</button>
      <button onClick={stopTracking}>Desactivar GPS</button>
    </div>
  );
}
```

**Características técnicas:**
- ✅ Usa `watchPosition` para tracking continuo
- ✅ Actualiza Supabase automáticamente con `upsert`
- ✅ Configuración de alta precisión (`enableHighAccuracy: true`)
- ✅ Manejo de errores de permisos
- ✅ Cleanup automático al desmontar
- ✅ Solo funciona para usuarios con rol "driver"

---

### Hook: `useDriverLocationById`

**Propósito:** Obtener la ubicación de un driver específico.

**Uso:**
```tsx
import { useDriverLocationById } from '@/hooks/useDriverLocation';

function DriverMarker({ driverId }) {
  const { location, loading } = useDriverLocationById(driverId);

  if (loading) return <div>Cargando...</div>;
  if (!location) return <div>Sin ubicación</div>;

  return (
    <div>
      Driver en: {location.lat}, {location.lng}
    </div>
  );
}
```

**Características:**
- 🔄 Suscripción en tiempo real a cambios
- ⚡ Actualización inmediata cuando el driver se mueve
- 📍 Retorna null si el driver no tiene ubicación

---

### Hook: `useDistance`

**Propósito:** Calcular distancia entre dos puntos GPS.

**Uso:**
```tsx
import { useDistance } from '@/hooks/useDriverLocation';

function DistanceDisplay() {
  const pickup = { lat: 7.119, lng: -73.122 };
  const delivery = { lat: 7.125, lng: -73.115 };
  
  const distance = useDistance(pickup, delivery);

  return (
    <div>
      Distancia: {distance ? `${distance.toFixed(2)} km` : 'Calculando...'}
    </div>
  );
}
```

**Fórmula:** Usa la fórmula de **Haversine** para cálculo preciso considerando la curvatura de la Tierra.

---

### Hook: `useETA`

**Propósito:** Calcular tiempo estimado de llegada (ETA).

**Uso:**
```tsx
import { useETA } from '@/hooks/useDriverLocation';

function ETADisplay({ currentLocation, destination }) {
  const eta = useETA(
    currentLocation, 
    destination, 
    30  // velocidad promedio en km/h
  );

  return (
    <div>
      ETA: {eta ? `${eta} minutos` : 'Calculando...'}
    </div>
  );
}
```

**Cálculo:** `Tiempo = Distancia / Velocidad`

---

## 🚀 Instalación y Configuración

### Paso 1: Copiar Archivos al Proyecto

Copia los siguientes archivos a tu proyecto:

```bash
# Componentes
src/components/LiveMap.tsx
src/components/DeliveryTracker.tsx
src/components/DriverGPSControl.tsx

# Hooks
src/hooks/useDriverLocation.ts

# Páginas
src/pages/MapTracking.tsx
```

### Paso 2: Instalar Dependencias (No Requerido)

✅ **Buenas noticias:** Este sistema usa **Leaflet vía CDN**, por lo que **NO necesitas instalar** ninguna dependencia adicional. Los scripts se cargan automáticamente.

Si prefieres instalarlo localmente:

```bash
npm install leaflet @types/leaflet
npm install react-leaflet
```

### Paso 3: Verificar Base de Datos

Asegúrate de que la tabla `driver_locations` exista en Supabase:

```sql
-- Ya debería existir si ejecutaste las migraciones
SELECT * FROM driver_locations;
```

### Paso 4: Habilitar Realtime

Verifica que Realtime esté habilitado:

```sql
-- En Supabase SQL Editor
ALTER PUBLICATION supabase_realtime ADD TABLE driver_locations;
```

### Paso 5: Agregar Ruta al App

```tsx
// En src/App.tsx
import MapTracking from './pages/MapTracking';

// Dentro de <Routes>
<Route 
  path="/map-tracking" 
  element={
    <AdminRoute>
      <MapTracking />
    </AdminRoute>
  } 
/>
```

### Paso 6: Agregar al Sidebar (Opcional)

```tsx
// En src/components/AppSidebar.tsx o similar
import { MapPin } from 'lucide-react';

const menuItems = [
  // ... otros items
  {
    title: "Mapa en Vivo",
    icon: MapPin,
    url: "/map-tracking"
  }
];
```

---

## 📖 Guía de Uso

### Para Administradores

#### 1. Ver Todos los Drivers en el Mapa

```tsx
import LiveMap from '@/components/LiveMap';

function AdminDashboard() {
  return (
    <div>
      <h1>Vista General</h1>
      <LiveMap 
        showDrivers={true}
        showDeliveries={true}
        height="800px"
      />
    </div>
  );
}
```

#### 2. Rastrear una Entrega Específica

```tsx
import DeliveryTracker from '@/components/DeliveryTracker';

function OrderTracking({ orderId }) {
  return <DeliveryTracker deliveryId={orderId} />;
}
```

#### 3. Usar la Página Completa

Simplemente navega a `/map-tracking` desde el admin dashboard.

---

### Para Drivers

#### 1. Activar GPS al Iniciar Turno

```tsx
import DriverGPSControl from '@/components/DriverGPSControl';

function DriverApp() {
  return (
    <div>
      <h1>Mi Turno</h1>
      <DriverGPSControl />
      {/* Resto de la app */}
    </div>
  );
}
```

#### 2. Compartir Ubicación Durante Entrega

```tsx
import { useDriverLocation } from '@/hooks/useDriverLocation';

function DeliveryInProgress() {
  const { isTracking, startTracking } = useDriverLocation();

  useEffect(() => {
    // Auto-activar GPS al aceptar entrega
    if (!isTracking) {
      startTracking();
    }
  }, []);

  return <div>Entrega en progreso...</div>;
}
```

---

## 🎨 Personalización

### Cambiar Centro del Mapa

```tsx
// Coordenadas de Bogotá
<LiveMap center={[4.711, -74.072]} />

// Coordenadas de Medellín
<LiveMap center={[6.244, -75.581]} />

// Coordenadas de Cali
<LiveMap center={[3.451, -76.532]} />
```

### Cambiar Colores de Marcadores

En `LiveMap.tsx`, modifica las funciones de creación de iconos:

```typescript
const createDriverIcon = (status: string) => {
  const color = status === 'activo' ? '#10b981' :  // Verde custom
                status === 'en_ruta' ? '#3b82f6' :  // Azul custom
                '#6b7280';                           // Gris
  
  return L.divIcon({
    // ... resto del código
  });
};
```

### Cambiar Estilo de Mapas

Puedes usar diferentes proveedores de tiles:

```typescript
// CartoDB (más limpio)
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '© CartoDB'
}).addTo(map);

// Mapbox (requiere token)
L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
  id: 'mapbox/streets-v11',
  accessToken: 'tu-token-aqui'
}).addTo(map);

// OpenStreetMap Dark Mode
L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map);
```

### Ajustar Frecuencia de Actualización GPS

En `useDriverLocation.ts`, modifica las opciones:

```typescript
const options: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0  // Cambiar a 5000 para permitir cache de 5 segundos
};
```

---

## 🔧 Integración con Supabase

### Estructura de Datos

#### Tabla: `driver_locations`

```sql
CREATE TABLE driver_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES auth.users(id) UNIQUE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Tabla: `deliveries` (relevante para mapas)

```sql
-- Campos importantes para mapas:
pickup_lat DOUBLE PRECISION,
pickup_lng DOUBLE PRECISION,
delivery_lat DOUBLE PRECISION,
delivery_lng DOUBLE PRECISION,
driver_id UUID,
status TEXT
```

### Consultas Útiles

#### Obtener Drivers Activos con Ubicación

```typescript
const { data } = await supabase
  .from('driver_locations')
  .select(`
    *,
    driver:driver_id (
      full_name,
      driver_profiles (
        status,
        current_load
      )
    )
  `)
  .order('updated_at', { ascending: false });
```

#### Obtener Entregas con Coordenadas

```typescript
const { data } = await supabase
  .from('deliveries')
  .select('*')
  .not('pickup_lat', 'is', null)
  .not('delivery_lat', 'is', null)
  .in('status', ['aceptado', 'en_camino']);
```

#### Actualizar Ubicación del Driver

```typescript
const { error } = await supabase
  .from('driver_locations')
  .upsert({
    driver_id: userId,
    lat: latitude,
    lng: longitude,
    heading: heading,
    speed: speed,
    updated_at: new Date().toISOString()
  }, {
    onConflict: 'driver_id'
  });
```

### Realtime Subscriptions

#### Escuchar Cambios en Ubicaciones

```typescript
const channel = supabase
  .channel('driver-locations')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'driver_locations'
    },
    (payload) => {
      console.log('Ubicación actualizada:', payload.new);
      // Actualizar marcador en el mapa
    }
  )
  .subscribe();

// Cleanup
return () => supabase.removeChannel(channel);
```

#### Escuchar Cambios en Entregas

```typescript
const channel = supabase
  .channel('deliveries-map')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'deliveries',
      filter: 'status=in.(aceptado,en_camino)'
    },
    () => {
      refetchDeliveries();
    }
  )
  .subscribe();
```

---

## 🐛 Solución de Problemas

### Error: "Leaflet is not defined"

**Causa:** El script de Leaflet no se ha cargado completamente.

**Solución:**
```typescript
useEffect(() => {
  const checkLeaflet = setInterval(() => {
    // @ts-ignore
    if (window.L) {
      clearInterval(checkLeaflet);
      initMap();
    }
  }, 100);

  return () => clearInterval(checkLeaflet);
}, []);
```

### Error: "User denied Geolocation"

**Causa:** El usuario denegó los permisos de ubicación.

**Solución:** Mostrar instrucciones al usuario:

```tsx
<Alert>
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Permiso de Ubicación Requerido</AlertTitle>
  <AlertDescription>
    Para activar el GPS, permite el acceso a tu ubicación en la configuración 
    de tu navegador.
  </AlertDescription>
</Alert>
```

### Marcadores No Aparecen

**Causa:** Las coordenadas son `null` o inválidas.

**Solución:** Validar coordenadas antes de crear marcadores:

```typescript
if (delivery.pickup_lat && 
    delivery.pickup_lng && 
    !isNaN(delivery.pickup_lat) && 
    !isNaN(delivery.pickup_lng)) {
  // Crear marcador
}
```

### Mapa No Se Centra Correctamente

**Solución:** Usar `fitBounds` para ajustar automáticamente:

```typescript
const bounds: [number, number][] = [];

// Agregar todos los puntos
bounds.push([lat1, lng1]);
bounds.push([lat2, lng2]);

// Ajustar vista
if (bounds.length > 0) {
  map.fitBounds(bounds, { padding: [50, 50] });
}
```

### GPS No Se Actualiza

**Causa:** El intervalo de actualización es muy alto o hay problemas de red.

**Solución:** Verificar que `watchPosition` está activo y hay conexión:

```typescript
const id = navigator.geolocation.watchPosition(
  successCallback,
  errorCallback,
  {
    enableHighAccuracy: true,
    timeout: 5000,        // Reducir timeout
    maximumAge: 0         // No usar cache
  }
);
```

### Rendimiento Lento con Muchos Marcadores

**Solución:** Usar clustering para agrupar marcadores cercanos:

```typescript
// Instalar: npm install leaflet.markercluster
import 'leaflet.markercluster';

const markers = L.markerClusterGroup();
// Agregar marcadores al cluster
markers.addLayer(marker);
map.addLayer(markers);
```

---

## 📊 Métricas y Análisis

### Datos que Puedes Extraer

#### 1. Distancia Total Recorrida por Driver

```typescript
const calculateTotalDistance = (locations: LocationData[]) => {
  let total = 0;
  for (let i = 1; i < locations.length; i++) {
    const d = useDistance(locations[i-1], locations[i]);
    total += d || 0;
  }
  return total;
};
```

#### 2. Velocidad Promedio

```sql
SELECT 
  driver_id,
  AVG(speed * 3.6) as avg_speed_kmh
FROM driver_locations
WHERE updated_at > NOW() - INTERVAL '1 day'
GROUP BY driver_id;
```

#### 3. Tiempo en Ruta

```sql
SELECT 
  driver_id,
  MAX(updated_at) - MIN(updated_at) as time_on_route
FROM driver_locations
WHERE updated_at > NOW() - INTERVAL '1 day'
GROUP BY driver_id;
```

---

## 🎯 Mejores Prácticas

### 1. Seguridad

✅ **Validar siempre** que el usuario tiene el rol correcto antes de permitir acciones:

```typescript
if (role !== 'driver') {
  toast.error('Solo los conductores pueden activar el GPS');
  return;
}
```

✅ **Usar RLS** (Row Level Security) en Supabase para proteger datos:

```sql
CREATE POLICY "Drivers can update own location" 
ON driver_locations 
FOR UPDATE 
USING (driver_id = auth.uid());
```

### 2. Rendimiento

✅ **Limpiar suscripciones** al desmontar componentes:

```typescript
useEffect(() => {
  const channel = supabase.channel('name').subscribe();
  return () => supabase.removeChannel(channel);
}, []);
```

✅ **Usar `useMemo`** para cálculos costosos:

```typescript
const distance = useMemo(() => {
  return calculateDistance(point1, point2);
}, [point1, point2]);
```

### 3. UX/UI

✅ **Mostrar estados de carga**:

```typescript
{loading ? (
  <Spinner />
) : (
  <LiveMap />
)}
```

✅ **Feedback visual** para acciones del usuario:

```typescript
toast.success('GPS activado correctamente');
```

✅ **Manejar casos sin datos**:

```typescript
{drivers.length === 0 ? (
  <EmptyState message="No hay drivers activos" />
) : (
  <DriverList drivers={drivers} />
)}
```

---

## 📱 Responsive Design

Los componentes están diseñados para ser responsive. Ejemplo:

```tsx
<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* En móvil: 1 columna */}
  {/* En tablet: 2 columnas */}
  {/* En desktop: 3 columnas */}
</div>
```

Para el mapa en móvil:

```tsx
<LiveMap 
  height={isMobile ? '400px' : '700px'}
  zoom={isMobile ? 12 : 13}
/>
```

---

## 🚀 Próximas Mejoras

### Funcionalidades Sugeridas

1. **Histórico de Rutas**
   - Guardar trazas GPS completas
   - Reproducir rutas pasadas
   - Análisis de eficiencia

2. **Geocodificación Reversa**
   - Convertir coordenadas a direcciones
   - Autocompletar direcciones al crear pedidos

3. **Zonas de Cobertura**
   - Dibujar polígonos de zonas
   - Asignar drivers por zona
   - Alertas de salida de zona

4. **Optimización de Rutas**
   - Algoritmos para rutas más eficientes
   - Múltiples paradas optimizadas
   - Predicción de tráfico

5. **Notificaciones de Proximidad**
   - Alertar cuando driver está cerca
   - Push notifications
   - SMS al cliente

---

## 📚 Recursos Adicionales

### Documentación Oficial

- [Leaflet Docs](https://leafletjs.com/reference.html)
- [OpenStreetMap](https://www.openstreetmap.org/)
- [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)

### Tutoriales Recomendados

- [Leaflet Quick Start](https://leafletjs.com/examples/quick-start/)
- [React Hooks Best Practices](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [Haversine Formula Explained](https://www.movable-type.co.uk/scripts/latlong.html)

---

## ✨ Resumen

Has implementado un **sistema completo de mapas y GPS** que incluye:

✅ 4 Componentes principales  
✅ 4 Hooks personalizados  
✅ Integración completa con Supabase  
✅ Tracking en tiempo real  
✅ Cálculo de distancias y ETAs  
✅ Control GPS para drivers  
✅ Panel administrativo con mapas  

**Todo listo para producción** con TypeScript, type-safety completo, y diseño responsive.

¡A trackear! 🚀🗺️
