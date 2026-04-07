import React, { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AdminRoute = ({ children }: { children: ReactNode }) => (
  <ProtectedRoute requiredRole="admin" redirectTo="/admin-login">
    {children}
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
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Auth */}
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route path="/driver-login" element={<DriverLogin />} />

            {/* Customer Tracking — public, no auth */}
            <Route path="/track/:orderId" element={<CustomerTracking />} />

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

            {/* Driver App */}
            <Route path="/driver" element={<DriverRoute><DriverApp /></DriverRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
