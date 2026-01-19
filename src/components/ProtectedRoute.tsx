import { ReactNode } from "react";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: AppRole | AppRole[];
  redirectTo?: string;
}

const ProtectedRoute = ({ children, requiredRole, redirectTo = "/auth" }: ProtectedRouteProps) => {
  const { loading, initialized, user, isAuthorized } = useAuth({
    requiredRole,
    redirectTo,
  });

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

  // If role required but not authorized
  if (requiredRole && !isAuthorized) {
    return null; // Will redirect via useAuth
  }

  return <>{children}</>;
};

export default ProtectedRoute;
