import { Navigate, useLocation, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/hooks/use-translation";
import Seo from "@/components/seo/Seo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AuthTabs from "@/components/auth/AuthTabs";
import { ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchUserRoleForRedirect } from "@/lib/postLoginRoleCheck";

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
  const { from, mode, preset } = (location.state as LocationState) ?? {};
  const [roleResolved, setRoleResolved] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user && !roleResolved) {
      // Resolve the canonical role from profile and redirect accordingly
      console.log("[Login] User authenticated, resolving role for redirect");

      fetchUserRoleForRedirect(user.id).then((role) => {
        setRoleResolved(true);

        // Determine redirect target based on role and preset
        let target = from ?? (role === "admin" ? "/admin" : "/dashboard");

        // If we have a preset and we are going to /schedule, ensure the preset is passed along
        if (target === "/schedule" && preset) {
          navigate(target, { state: { preset }, replace: true });
        } else {
          console.log("[Login] Redirecting to:", target, "with role:", role);
          navigate(target, { replace: true });
        }
      });
    }
  }, [isAuthenticated, user, from, preset, navigate, roleResolved]);

  if (isAuthenticated && !roleResolved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-sm text-muted-foreground">Redirecting…</span>
      </div>
    );
  }

  if (isAuthenticated && roleResolved) {
    return null; // Navigation is handled in useEffect
  }

  return (
    <div className="relative min-h-[calc(100dvh-80px)] w-full overflow-hidden bg-background">
      <Seo
        title={t("auth.customerPortal")}
        description={t("auth.portalDesc")}
        canonicalUrl="https://nomoremosquitoes.us/login"
      />
      
      {/* Mesh/Gradient background elements for depth */}
      <div className="absolute inset-0 -z-10 bg-mesh-overlay opacity-30" aria-hidden="true" />
      <div className="absolute left-1/2 top-1/2 -z-10 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[120px]" aria-hidden="true" />

      <div className="container relative flex min-h-[calc(100dvh-80px)] flex-col items-center justify-center py-12">
        <div className="absolute left-4 top-8 sm:left-8">
          <Link 
            to="/" 
            className="group flex items-center gap-1 text-sm font-semibold text-muted-foreground transition hover:text-primary"
          >
            <ChevronLeft className="h-4 w-4 transition group-hover:-translate-x-1" />
            Back to site
          </Link>
        </div>

        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center text-center">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
              {t("auth.customerPortal")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("auth.portalDesc")}
            </p>
          </div>

          <Card className="border-border/60 bg-card/80 shadow-xl backdrop-blur-sm sm:rounded-[24px]">
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-xl font-semibold tracking-tight">
                {t("auth.manageService")}
              </CardTitle>
              <CardDescription>
                {t("auth.signInDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AuthTabs
                defaultMode={mode || "login"}
                defaultEmail={preset?.email}
                defaultName={preset?.fullName}
              />
            </CardContent>
          </Card>

          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground px-8 text-center">
            <Link to="/forgot-password" className="underline underline-offset-4 hover:text-primary">
              Forgot your password?
            </Link>
            <p>
              {t("auth.newToPortal")}{" "}
              <Link to="/contact" className="underline underline-offset-4 hover:text-primary">
                Contact support
              </Link>{" "}
              for help with your account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
