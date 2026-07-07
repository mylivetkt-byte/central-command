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
  { to: "/saas/companies", label: "Empresas", icon: Building2, adminOnly: true },
];

export const AppSidebar = () => {
  const { collapsed, setCollapsed } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user, role } = useAuth();
  const { company, switchCompany, selectedCompanyId } = useCompany();

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-sidebar transition-all duration-300 ${collapsed ? "w-16" : "w-60"}`}
    >
      <div className="flex h-16 items-center justify-between px-4 border-b border-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-sm bg-primary flex items-center justify-center">
              <Truck className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-black text-foreground uppercase tracking-tight">GoMoto Command</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-sm p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto">
        {navItems.filter(item => !(item as any).adminOnly || role === "super_admin").map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <RouterNavLink
              key={to}
              to={to}
              className={`flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-bold transition-all ${
                active
                  ? "bg-white text-black shadow-lg"
                  : "text-sidebar-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </RouterNavLink>
          );
        })}
      </nav>

      <div className="border-t border-border p-3 space-y-2">
        {!collapsed && role === "super_admin" && selectedCompanyId && (
          <div className="rounded-sm bg-primary/10 p-2.5 border border-primary/20 text-center space-y-1.5 mb-2">
            <p className="text-[10px] font-bold text-primary uppercase tracking-wider">
              Viendo: {company?.name || "Empresa"}
            </p>
            <button
              onClick={async () => {
                await switchCompany(null);
                navigate("/saas/companies");
              }}
              className="flex items-center justify-center gap-1.5 w-full rounded-sm bg-primary py-1 text-[10px] font-black text-primary-foreground uppercase tracking-wider hover:opacity-90 transition-opacity"
            >
              <ArrowLeft className="h-3 w-3 shrink-0" /> Volver a SaaS
            </button>
          </div>
        )}

        {!collapsed && (
          <div className="rounded-sm bg-muted/30 p-3 border border-border/50">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">{user?.email}</p>
            <p className="text-[10px] text-white font-black bg-black px-1.5 py-0.5 inline-block mt-1">
              {role === "super_admin" ? "SUPER ADMIN" : "ADMINISTRADOR"}
            </p>
          </div>
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-2 w-full rounded-sm px-3 py-2 text-sm font-bold text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>SALIR</span>}
        </button>
      </div>
    </aside>
  );
};
