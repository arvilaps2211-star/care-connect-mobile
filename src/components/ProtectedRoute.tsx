import { ReactNode, useEffect } from "react";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { Loader2, AlertTriangle } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: AppRole | AppRole[];
  redirectTo?: string;
}

// WEB DEV MODE: Allow bypass with warning instead of blocking
const isWebDevMode = import.meta.env.DEV;

const ProtectedRoute = ({ children, requiredRole, redirectTo = "/auth" }: ProtectedRouteProps) => {
  const { loading, initialized, user, role, roleError, isAuthorized } = useAuth({
    requiredRole,
    redirectTo,
  });

  // In web dev mode, log role issues
  useEffect(() => {
    if (isWebDevMode && initialized && !loading && user && requiredRole && !isAuthorized) {
      console.warn(`[PROTECTED] DEV MODE: User "${user.email}" has role "${role}" but route requires "${requiredRole}".`);
      if (roleError) {
        console.warn(`[PROTECTED] Role fetch error: ${roleError}`);
      }
    }
  }, [initialized, loading, user, role, roleError, requiredRole, isAuthorized]);

  // Show loading spinner while checking auth
  if (!initialized || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-slate-400">Verifying access...</p>
          {isWebDevMode && (
            <p className="text-slate-500 text-xs">Role: {role || "loading..."}</p>
          )}
        </div>
      </div>
    );
  }

  // If no required role, just check if user is logged in
  if (!requiredRole && !user) {
    console.log("[PROTECTED] No user and role required, will redirect");
    return null; // Will redirect via useAuth
  }

  // DEV MODE BYPASS: Allow access with warning banner
  if (isWebDevMode && user && requiredRole && !isAuthorized) {
    return (
      <div className="min-h-screen">
        {/* Dev mode warning banner */}
        <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 sticky top-0 z-50">
          <div className="flex items-center gap-2 max-w-7xl mx-auto">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="text-amber-300 text-sm">
              <strong>DEV MODE:</strong> Role mismatch - User "{user.email}" has "{role || 'none'}" but route requires "{String(requiredRole)}". 
              {roleError && ` (Error: ${roleError})`}
            </span>
          </div>
        </div>
        {children}
      </div>
    );
  }

  // If role required but not authorized (production mode)
  if (requiredRole && !isAuthorized) {
    console.log("[PROTECTED] Not authorized, will redirect");
    return null; // Will redirect via useAuth
  }

  return <>{children}</>;
};

export default ProtectedRoute;
