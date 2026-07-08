import { NavLink as RouterNavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, BarChart3, Truck, Users, DollarSign,
  AlertTriangle, ClipboardList, Map, Zap, ChevronLeft, ChevronRight, LogOut, MapPin,
  Building2, ArrowLeft
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSidebar } from "./SidebarContext";
import { useCompany } from "@/hooks/useCompany";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/analytics", label: "Analíticas", icon: BarChart3 },
  { to: "/map-tracking", label: "Mapa en Vivo", icon: MapPin },
  { to: "/operations", label: "Operaciones", icon: Map },
  { to: "/drivers", label: "Repartidores", icon: Users },
  { to: "/dispatch", label: "Despacho", icon: Zap },
  { to: "/financial", label: "Finanzas", icon: DollarSign },
  { to: "/alerts", label: "Alertas", icon: AlertTriangle },
  { to: "/audit", label: "Auditoría", icon: ClipboardList },
  { to: "/reports", label: "Reportes", icon: Truck },
  { to: "/saas/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: true },
  { to: "/saas/companies", label: "Empresas", icon: Building2, adminOnly: true },
];

const hexToHsl = (hex: string) => {
  if (!hex || !hex.startsWith("#")) return "0 0% 100%";
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

export const AppSidebar = () => {
  const { collapsed, setCollapsed } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user, role } = useAuth();
  const { company, switchCompany, selectedCompanyId } = useCompany();

  const brandColorHsl = company?.primary_color ? hexToHsl(company.primary_color) : null;

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-slate-200 bg-white shadow-xl transition-all duration-300 ${collapsed ? "w-16" : "w-60"}`}
    >
      {brandColorHsl && company?.primary_color && (
        <style>{`
          :root {
            --primary: ${brandColorHsl} !important;
            --gradient-primary: linear-gradient(to right, ${company.primary_color}, ${company.primary_color}dd) !important;
            --ring: ${brandColorHsl} !important;
          }
          .bg-primary {
            background-color: ${company.primary_color} !important;
          }
          .text-primary {
            color: ${company.primary_color} !important;
          }
          .border-primary {
            border-color: ${company.primary_color} !important;
          }
        `}</style>
      )}

      <div className="flex h-16 items-center justify-between px-4 border-b border-slate-100">
        {!collapsed && (
          <div className="flex items-center gap-2 font-black">
            <div className="h-8 w-8 rounded-sm flex items-center justify-center overflow-hidden bg-slate-100">
              {company?.logo_url ? (
                <img src={company.logo_url} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <Truck className="h-4 w-4 text-emerald-600" />
              )}
            </div>
            <span className="text-sm font-black text-slate-900 uppercase tracking-tight truncate max-w-[130px]">
              {company?.name || "GoMoto Command"}
            </span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-sm p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto">
        {navItems
          .filter((item) => {
            if (role === "super_admin") {
              // Si es super_admin y no está inspeccionando, solo muestra "Empresas" y "Dashboard" del SaaS
              if (!selectedCompanyId) {
                return (item as any).adminOnly;
              }
              // Si está inspeccionando, oculta los accesos de SaaS
              return !(item as any).adminOnly;
            }
            // Para administradores de empresa, oculta "Empresas"
            return !(item as any).adminOnly;
          })
          .map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <RouterNavLink
                key={to}
                to={to}
                className={`flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-bold transition-all ${
                  active
                    ? "bg-emerald-50 text-emerald-700 shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </RouterNavLink>
            );
          })}
      </nav>

      <div className="border-t border-slate-100 p-3 space-y-2">


        {!collapsed && (
          <div className="rounded-sm bg-slate-50 p-3 border border-slate-100">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">{user?.email}</p>
            <p className="text-[10px] text-white font-black bg-emerald-600 px-1.5 py-0.5 inline-block mt-1">
              {role === "super_admin" ? "SUPER ADMIN" : "ADMINISTRADOR"}
            </p>
          </div>
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-2 w-full rounded-sm px-3 py-2 text-sm font-bold text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>SALIR</span>}
        </button>
      </div>
    </aside>
  );
};
