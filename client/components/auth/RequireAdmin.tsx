import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";

const RequireAdmin = ({ children }: { children: ReactNode }) => {
  const { user, isHydrated } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const location = useLocation();
  const [hasCheckedRole, setHasCheckedRole] = useState(false);

  // Ensure we've waited for profile role check (with timeout)
  useEffect(() => {
    if (!isHydrated || !user) {
      return;
    }

    // If profile is loading, wait a bit
    if (profileLoading) {
      const timeoutId = setTimeout(() => {
        console.log("[RequireAdmin] Profile check timed out, proceeding with current state");
        setHasCheckedRole(true);
      }, 3000);

      return () => clearTimeout(timeoutId);
    }

    // Profile has loaded (or failed), proceed with check
    setHasCheckedRole(true);
  }, [isHydrated, user, profileLoading]);

  if (!isHydrated || !hasCheckedRole) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading admin…</span>
      </div>
    );
  }

  // Check canonical role from profile, with fallback to JWT role
  const userRole = profile?.role || user?.role;
  if (!user || userRole !== "admin") {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
};

export default RequireAdmin;
