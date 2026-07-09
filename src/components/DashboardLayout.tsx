import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider, useSidebar } from "./SidebarContext";
import { Menu } from "lucide-react";
import { Button } from "./ui/button";
import { useCompany } from "@/hooks/useCompany";

const LayoutContent = ({ children }: { children: ReactNode }) => {
  const { collapsed, setMobileMenuOpen } = useSidebar();
  const { company } = useCompany();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Header móvil */}
      <div className="md:hidden flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sticky top-0 z-30">
        <div className="flex items-center gap-2 font-black">
          <div className="h-8 w-8 rounded-sm flex items-center justify-center bg-primary text-primary-foreground">
            E
          </div>
          <span className="text-foreground tracking-tighter">
            {company?.name?.toUpperCase() || "CENTRAL"}
          </span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)}>
          <Menu className="h-6 w-6" />
        </Button>
      </div>

      <AppSidebar />
      <main
        className={`flex-1 min-h-screen transition-all duration-300 ${collapsed ? "md:ml-16" : "md:ml-60"}`}
      >
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
};

export const DashboardLayout = ({ children }: { children: ReactNode }) => (
  <SidebarProvider>
    <LayoutContent>{children}</LayoutContent>
  </SidebarProvider>
);
