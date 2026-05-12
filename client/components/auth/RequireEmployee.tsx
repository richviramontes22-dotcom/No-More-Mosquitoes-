import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

// Roles allowed to access the employee portal.
// Technicians should have their profile role set to "admin" or "support" by an admin
// until a dedicated "employee" role is added to the profiles CHECK constraint.
const EMPLOYEE_ROLES = new Set(["admin", "support", "technician", "employee"] as const);

const RequireEmployee = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, user, isHydrated } = useAuth();
  const location = useLocation();

  if (!isHydrated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading employee portal…</span>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/employee/login" state={{ from: location.pathname }} replace />;
  }
  if (!user || !EMPLOYEE_ROLES.has(user.role as any)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

export default RequireEmployee;
