import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";

// Roles allowed to access the employee portal. customer_service and sales
// never do field/route work (no employees table row), but still log in
// through this same portal — EmployeeLayout/Dashboard branch on role to
// show them ticket/CRM tools instead of route/assignment tools.
const EMPLOYEE_ROLES = new Set(["admin", "support", "technician", "employee", "customer_service", "sales"] as const);

const RequireEmployee = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, user, isHydrated } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const location = useLocation();
  const [hasCheckedRole, setHasCheckedRole] = useState(false);

  // Same canonical-role pattern as RequireAdmin.tsx — read profiles.role
  // from the database, not just the (possibly stale) JWT/user_metadata
  // role, so a role change made directly in Supabase takes effect on the
  // next page load without requiring the user to re-authenticate.
  useEffect(() => {
    if (!isHydrated || !isAuthenticated) return;
    if (profileLoading) {
      const timeoutId = setTimeout(() => setHasCheckedRole(true), 3000);
      return () => clearTimeout(timeoutId);
    }
    setHasCheckedRole(true);
  }, [isHydrated, isAuthenticated, profileLoading]);

  if (!isHydrated || (isAuthenticated && !hasCheckedRole)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading employee portal…</span>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/employee/login" state={{ from: location.pathname }} replace />;
  }

  const canonicalRole = profile?.role || user?.role;
  if (!user || !EMPLOYEE_ROLES.has(canonicalRole as any)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

export default RequireEmployee;
