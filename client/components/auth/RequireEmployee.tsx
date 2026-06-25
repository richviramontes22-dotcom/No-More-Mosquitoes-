import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { cacheEmployeeRole, getCachedEmployeeRole } from "@/lib/employee/offlineCache";

// Roles allowed to access the employee portal. customer_service and sales
// never do field/route work (no employees table row), but still log in
// through this same portal — EmployeeLayout/Dashboard branch on role to
// show them ticket/CRM tools instead of route/assignment tools.
export const EMPLOYEE_ROLES = new Set(["admin", "support", "technician", "dispatcher", "employee", "customer_service", "sales"] as const);

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

  let canonicalRole = profile?.role || user?.role;

  // Offline fallback: a live profile fetch fails with no network, leaving
  // only the JWT's role claim — which can be stale if an employee's role
  // was ever changed after their last full sign-in (the JWT isn't
  // refreshed automatically). When genuinely offline and neither live
  // source qualifies, fall back to the last role this guard itself
  // confirmed while online, rather than incorrectly routing a real
  // technician away from the portal just because they have no signal.
  // Never consulted while online — the live data path is always
  // authoritative then.
  if (!EMPLOYEE_ROLES.has(canonicalRole as any) && !navigator.onLine && user?.id) {
    const cached = getCachedEmployeeRole(user.id);
    if (cached && EMPLOYEE_ROLES.has(cached.data as any)) {
      canonicalRole = cached.data as typeof canonicalRole;
    }
  }

  if (!user || !EMPLOYEE_ROLES.has(canonicalRole as any)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (user.id && profile?.role && EMPLOYEE_ROLES.has(profile.role as any)) {
    cacheEmployeeRole(user.id, profile.role);
  }

  return <>{children}</>;
};

export default RequireEmployee;
