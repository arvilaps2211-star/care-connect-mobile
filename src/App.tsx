import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MobileOnly from "./components/MobileOnly";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import HospitalLogin from "./pages/HospitalLogin";
import HospitalDashboard from "./pages/HospitalDashboard";
// AmbulanceDashboard is now merged into HospitalDashboard
import AdminPanel from "./pages/AdminPanel";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <MobileOnly>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/hospital/login" element={<HospitalLogin />} />
            <Route path="/hospital" element={<HospitalDashboard />} />
            <Route path="/ambulance" element={<HospitalDashboard />} />
            <Route path="/admin" element={<AdminPanel />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </MobileOnly>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
