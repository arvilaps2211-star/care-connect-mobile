import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User, Session } from "@supabase/supabase-js";

export type AppRole = "admin" | "hospital" | "ambulance" | "user";

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  initialized: boolean;
  roleError: string | null;
}

interface UseAuthOptions {
  requiredRole?: AppRole | AppRole[];
  redirectTo?: string;
}

// WEB DEV MODE detection
const isWebDevMode = import.meta.env.DEV;

export const useAuth = (options: UseAuthOptions = {}) => {
  const { requiredRole, redirectTo = "/auth" } = options;
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    role: null,
    loading: true,
    initialized: false,
    roleError: null,
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  const checkRole = useCallback(async (userId: string): Promise<{ role: AppRole | null; error: string | null }> => {
    const priority: AppRole[] = ["admin", "hospital", "ambulance", "user"];
    const pick = (rows: { role: string }[] | null): AppRole | null => {
      const roles = (rows ?? []).map((r) => r.role as AppRole);
      return priority.find((p) => roles.includes(p)) ?? null;
    };

    try {
      console.log("[AUTH] Checking role for user:", userId);
      
      // An account can legitimately have multiple role rows — never use .single()
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error) {
        console.warn("[ROLE] Error fetching role:", error.message);
        return { role: "user", error: error.message };
      }

      let resolved = pick(data);

      if (!resolved) {
        // Self-heal accounts that were created without a role row
        console.log("[ROLE] No role found, bootstrapping default role");
        await supabase.rpc("ensure_default_role");
        const retry = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);
        resolved = pick(retry.data) ?? "user";
      }

      console.log("[ROLE] Resolved role:", resolved);
      return { role: resolved, error: null };
    } catch (error: any) {
      console.error("[AUTH] Exception checking role:", error);
      return { role: "user", error: error.message };
    }
  }, []);

  const validateAccess = useCallback((role: AppRole | null): boolean => {
    if (!requiredRole) return true;
    if (!role) return false;

    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    return allowedRoles.includes(role);
  }, [requiredRole]);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      console.log("[AUTH] Initializing auth state...");
      
      // Get current session first
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.warn("[AUTH] Session error:", sessionError.message);
      }

      if (!isMounted) return;

      if (session?.user) {
        console.log("[AUTH] Found existing session for:", session.user.email);
        
        setState(prev => ({
          ...prev,
          session,
          user: session.user,
        }));

        const { role, error: roleError } = await checkRole(session.user.id);
        
        if (!isMounted) return;
        
        setState(prev => ({
          ...prev,
          role,
          roleError,
          loading: false,
          initialized: true,
        }));
      } else {
        console.log("[AUTH] No session found");
        setState(prev => ({
          ...prev,
          loading: false,
          initialized: true,
        }));
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("[AUTH] Auth state changed:", event, session?.user?.email || "no user");
        
        if (!isMounted) return;

        setState(prev => ({
          ...prev,
          session,
          user: session?.user ?? null,
        }));

        if (session?.user) {
          // Defer role check to avoid Supabase deadlock
          setTimeout(async () => {
            if (!isMounted) return;
            
            const { role, error: roleError } = await checkRole(session.user.id);
            
            if (!isMounted) return;
            
            setState(prev => ({
              ...prev,
              role,
              roleError,
              loading: false,
              initialized: true,
            }));
          }, 0);
        } else {
          setState(prev => ({
            ...prev,
            role: null,
            roleError: null,
            loading: false,
            initialized: true,
          }));
        }
      }
    );

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [checkRole]);

  // Handle access control after state is initialized
  useEffect(() => {
    if (!state.initialized || state.loading) return;

    // No user - redirect to auth (only in production or if explicitly required)
    if (!state.user && requiredRole) {
      console.log("[AUTH] No user, redirecting to:", redirectTo);
      navigate(redirectTo);
      return;
    }

    // User exists but wrong role - handle based on mode
    if (state.user && requiredRole && !validateAccess(state.role)) {
      if (isWebDevMode) {
        // In dev mode, just log warning - ProtectedRoute will show banner
        console.warn(`[AUTH] DEV MODE: Role mismatch - has "${state.role}", needs "${requiredRole}"`);
      } else {
        // Production: redirect
        console.log("[AUTH] Role mismatch, redirecting to:", redirectTo);
        toast({
          title: "Unauthorized Access",
          description: "You don't have permission to access this page.",
          variant: "destructive",
        });
        navigate(redirectTo);
      }
    }
  }, [state.initialized, state.loading, state.user, state.role, requiredRole, validateAccess, navigate, toast, redirectTo]);

  const signOut = useCallback(async () => {
    console.log("[AUTH] Signing out...");
    await supabase.auth.signOut();
    navigate("/auth");
  }, [navigate]);

  return {
    ...state,
    signOut,
    isAuthorized: validateAccess(state.role),
  };
};
