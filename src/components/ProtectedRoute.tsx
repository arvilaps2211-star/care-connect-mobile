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
  const { loading, initialized, user, role, isAuthorized } = useAuth({
    requiredRole,
    redirectTo,
  });

  // In web dev mode, if role check fails but user exists, log warning
  useEffect(() => {
    if (isWebDevMode && initialized && !loading && user && requiredRole && !isAuthorized) {
      console.warn(`[ProtectedRoute] DEV MODE: User has role "${role}" but route requires "${requiredRole}". Allowing with warning.`);
    }
  }, [initialized, loading, user, role, requiredRole, isAuthorized]);

  // Show loading spinner while checking auth
  if (!initialized || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-slate-400">Verifying access...</p>
        </div>
      </div>
    );
  }

  // If no required role, just check if user is logged in
  if (!requiredRole && !user) {
    return null; // Will redirect via useAuth
  }

  // DEV MODE BYPASS: Allow access with warning banner
  if (isWebDevMode && user && requiredRole && !isAuthorized) {
    return (
      <div className="min-h-screen">
        {/* Dev mode warning banner */}
        <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2">
          <div className="flex items-center gap-2 max-w-7xl mx-auto">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-amber-300 text-sm">
              <strong>DEV MODE:</strong> Role mismatch - User has "{role}" but route requires "{String(requiredRole)}". 
              Access allowed for debugging.
            </span>
          </div>
        </div>
        {children}
      </div>
    );
  }

  // If role required but not authorized (production mode)
  if (requiredRole && !isAuthorized) {
    return null; // Will redirect via useAuth
  }

  return <>{children}</>;
};

export default ProtectedRoute;
