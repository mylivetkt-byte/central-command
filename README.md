# Central Command - Sistema de Logística y Domicilios

Este proyecto es una plataforma de comando centralizada para la gestión de operaciones logísticas y de mensajería en tiempo real. Está diseñado con una estética industrial de alto contraste inspirada en sistemas críticos y plataformas como Uber.

## 🚀 Funcionalidades Principales

### 👨‍💻 Panel de Administración (Central)
- **Dashboard en Tiempo Real**: Visualización de métricas clave, estado de la flota y volumen de pedidos.
- **Gestión de Operaciones**: Control total sobre los pedidos activos, asignaciones y estados de entrega.
- **Despacho Avanzado**: Interfaz optimizada para coordinar conductores y rutas de manera eficiente.
- **Métricas Financieras**: Seguimiento de ingresos, comisiones y liquidaciones.
- **Mapa de Seguimiento**: Visualización geográfica de todos los conductores y entregas activas mediante MapLibre/CartoDB.
- **Alertas y Auditoría**: Sistema de monitoreo para detectar irregularidades y mantener un historial detallado de acciones.

### 🚲 Aplicación del Conductor (Driver App)
- **Mapa de Pedidos Cercanos**: Interfaz con mapas 3D para localizar y aceptar pedidos en la zona.
- **Navegación Integrada**: Soporte para cambio de estilos de mapa (Claro, Oscuro, Satélite).
- **Gestión de Entregas**: Flujo de trabajo para recogida, transporte y finalización de domicilios.

### 📍 Seguimiento del Cliente (Customer tracking)
- **Vista Pública**: Los clientes pueden seguir su pedido en tiempo real sin necesidad de iniciar sesión.

## 🎨 Sistema de Diseño: Industrial Uber
El proyecto utiliza un sistema de diseño estrictamente monocromático y de alto contraste:
- **Colores**: Negro puro (#000000), Blanco puro (#FFFFFF) y Grises de escala industrial.
- **Tipografía**: Inter para máxima legibilidad.
- **Componentes**: Bordes rectos, sombras sutiles y estados de "Glow" para alertas críticas.

## 🛠️ Tecnologías
- **Frontend**: React + Vite + TypeScript.
- **Estilos**: Tailwind CSS + Shadcn UI.
- **Mapas**: MapLibre GL JS + Carto Vector Tiles.
- **Base de Datos**: Supabase (PostgreSQL) con políticas de seguridad RLS.
- **Estado**: TanStack Query (React Query) para sincronización de datos.

## 🛠️ Instalación y Desarrollo
1. Instala las dependencias: `npm install`
2. Configura las variables de entorno en `.env`.
3. Ejecuta el entorno de desarrollo: `npm run dev`
