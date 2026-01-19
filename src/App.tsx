import { Toaster } from "@/components/ui/toaster";
import AmbulanceDriverDashboard from "./pages/AmbulanceDriverDashboard";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MobileOnly from "./components/MobileOnly";
import ProtectedRoute from "./components/ProtectedRoute";
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
import { useEffect } from "react";
import { createEmergencyChannel, initializeBackgroundNotifications } from "@/utils/backgroundNotification";

const queryClient = new QueryClient();

// Global SOS Overlay wrapper
const GlobalSOSWrapper = () => {
  const { showSOS, dismissSOS, onEmergencyConfirmed, triggerSOS } = useSOSContext();
  const { toast } = useToast();

  // Initialize background notification handlers
  useEffect(() => {
    createEmergencyChannel();
    initializeBackgroundNotifications({
      onSafe: () => {
        dismissSOS();
        toast({
          title: "Glad you're safe!",
          description: "The alert has been dismissed.",
        });
      },
      onSOS: () => {
        // Trigger SOS flow when user taps SOS from notification
        triggerSOS();
      },
    });
  }, [dismissSOS, triggerSOS, toast]);

  const handleEmergencyConfirmed = async (location: { latitude: number; longitude: number }) => {
    if (onEmergencyConfirmed) {
      await onEmergencyConfirmed(location);
    } else {
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

  if (initialized) {
    console.log('[App] Initialized on', platform, 'with permissions:', permissions);
  }

  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <MobileOnly>
          <GlobalSOSWrapper />
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/hospital/login" element={<HospitalLogin />} />
            
            {/* User routes - require 'user' role */}
            <Route path="/onboarding" element={
              <ProtectedRoute requiredRole="user">
                <Onboarding />
              </ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute requiredRole="user">
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute requiredRole="user">
                <Settings />
              </ProtectedRoute>
            } />
            
            {/* Hospital routes - require 'hospital' role */}
            <Route path="/hospital" element={
              <ProtectedRoute requiredRole="hospital" redirectTo="/hospital/login">
                <HospitalDashboard />
              </ProtectedRoute>
            } />
            
            {/* Admin routes - require 'admin' role */}
            <Route path="/admin" element={
              <ProtectedRoute requiredRole="admin" redirectTo="/auth">
                <AdminPanel />
              </ProtectedRoute>
            } />
            
            {/* Ambulance routes - require 'ambulance' role */}
            <Route path="/ambulance/driver" element={
              <ProtectedRoute requiredRole="ambulance" redirectTo="/hospital/login">
                <AmbulanceDriverDashboard />
              </ProtectedRoute>
            } />
            
            {/* Catch-all */}
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
