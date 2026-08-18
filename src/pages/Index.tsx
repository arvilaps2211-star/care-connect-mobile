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
    try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      setTargetRoute("/auth");
      setAuthCheckComplete(true);
      return;
    }

    // Check user role (an account can have multiple rows — never use .single())
    let { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    // Self-heal: accounts created before role bootstrapping have no row
    if (!roleRows || roleRows.length === 0) {
      await supabase.rpc("ensure_default_role");
      const retry = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      roleRows = retry.data ?? [];
    }

    const roles = (roleRows ?? []).map((r: any) => r.role as string);

    if (roles.length > 0) {
      if (roles.includes("admin")) {
        setTargetRoute("/admin");
        setAuthCheckComplete(true);
        return;
      } else if (roles.includes("hospital")) {
        setTargetRoute("/hospital");
        setAuthCheckComplete(true);
        return;
      }
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (profile?.onboarding_completed) {
      setTargetRoute("/dashboard");
    } else {
      setTargetRoute("/onboarding");
    }
    setAuthCheckComplete(true);
    } catch (e) {
      // Never leave the splash hanging on a network/database hiccup
      console.warn("[Index] Auth check failed, falling back to /auth", e);
      setTargetRoute("/auth");
      setAuthCheckComplete(true);
    }
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
