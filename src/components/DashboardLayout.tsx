import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";

export const DashboardLayout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen bg-background">
    <AppSidebar />
    <main className="ml-60 min-h-screen transition-all duration-300">
      <div className="p-6 lg:p-8">{children}</div>
    </main>
  </div>
);
