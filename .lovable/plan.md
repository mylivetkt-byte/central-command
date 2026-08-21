# Plan de mejoras — Mapa y aplicación

Cada paso es una iteración independiente. Al terminar cada uno, verifico y sigo con el siguiente.

---

## FASE 1 — Correcciones críticas del mapa (rápidas, alto impacto)

### Paso 1 — Bugs visibles y aislamiento multi-tenant en `LiveMap`
- Arreglar el `$` literal en los contadores del overlay (`${drivers.length}` dentro de template HTML).
- Filtrar la query de `driver_profiles` y `driver_locations` por `company_id` del usuario logueado (hoy trae todo — fuga entre empresas).
- Filtrar `deliveries` en `MapTracking` por `company_id`.
- Montar `MapStyleSwitcher` (ya existe pero no está renderizado) sobre el mapa.

### Paso 2 — Encuadre y usabilidad básica
- `fitBounds` automático al primer render sobre los marcadores existentes (en vez de arrancar siempre en Bucaramanga).
- Actualizar marcadores de pickup/delivery cuando cambian coordenadas (hoy solo se crean una vez).
- Panel lateral colapsable en tablet/móvil.

---

## FASE 2 — Realtime y navegación real

### Paso 3 — Realtime en lugar de polling
- Suscripción a `driver_locations` vía `postgres_changes` filtrada por `company_id`.
- Suscripción a `deliveries` para estados `pendiente|aceptado|en_camino`.
- Eliminar `refetchInterval: 5000` del mapa.
- Interpolar movimiento del marcador del driver entre updates para animación fluida.

### Paso 4 — Ruta real con polyline y ETA
- Integrar OSRM público (o Mapbox Directions si el usuario tiene token) para calcular ruta driver → pickup → delivery.
- Dibujar la polyline con estilo del tema.
- Mostrar ETA y distancia en el overlay del delivery seleccionado.
- Modo "seguir": cámara que sigue al driver seleccionado.

### Paso 5 — Capas y clustering
- Toggle de capas: drivers / pendientes / en_camino / completadas hoy.
- Clustering con supercluster cuando hay > 20 marcadores.
- Heatmap opcional de zonas con mayor demanda (últimas 24h).

---

## FASE 3 — Cerrar el flujo SaaS multi-empresa

### Paso 6 — Crear admin desde `SaaSCompanyDetail`
- Botón "Crear administrador" que abre modal (email + password + nombre).
- Edge function que crea el usuario con `role=admin` y `company_id` en metadata.
- Listado de admins de la empresa con acción de resetear contraseña.

### Paso 7 — Crear conductor desde `Drivers` (panel de la empresa)
- Botón "Crear conductor" que hereda el `company_id` del admin logueado.
- Edge function análoga a la de admin.
- Marcar como `is_approved=true` para que entre como `inactivo` (listo para conectarse).

### Paso 8 — Filtrar todo el panel admin por `company_id`
- Auditar y añadir filtro por `company_id` en: `Dashboard`, `Financial`, `Analytics`, `Reports`, `Alerts`, `Operations`, `Audit`.
- Mostrar el nombre de la empresa activa en el header (`DashboardLayout`).

---

## FASE 4 — Driver App completa

### Paso 9 — Cablear las 5 tabs del home del driver
- `Pedidos` → lista de pedidos disponibles + activos.
- `Mapa` → mapa embebido con ruta activa.
- `Historial` → últimos 30 días (ya existe `DeliveryHistory`, integrarlo).
- `Cuenta` → perfil, documentos, cerrar sesión.

### Paso 10 — Modo offline real
- Usar el hook `useOffline` que ya existe para encolar aceptaciones/rechazos.
- Reintentar al recuperar conexión.
- Indicador visible de "sin conexión".

### Paso 11 — Notificaciones push (PWA)
- Registrar Service Worker para push.
- Suscripción por driver guardada en tabla nueva `driver_push_subscriptions`.
- Edge function que dispara notificación al crear delivery `pendiente` en la empresa del driver.

---

## FASE 5 — Pulido y producto

### Paso 12 — Tracking público del cliente
- Generar short-link/QR al crear una delivery.
- `CustomerTracking` accesible sin login con el token del link.
- Vista simple: mapa + estado + ETA + botón de llamar al driver.

### Paso 13 — Búsqueda global (Cmd+K)
- Command palette con navegación entre páginas, pedidos por `order_id`, conductores por nombre.

### Paso 14 — Auditoría de seguridad final
- Correr el scanner de seguridad.
- Revisar RLS de todas las tablas tocadas.
- Verificar que `pending_delivery_offers` no expone datos sensibles.

---

## Detalles técnicos

- **Realtime**: usar `supabase.channel().on('postgres_changes', {schema:'public', table:'driver_locations', filter:'company_id=eq.<id>'})`.
- **Ruta**: OSRM demo server `https://router.project-osrm.org/route/v1/driving/{coords}?geometries=geojson`. Sin API key. Para producción, migrar a Mapbox/ORS.
- **Clustering**: `supercluster` + fuente GeoJSON en MapLibre (nativo, sin plugin).
- **Push**: `web-push` en edge function + VAPID keys como secrets.
- **Aislamiento**: todas las queries del frontend deben usar `useCompany()` para inyectar filtro; el trigger de DB es la segunda capa de defensa.

---

## Cómo procedo

Empiezo con **Paso 1** (bugs + aislamiento del mapa) que es la ganancia más rápida, verifico, y sigo con el 2. Si en algún punto quieres saltarte pasos o reordenar, me avisas.
