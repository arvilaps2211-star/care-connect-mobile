import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SplashScreen from "@/components/SplashScreen";

const Index = () => {
  const navigate = useNavigate();
  const [showSplash, setShowSplash] = useState(true);
  const [authCheckComplete, setAuthCheckComplete] = useState(false);
  const [targetRoute, setTargetRoute] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      setTargetRoute("/auth");
      setAuthCheckComplete(true);
      return;
    }

    // Check user role
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (role) {
      if (role.role === "admin") {
        setTargetRoute("/admin");
        setAuthCheckComplete(true);
        return;
      } else if (role.role === "hospital") {
        setTargetRoute("/hospital");
        setAuthCheckComplete(true);
        return;
      }
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("user_id", session.user.id)
      .single();

    if (profile?.onboarding_completed) {
      setTargetRoute("/dashboard");
    } else {
      setTargetRoute("/onboarding");
    }
    setAuthCheckComplete(true);
  };

  const handleSplashComplete = () => {
    setShowSplash(false);
    if (targetRoute) {
      navigate(targetRoute);
    }
  };

  // If auth check is done and splash is still showing, wait for splash
  // If auth check is done and splash is done, navigate
  useEffect(() => {
    if (!showSplash && targetRoute) {
      navigate(targetRoute);
    }
  }, [showSplash, targetRoute, navigate]);

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} minDuration={2500} />;
  }

  // Fallback loading state while navigating
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
    </div>
  );
};

export default Index;
