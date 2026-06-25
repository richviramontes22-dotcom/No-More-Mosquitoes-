import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/hooks/use-translation";
import Seo from "@/components/seo/Seo";
import { Card, CardContent } from "@/components/ui/card";
import AuthTabs from "@/components/auth/AuthTabs";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchUserRoleForRedirect } from "@/lib/postLoginRoleCheck";
import { loadPendingOnboarding, hasPendingOnboarding } from "@/lib/pendingOnboarding";
import { DevQuickLogin } from "@/components/dev/DevQuickLogin";

type LocationState = {
  from?: string;
  mode?: "login" | "signup";
  preset?: any;
};

const Login = () => {
  const { isAuthenticated, user } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { from, mode, preset: locationPreset } = (location.state as LocationState) ?? {};

  // Merge location.state preset with any pending onboarding from sessionStorage.
  const pending = loadPendingOnboarding();
  const preset = locationPreset ?? (pending
    ? {
        serviceAddress: pending.address,
        city:           pending.city,
        state:          pending.state,
        zipCode:        pending.zip,
        cadenceDays:    pending.cadenceDays,
        program:        pending.program,
      }
    : undefined);

  const [roleResolved, setRoleResolved] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user && !roleResolved) {
      fetchUserRoleForRedirect(user.id).then(({ role, isOnboarded }) => {
        setRoleResolved(true);

        // Admin/support always go to their own panel
        if (role === "admin" || role === "support") {
          navigate(role === "admin" ? "/admin" : "/dashboard", { replace: true });
          return;
        }

        // Employees (any portal role) always go to the employee portal
        if (role === "employee" || role === "technician" || role === "dispatcher" || role === "customer_service" || role === "sales") {
          navigate("/employee", { replace: true });
          return;
        }

        // Path A: quote data is waiting — send customer to onboarding with preset
        if (hasPendingOnboarding()) {
          navigate("/onboarding", { replace: true });
          return;
        }

        // Path B: direct signup, first time — send customer to onboarding (blank)
        if (!isOnboarded) {
          navigate("/onboarding", { replace: true });
          return;
        }

        // Returning authenticated customer — respect the original `from` target or go to dashboard
        const target = from ?? "/dashboard";
        if (target === "/schedule" && preset) {
          navigate(target, { state: { preset }, replace: true });
        } else {
          navigate(target, { replace: true });
        }
      });
    }
  }, [isAuthenticated, user, from, preset, navigate, roleResolved]);

  if (isAuthenticated && !roleResolved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
          Redirecting…
        </span>
      </div>
    );
  }

  if (isAuthenticated && roleResolved) {
    return null;
  }

  return (
    <div className="relative min-h-[calc(100dvh-80px)] w-full overflow-hidden bg-background">
      <Seo
        title={t("auth.customerPortal")}
        description={t("auth.portalDesc")}
        canonicalUrl="https://nomoremosquitoes.us/login"
      />

      <div className="absolute inset-0 -z-10 bg-mesh-overlay opacity-20" aria-hidden="true" />
      <div className="absolute left-1/2 top-1/3 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/4 blur-[140px]" aria-hidden="true" />

      <div className="container relative flex min-h-[calc(100dvh-80px)] flex-col items-center justify-center px-4 py-10 sm:py-12">

        <div className="absolute left-4 top-6 sm:left-6 sm:top-8">
          <Link
            to="/"
            className="group inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
            aria-label="Back to No More Mosquitoes website"
          >
            <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
            Back to site
          </Link>
        </div>

        <div className="w-full max-w-[420px] space-y-6">

          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary mb-2" aria-hidden="true">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Customer Portal
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage your service, view visit videos, and update billing.
            </p>
          </div>

          <Card className="border-border/60 bg-card/90 shadow-2xl backdrop-blur-sm rounded-[20px] sm:rounded-[24px]">
            <CardContent className="px-6 pt-6 pb-6 sm:px-8 sm:pt-7 sm:pb-7">
              <AuthTabs
                defaultMode={mode ?? "login"}
                defaultEmail={preset?.email}
                defaultName={preset?.fullName}
              />
            </CardContent>
          </Card>

          <div className="text-center text-xs text-muted-foreground space-y-1.5">
            <p>
              Need help?{" "}
              <Link
                to="/contact"
                className="font-medium text-foreground/70 underline underline-offset-4 hover:text-primary transition-colors"
              >
                Contact support
              </Link>
            </p>
          </div>

          <DevQuickLogin />
        </div>
      </div>
    </div>
  );
};

export default Login;
