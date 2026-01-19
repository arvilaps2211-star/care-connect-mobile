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
}

interface UseAuthOptions {
  requiredRole?: AppRole | AppRole[];
  redirectTo?: string;
}

export const useAuth = (options: UseAuthOptions = {}) => {
  const { requiredRole, redirectTo = "/auth" } = options;
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    role: null,
    loading: true,
    initialized: false,
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  const checkRole = useCallback(async (userId: string): Promise<AppRole | null> => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (error || !data) {
        // Default to 'user' role if no role found
        return "user";
      }

      return data.role as AppRole;
    } catch (error) {
      console.error("[Auth] Error checking role:", error);
      return "user";
    }
  }, []);

  const validateAccess = useCallback((role: AppRole | null): boolean => {
    if (!requiredRole) return true;
    if (!role) return false;

    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    return allowedRoles.includes(role);
  }, [requiredRole]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setState(prev => ({
          ...prev,
          session,
          user: session?.user ?? null,
        }));

        // Defer role check with setTimeout to avoid Supabase deadlock
        if (session?.user) {
          setTimeout(() => {
            checkRole(session.user.id).then(role => {
              setState(prev => ({
                ...prev,
                role,
                loading: false,
                initialized: true,
              }));
            });
          }, 0);
        } else {
          setState(prev => ({
            ...prev,
            role: null,
            loading: false,
            initialized: true,
          }));
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState(prev => ({
        ...prev,
        session,
        user: session?.user ?? null,
      }));

      if (session?.user) {
        checkRole(session.user.id).then(role => {
          setState(prev => ({
            ...prev,
            role,
            loading: false,
            initialized: true,
          }));
        });
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          initialized: true,
        }));
      }
    });

    return () => subscription.unsubscribe();
  }, [checkRole]);

  // Handle access control after state is initialized
  useEffect(() => {
    if (!state.initialized || state.loading) return;

    // No user - redirect to auth
    if (!state.user && requiredRole) {
      navigate(redirectTo);
      return;
    }

    // User exists but wrong role
    if (state.user && requiredRole && !validateAccess(state.role)) {
      toast({
        title: "Unauthorized Access",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
      navigate(redirectTo);
    }
  }, [state.initialized, state.loading, state.user, state.role, requiredRole, validateAccess, navigate, toast, redirectTo]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  }, [navigate]);

  return {
    ...state,
    signOut,
    isAuthorized: validateAccess(state.role),
  };
};
