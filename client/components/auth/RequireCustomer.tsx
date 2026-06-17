import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { fetchLegalStatus, fetchMyAcceptances, diffRequiredAgainstAccepted } from "@/lib/legalGate";

/**
 * RequireCustomer guards customer dashboard routes.
 * Ensures only customer-role users can access /dashboard/*
 * Admins are redirected to /admin instead.
 */
const RequireCustomer = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isHydrated, user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const location = useLocation();

  // Legal acceptance gate — a no-op (needsAcceptance stays false) whenever
  // enforcement is disabled, which is the default. See client/lib/legalGate.ts
  // and client/pages/LegalAcceptance.tsx for the full mechanism.
  const [legalChecked, setLegalChecked] = useState(false);
  const [needsLegalAcceptance, setNeedsLegalAcceptance] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { setLegalChecked(true); return; }
    let cancelled = false;
    (async () => {
      const status = await fetchLegalStatus();
      if (!status.enforcement_enabled || status.required.length === 0) {
        if (!cancelled) { setNeedsLegalAcceptance(false); setLegalChecked(true); }
        return;
      }
      const accepted = await fetchMyAcceptances();
      const missing = diffRequiredAgainstAccepted(status.required, accepted);
      if (!cancelled) { setNeedsLegalAcceptance(missing.length > 0); setLegalChecked(true); }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  if (!isHydrated || !legalChecked) {
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
    return <Navigate to="/admin" replace />;
  }

  if (needsLegalAcceptance) {
    return <Navigate to="/legal-acceptance" state={{ from: location.pathname }} replace />;
  }

  // Non-onboarded customers haven't completed setup — send them there.
  // Wait for profile to load before evaluating (is_onboarded may not be set yet).
  if (!profileLoading && profile?.is_onboarded === false) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

export default RequireCustomer;
