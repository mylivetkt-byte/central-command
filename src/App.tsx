import React, { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { CompanyProvider, useCompany } from "@/hooks/useCompany";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { SaasRoute } from "@/components/SaasRoute";
import { ReloadPrompt } from "@/components/ReloadPrompt";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Operations from "./pages/Operations";
import Drivers from "./pages/Drivers";
import Dispatch from "./pages/Dispatch";
import Financial from "./pages/Financial";
import Alerts from "./pages/Alerts";
import Audit from "./pages/Audit";
import Reports from "./pages/Reports";
import AdminLogin from "./pages/AdminLogin";
import DriverLogin from "./pages/DriverLogin";
import DriverApp from "./pages/DriverApp";
import MapTracking from "./pages/MapTracking";
import CustomerTracking from "./pages/CustomerTracking";
import InstallApp from "./pages/InstallApp";
import DriverQR from "./pages/DriverQR";
import NotFound from "./pages/NotFound";
import SaaSCompanies from "./pages/SaaSCompanies";
import SaaSCompanyDetail from "./pages/SaaSCompanyDetail";
import SaaSNewCompany from "./pages/SaaSNewCompany";
import SaasLogin from "./pages/SaasLogin";
import SaaSDashboard from "./pages/SaaSDashboard";

const queryClient = new QueryClient();

// Redirige al super_admin fuera de rutas operativas hacia el panel SaaS si no tiene una empresa seleccionada para inspección.
const SuperAdminGuard = ({ children }: { children: ReactNode }) => {
  const { role } = useAuth();
  const { selectedCompanyId } = useCompany();
  const location = useLocation();
  if (role === "super_admin" && !location.pathname.startsWith("/saas") && !selectedCompanyId) {
    return <Navigate to="/saas/dashboard" replace />;
  }
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: ReactNode }) => (
  <ProtectedRoute requiredRole="admin" redirectTo="/admin-login">
    <SuperAdminGuard>{children}</SuperAdminGuard>
  </ProtectedRoute>
);

const DriverRoute = ({ children }: { children: ReactNode }) => (
  <ProtectedRoute requiredRole="driver" redirectTo="/driver-login">
    {children}
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ReloadPrompt />
      <HashRouter>
        <AuthProvider>
          <CompanyProvider>
          <Routes>
            {/* Auth */}
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route path="/driver-login" element={<DriverLogin />} />
            <Route path="/saas/login" element={<SaasLogin />} />

            {/* Public pages */}
            <Route path="/track/:orderId" element={<CustomerTracking />} />
            <Route path="/install" element={<InstallApp />} />
            <Route path="/driver-qr" element={<AdminRoute><DriverQR /></AdminRoute>} />

            {/* Admin Central */}
            <Route path="/" element={<AdminRoute><Dashboard /></AdminRoute>} />
            <Route path="/analytics" element={<AdminRoute><Analytics /></AdminRoute>} />
            <Route path="/operations" element={<AdminRoute><Operations /></AdminRoute>} />
            <Route path="/drivers" element={<AdminRoute><Drivers /></AdminRoute>} />
            <Route path="/dispatch" element={<AdminRoute><Dispatch /></AdminRoute>} />
            <Route path="/financial" element={<AdminRoute><Financial /></AdminRoute>} />
            <Route path="/alerts" element={<AdminRoute><Alerts /></AdminRoute>} />
            <Route path="/audit" element={<AdminRoute><Audit /></AdminRoute>} />
            <Route path="/reports" element={<AdminRoute><Reports /></AdminRoute>} />
            <Route path="/map-tracking" element={<AdminRoute><MapTracking /></AdminRoute>} />

            {/* SaaS */}
            <Route path="/saas/dashboard" element={<SaasRoute><SaaSDashboard /></SaasRoute>} />
            <Route path="/saas/companies" element={<SaasRoute><SaaSCompanies /></SaasRoute>} />
            <Route path="/saas/companies/new" element={<SaasRoute><SaaSNewCompany /></SaasRoute>} />
            <Route path="/saas/companies/:id" element={<SaasRoute><SaaSCompanyDetail /></SaasRoute>} />

            {/* Driver App */}
            <Route path="/driver" element={<DriverRoute><DriverApp /></DriverRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
          </CompanyProvider>
        </AuthProvider>
        </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
