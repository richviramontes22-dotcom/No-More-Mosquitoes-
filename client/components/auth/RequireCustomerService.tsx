import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";

const ALLOWED_ROLES = new Set(["admin", "customer_service"]);

/**
 * Mirrors RequireAdmin.tsx exactly, but allows 'customer_service' in
 * addition to 'admin'. Admin always retains access (oversight); a
 * customer_service profile can use this guard but can never pass
 * RequireAdmin, so it can never reach admin-only routes.
 */
const RequireCustomerService = ({ children }: { children: ReactNode }) => {
  const { user, isHydrated } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const location = useLocation();
  const [hasCheckedRole, setHasCheckedRole] = useState(false);

  useEffect(() => {
    if (!isHydrated || !user) return;
    if (profileLoading) {
      const timeoutId = setTimeout(() => setHasCheckedRole(true), 3000);
      return () => clearTimeout(timeoutId);
    }
    setHasCheckedRole(true);
  }, [isHydrated, user, profileLoading]);

  if (!isHydrated || !hasCheckedRole) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading…</span>
      </div>
    );
  }

  const userRole = profile?.role || user?.role;
  if (!user || !ALLOWED_ROLES.has(userRole as string)) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
};

export default RequireCustomerService;
