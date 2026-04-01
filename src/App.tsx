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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AdminRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute requiredRole="admin" redirectTo="/admin-login">
    {children}
  </ProtectedRoute>
);

const DriverRoute = ({ children }: { children: React.ReactNode }) => (
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
