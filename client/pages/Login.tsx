import { Navigate, useLocation, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/hooks/use-translation";
import { useLogo } from "@/contexts/LogoContext";
import Seo from "@/components/seo/Seo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AuthTabs from "@/components/auth/AuthTabs";
import LogoBranding from "@/components/branding/LogoBranding";
import { ChevronLeft } from "lucide-react";
import { useEffect } from "react";

type LocationState = {
  from?: string;
  mode?: "login" | "signup";
  preset?: any;
};

const Login = () => {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const { logoStyle } = useLogo();
  const location = useLocation();
  const navigate = useNavigate();
  const { from, mode, preset } = (location.state as LocationState) ?? {};

  useEffect(() => {
    if (isAuthenticated) {
      // If we have a preset and we are going to /schedule, ensure the preset is passed along
      const target = from ?? "/dashboard";
      if (target === "/schedule" && preset) {
        navigate(target, { state: { preset }, replace: true });
      } else {
        navigate(target, { replace: true });
      }
    }
  }, [isAuthenticated, from, preset, navigate]);

  if (isAuthenticated) {
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
            <Link to="/">
              <LogoBranding 
                style={logoStyle} 
                className="mb-6"
                iconClassName="h-16 w-16"
                textClassName="text-2xl"
              />
            </Link>
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

          <p className="px-8 text-center text-sm text-muted-foreground">
            {t("auth.newToPortal")}{" "}
            <Link to="/contact" className="underline underline-offset-4 hover:text-primary">
              Contact support
            </Link>{" "}
            for help with your account.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
