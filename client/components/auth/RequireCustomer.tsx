import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";

/**
 * RequireCustomer guards customer dashboard routes.
 * Ensures only customer-role users can access /dashboard/*
 * Admins are redirected to /admin instead.
 */
const RequireCustomer = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isHydrated, user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const location = useLocation();

  if (!isHydrated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading dashboard...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Check if user is admin (use profile role with fallback to JWT role)
  const userRole = profile?.role || user?.role;
  if (userRole === "admin") {
    // Admins should use /admin instead
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};

export default RequireCustomer;
