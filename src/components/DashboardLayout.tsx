import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider, useSidebar } from "./SidebarContext";

const LayoutContent = ({ children }: { children: ReactNode }) => {
  const { collapsed } = useSidebar();
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main
        className={`min-h-screen transition-all duration-300 ${collapsed ? "ml-16" : "ml-60"}`}
      >
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
};

export const DashboardLayout = ({ children }: { children: ReactNode }) => (
  <SidebarProvider>
    <LayoutContent>{children}</LayoutContent>
  </SidebarProvider>
);
