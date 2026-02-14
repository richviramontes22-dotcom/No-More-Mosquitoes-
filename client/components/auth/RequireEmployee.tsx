import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const EMPLOYEE_ROLES = new Set(["admin", "support", "technician"] as const);

const RequireEmployee = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, user, isHydrated } = useAuth();
  const location = useLocation();

  if (!isHydrated) return null;
  if (!isAuthenticated) {
    return <Navigate to="/employee/login" state={{ from: location.pathname }} replace />;
  }
  if (!user || !EMPLOYEE_ROLES.has(user.role as any)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

export default RequireEmployee;
