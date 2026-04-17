import { ReactNode } from "react";
import { motion } from "framer-motion";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  variant?: "primary" | "success" | "warning" | "danger" | "default";
  trend?: { value: number; label: string };
}

const variantStyles = {
  primary: "glow-primary border-primary/40",
  success: "glow-success border-success/40",
  warning: "glow-warning border-warning/40",
  danger: "glow-danger border-destructive/40",
  default: "border-border",
};

const iconBgStyles = {
  primary: "bg-white text-black",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  danger: "bg-destructive text-destructive-foreground",
  default: "bg-muted text-muted-foreground",
};

export const KPICard = ({ title, value, subtitle, icon, variant = "default", trend }: KPICardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className={`glass-card p-4 transition-all ${variantStyles[variant]}`}
  >
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">{title}</p>
        <p className="text-3xl font-black text-foreground tracking-tighter">{value}</p>
        {subtitle && <p className="text-xs font-medium text-muted-foreground">{subtitle}</p>}
        {trend && (
          <p className={`text-xs font-bold ${trend.value >= 0 ? "text-success" : "text-destructive"}`}>
            {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}% {trend.label}
          </p>
        )}
      </div>
      <div className={`rounded-sm p-2 shadow-sm ${iconBgStyles[variant]}`}>
        {icon}
      </div>
    </div>
  </motion.div>
);
