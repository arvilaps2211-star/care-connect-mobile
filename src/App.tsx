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
import AmbulanceLogin from "./pages/AmbulanceLogin";
import NotFound from "./pages/NotFound";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { useAppInitialization } from "@/hooks/useAppInitialization";
import { SOSProvider, useSOSContext } from "@/contexts/SOSContext";
import GlobalSOSOverlay from "@/components/GlobalSOSOverlay";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { createEmergencyChannel, initializeBackgroundNotifications } from "@/utils/backgroundNotification";
import { isNativePlatform } from "@/utils/capacitor";

const queryClient = new QueryClient();

// Detect if we're in WEB development mode (npm run dev on desktop)
const isWebDevMode = import.meta.env.DEV && !isNativePlatform();

// Detect if this is the standalone ambulance app build
const isAmbulanceApp = import.meta.env.VITE_APP_TYPE === "ambulance";

// Global SOS Overlay wrapper - ONLY for mobile mode
const GlobalSOSWrapper = () => {
  const { showSOS, dismissSOS, onEmergencyConfirmed, triggerSOS } = useSOSContext();
  const { toast } = useToast();

  useEffect(() => {
    if (isWebDevMode) {
      console.log('[App] Web dev mode - skipping mobile SOS initialization');
      return;
    }

    createEmergencyChannel();
    initializeBackgroundNotifications({
      onSafe: () => {
        dismissSOS();
        toast({ title: "Glad you're safe!", description: "The alert has been dismissed." });
      },
      onSOS: () => triggerSOS(),
    });
  }, [dismissSOS, triggerSOS, toast]);

  if (isWebDevMode) return null;

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

  return (
    <GlobalSOSOverlay
      open={showSOS}
      onClose={dismissSOS}
      onEmergencyConfirmed={handleEmergencyConfirmed}
      onSafe={() => toast({ title: "Glad you're safe!", description: "The alert has been dismissed." })}
    />
  );
};

/**
 * WEB DEV routes - ALL routes accessible in browser via npm run dev
 * Hospital, Admin, Ambulance dashboards + User routes for testing
 */
const WebRoutes = () => (
  <Routes>
    {/* Default landing → Hospital Login */}
    <Route path="/" element={<HospitalLogin />} />

    {/* Hospital */}
    <Route path="/hospital/login" element={<HospitalLogin />} />
    <Route path="/hospital" element={
      <ProtectedRoute requiredRole="hospital" redirectTo="/hospital/login">
        <HospitalDashboard />
      </ProtectedRoute>
    } />

    {/* Admin */}
    <Route path="/admin" element={
      <ProtectedRoute requiredRole="admin" redirectTo="/hospital/login">
        <AdminPanel />
      </ProtectedRoute>
    } />

    {/* Ambulance */}
    <Route path="/ambulance/login" element={<AmbulanceLogin />} />
    <Route path="/ambulance/driver" element={
      <ProtectedRoute requiredRole="ambulance" redirectTo="/ambulance/login">
        <AmbulanceDriverDashboard />
      </ProtectedRoute>
    } />
    <Route path="/ambulance" element={<AmbulanceLogin />} />

    {/* User routes */}
    <Route path="/auth" element={<Auth />} />
    <Route path="/onboarding" element={<Onboarding />} />
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/settings" element={<Settings />} />
    <Route path="/emergency" element={<Dashboard />} />

    {/* Catch-all */}
    <Route path="*" element={<NotFound />} />
  </Routes>
);

/**
 * MOBILE routes - native app with SOS, GPS, accelerometer
 */
const MobileRoutes = () => (
  <MobileOnly>
    <GlobalSOSWrapper />
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/hospital/login" element={<HospitalLogin />} />

      <Route path="/onboarding" element={
        <ProtectedRoute requiredRole="user"><Onboarding /></ProtectedRoute>
      } />
      <Route path="/dashboard" element={
        <ProtectedRoute requiredRole="user"><Dashboard /></ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute requiredRole="user"><Settings /></ProtectedRoute>
      } />
      <Route path="/emergency" element={
        <ProtectedRoute requiredRole="user"><Dashboard /></ProtectedRoute>
      } />

      <Route path="/hospital" element={
        <ProtectedRoute requiredRole="hospital" redirectTo="/hospital/login">
          <HospitalDashboard />
        </ProtectedRoute>
      } />
      <Route path="/admin" element={
        <ProtectedRoute requiredRole="admin" redirectTo="/auth">
          <AdminPanel />
        </ProtectedRoute>
      } />
      <Route path="/ambulance/driver" element={
        <ProtectedRoute requiredRole="ambulance" redirectTo="/hospital/login">
          <AmbulanceDriverDashboard />
        </ProtectedRoute>
      } />
      <Route path="/ambulance" element={
        <ProtectedRoute requiredRole="ambulance" redirectTo="/hospital/login">
          <AmbulanceDriverDashboard />
        </ProtectedRoute>
      } />

      <Route path="*" element={<NotFound />} />
    </Routes>
  </MobileOnly>
);

/**
 * AMBULANCE APP routes - standalone ambulance driver app
 * No auth gate — the driver authenticates via ambulance ID in URL params
 */
const AmbulanceAppRoutes = () => (
  <Routes>
    <Route path="*" element={<AmbulanceDriverDashboard />} />
  </Routes>
);

const AppContent = () => {
  const { initialized, permissions, platform } = useAppInitialization();

  if (initialized) {
    console.log('[App] Initialized on', platform, 'with permissions:', permissions);
  }

  useEffect(() => {
    if (isAmbulanceApp) {
      console.log('[App] 🚑 AMBULANCE APP mode');
    } else if (isWebDevMode) {
      console.log('[App] 🖥️ WEB DEV mode');
    } else {
      console.log('[App] 📱 MOBILE mode');
    }
  }, []);

  const getRoutes = () => {
    if (isAmbulanceApp) return <AmbulanceAppRoutes />;
    if (isWebDevMode) return <WebRoutes />;
    return <MobileRoutes />;
  };

  return (
    <AppErrorBoundary>
      <BrowserRouter>
        {getRoutes()}
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
