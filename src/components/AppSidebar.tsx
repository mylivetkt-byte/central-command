import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, BarChart3, Truck, Users, DollarSign,
  AlertTriangle, ClipboardList, Map, Zap, ChevronLeft, ChevronRight, LogOut
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/analytics", label: "Analíticas", icon: BarChart3 },
  { to: "/operations", label: "Operaciones", icon: Map },
  { to: "/drivers", label: "Repartidores", icon: Users },
  { to: "/dispatch", label: "Despacho", icon: Zap },
  { to: "/financial", label: "Finanzas", icon: DollarSign },
  { to: "/alerts", label: "Alertas", icon: AlertTriangle },
  { to: "/audit", label: "Auditoría", icon: ClipboardList },
  { to: "/reports", label: "Reportes", icon: Truck },
];

export const AppSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { signOut, user } = useAuth();

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border/50 bg-sidebar transition-all duration-300 ${collapsed ? "w-16" : "w-60"}`}
    >
      <div className="flex h-16 items-center justify-between px-4 border-b border-border/50">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Truck className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold text-foreground">LogiCentral</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <RouterNavLink
              key={to}
              to={to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? "bg-primary/10 text-primary glow-primary"
                  : "text-sidebar-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </RouterNavLink>
          );
        })}
      </nav>

      <div className="border-t border-border/50 p-3 space-y-2">
        {!collapsed && (
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">{user?.email}</p>
            <p className="text-xs text-primary">Admin</p>
          </div>
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
};
