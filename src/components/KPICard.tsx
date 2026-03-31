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
  primary: "glow-primary border-primary/20",
  success: "glow-success border-accent/20",
  warning: "glow-warning border-warning/20",
  danger: "glow-danger border-destructive/20",
  default: "border-border/50",
};

const iconBgStyles = {
  primary: "bg-primary/10 text-primary",
  success: "bg-accent/10 text-accent",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  default: "bg-muted text-muted-foreground",
};

export const KPICard = ({ title, value, subtitle, icon, variant = "default", trend }: KPICardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`glass-card p-5 ${variantStyles[variant]}`}
  >
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        {trend && (
          <p className={`text-xs font-medium ${trend.value >= 0 ? "text-accent" : "text-destructive"}`}>
            {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}% {trend.label}
          </p>
        )}
      </div>
      <div className={`rounded-xl p-3 ${iconBgStyles[variant]}`}>
        {icon}
      </div>
    </div>
  </motion.div>
);
