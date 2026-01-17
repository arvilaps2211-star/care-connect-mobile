import { Toaster } from "@/components/ui/toaster";
import AmbulanceDriverDashboard from "./pages/AmbulanceDriverDashboard";
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
import AdminPanel from "./pages/AdminPanel";
import NotFound from "./pages/NotFound";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { useAppInitialization } from "@/hooks/useAppInitialization";
import { SOSProvider, useSOSContext } from "@/contexts/SOSContext";
import GlobalSOSOverlay from "@/components/GlobalSOSOverlay";
import { useToast } from "@/hooks/use-toast";

const queryClient = new QueryClient();

// Global SOS Overlay wrapper
const GlobalSOSWrapper = () => {
  const { showSOS, dismissSOS, onEmergencyConfirmed } = useSOSContext();
  const { toast } = useToast();

  const handleEmergencyConfirmed = async (location: { latitude: number; longitude: number }) => {
    if (onEmergencyConfirmed) {
      await onEmergencyConfirmed(location);
    } else {
      // Fallback - shouldn't happen if dashboard is loaded
      toast({
        title: "Emergency Triggered",
        description: "Please navigate to the dashboard to complete the emergency flow.",
        variant: "destructive",
      });
    }
  };

  const handleSafe = () => {
    toast({
      title: "Glad you're safe!",
      description: "The alert has been dismissed.",
    });
  };

  return (
    <GlobalSOSOverlay
      open={showSOS}
      onClose={dismissSOS}
      onEmergencyConfirmed={handleEmergencyConfirmed}
      onSafe={handleSafe}
    />
  );
};

// App initialization wrapper component
const AppContent = () => {
  const { initialized, permissions, platform } = useAppInitialization();

  // Log initialization status
  if (initialized) {
    console.log('[App] Initialized on', platform, 'with permissions:', permissions);
  }

  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <MobileOnly>
          <GlobalSOSWrapper />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/hospital/login" element={<HospitalLogin />} />
            <Route path="/hospital" element={<HospitalDashboard />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/ambulance/driver" element={<AmbulanceDriverDashboard />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </MobileOnly>
      </BrowserRouter>
    </AppErrorBoundary>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SOSProvider>
        <Toaster />
        <Sonner />
        <AppContent />
      </SOSProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
