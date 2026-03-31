export interface Driver {
  id: string;
  name: string;
  avatar: string;
  phone: string;
  status: "activo" | "inactivo" | "suspendido" | "en_ruta";
  totalDeliveries: number;
  avgDeliveryTime: number;
  acceptanceRate: number;
  cancellationRate: number;
  revenue: number;
  commission: number;
  rating: number;
  lat: number;
  lng: number;
  currentLoad: number;
  zone: string;
}

export interface Delivery {
  id: string;
  orderId: string;
  driverId: string;
  driverName: string;
  customerName: string;
  pickupAddress: string;
  deliveryAddress: string;
  status: "pendiente" | "aceptado" | "en_camino" | "entregado" | "cancelado";
  createdAt: string;
  acceptedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  amount: number;
  commission: number;
  isDelayed: boolean;
  estimatedTime: number;
  zone: string;
}

export interface Alert {
  id: string;
  type: "delayed" | "inactive_driver" | "high_demand";
  message: string;
  severity: "warning" | "danger" | "info";
  timestamp: string;
  resolved: boolean;
}

export interface AuditEntry {
  id: string;
  deliveryId: string;
  event: string;
  timestamp: string;
  details: string;
}

export interface DailyStats {
  date: string;
  deliveries: number;
  revenue: number;
  avgTime: number;
  cancellations: number;
}

const driverNames = [
  "Carlos Rodríguez", "María González", "Juan Pérez", "Ana Martínez",
  "Luis Hernández", "Sofia López", "Diego Ramírez", "Camila Torres",
  "Andrés García", "Valentina Díaz", "Felipe Morales", "Isabella Cruz"
];

const zones = ["Norte", "Sur", "Centro", "Oriente", "Occidente"];

export const drivers: Driver[] = driverNames.map((name, i) => ({
  id: `DRV-${String(i + 1).padStart(3, "0")}`,
  name,
  avatar: name.split(" ").map(n => n[0]).join(""),
  phone: `+57 3${Math.floor(100000000 + Math.random() * 900000000)}`,
  status: (["activo", "activo", "activo", "en_ruta", "en_ruta", "inactivo", "activo", "en_ruta", "activo", "suspendido", "activo", "en_ruta"] as Driver["status"][])[i],
  totalDeliveries: Math.floor(80 + Math.random() * 200),
  avgDeliveryTime: Math.floor(18 + Math.random() * 25),
  acceptanceRate: Math.floor(75 + Math.random() * 25),
  cancellationRate: Math.floor(1 + Math.random() * 12),
  revenue: Math.floor(800000 + Math.random() * 2500000),
  commission: Math.floor(120000 + Math.random() * 400000),
  rating: +(3.5 + Math.random() * 1.5).toFixed(1),
  lat: 4.6 + (Math.random() - 0.5) * 0.1,
  lng: -74.08 + (Math.random() - 0.5) * 0.1,
  currentLoad: Math.floor(Math.random() * 4),
  zone: zones[i % zones.length],
}));

const statusOptions: Delivery["status"][] = ["pendiente", "aceptado", "en_camino", "entregado", "cancelado"];

export const deliveries: Delivery[] = Array.from({ length: 50 }, (_, i) => {
  const status = statusOptions[Math.floor(Math.random() * statusOptions.length)];
  const driver = drivers[Math.floor(Math.random() * drivers.length)];
  const hour = Math.floor(6 + Math.random() * 16);
  const min = Math.floor(Math.random() * 60);
  return {
    id: `DEL-${String(i + 1).padStart(4, "0")}`,
    orderId: `ORD-${String(1000 + i).padStart(5, "0")}`,
    driverId: driver.id,
    driverName: driver.name,
    customerName: `Cliente ${i + 1}`,
    pickupAddress: `Calle ${Math.floor(Math.random() * 150)} #${Math.floor(Math.random() * 90)}-${Math.floor(Math.random() * 99)}`,
    deliveryAddress: `Carrera ${Math.floor(Math.random() * 80)} #${Math.floor(Math.random() * 120)}-${Math.floor(Math.random() * 99)}`,
    status,
    createdAt: `2026-03-31T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`,
    acceptedAt: status !== "pendiente" ? `2026-03-31T${String(hour).padStart(2, "0")}:${String(min + 2).padStart(2, "0")}:00` : undefined,
    pickedUpAt: ["en_camino", "entregado"].includes(status) ? `2026-03-31T${String(hour).padStart(2, "0")}:${String(min + 8).padStart(2, "0")}:00` : undefined,
    deliveredAt: status === "entregado" ? `2026-03-31T${String(hour).padStart(2, "0")}:${String(min + 25).padStart(2, "0")}:00` : undefined,
    amount: Math.floor(8000 + Math.random() * 35000),
    commission: Math.floor(1500 + Math.random() * 5000),
    isDelayed: Math.random() > 0.75,
    estimatedTime: Math.floor(15 + Math.random() * 30),
    zone: zones[Math.floor(Math.random() * zones.length)],
  };
});

export const alerts: Alert[] = [
  { id: "ALT-001", type: "delayed", message: "Pedido DEL-0012 lleva más de 45 min sin entregar", severity: "danger", timestamp: "2026-03-31T14:32:00", resolved: false },
  { id: "ALT-002", type: "inactive_driver", message: "Repartidor Felipe Morales inactivo por 2 horas", severity: "warning", timestamp: "2026-03-31T13:15:00", resolved: false },
  { id: "ALT-003", type: "high_demand", message: "Zona Norte con alta demanda - 12 pedidos pendientes", severity: "info", timestamp: "2026-03-31T12:45:00", resolved: false },
  { id: "ALT-004", type: "delayed", message: "Pedido DEL-0028 excede tiempo estimado en 15 min", severity: "warning", timestamp: "2026-03-31T14:10:00", resolved: false },
  { id: "ALT-005", type: "high_demand", message: "Zona Centro saturada - considerar reasignación", severity: "info", timestamp: "2026-03-31T11:30:00", resolved: true },
  { id: "ALT-006", type: "inactive_driver", message: "Repartidor Valentina Díaz sin conexión desde las 10:00", severity: "danger", timestamp: "2026-03-31T10:05:00", resolved: false },
];

export const auditLog: AuditEntry[] = [
  { id: "AUD-001", deliveryId: "DEL-0001", event: "Pedido creado", timestamp: "2026-03-31T08:00:00", details: "Cliente solicitó domicilio desde Restaurante El Buen Sabor" },
  { id: "AUD-002", deliveryId: "DEL-0001", event: "Pedido aceptado", timestamp: "2026-03-31T08:02:15", details: "Aceptado por Carlos Rodríguez" },
  { id: "AUD-003", deliveryId: "DEL-0001", event: "En camino", timestamp: "2026-03-31T08:10:30", details: "Repartidor recogió el pedido" },
  { id: "AUD-004", deliveryId: "DEL-0001", event: "Entregado", timestamp: "2026-03-31T08:28:45", details: "Entrega confirmada por el cliente" },
  { id: "AUD-005", deliveryId: "DEL-0005", event: "Pedido creado", timestamp: "2026-03-31T09:15:00", details: "Pedido express - prioridad alta" },
  { id: "AUD-006", deliveryId: "DEL-0005", event: "Pedido aceptado", timestamp: "2026-03-31T09:16:20", details: "Aceptado por María González" },
  { id: "AUD-007", deliveryId: "DEL-0005", event: "En camino", timestamp: "2026-03-31T09:22:00", details: "Recogido del local" },
  { id: "AUD-008", deliveryId: "DEL-0005", event: "Entregado", timestamp: "2026-03-31T09:40:10", details: "Entregado con éxito" },
];

export const dailyStats: DailyStats[] = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(2026, 2, i + 1);
  return {
    date: d.toISOString().split("T")[0],
    deliveries: Math.floor(120 + Math.random() * 180),
    revenue: Math.floor(2500000 + Math.random() * 4000000),
    avgTime: Math.floor(20 + Math.random() * 15),
    cancellations: Math.floor(2 + Math.random() * 15),
  };
});

export const getKPIs = () => {
  const today = deliveries;
  const enCurso = today.filter(d => ["aceptado", "en_camino"].includes(d.status)).length;
  const pendientes = today.filter(d => d.status === "pendiente").length;
  const finalizados = today.filter(d => d.status === "entregado").length;
  const cancelados = today.filter(d => d.status === "cancelado").length;
  const totalRevenue = today.reduce((s, d) => s + d.amount, 0);
  const totalCommission = today.reduce((s, d) => s + d.commission, 0);
  const activeDrivers = drivers.filter(d => ["activo", "en_ruta"].includes(d.status)).length;
  return { enCurso, pendientes, finalizados, cancelados, totalRevenue, totalCommission, activeDrivers, totalDeliveries: today.length };
};

export const formatCurrency = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);
