import { Navigate, useLocation, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLogo } from "@/contexts/LogoContext";
import { fetchUserRoleForRedirect } from "@/lib/postLoginRoleCheck";
import Seo from "@/components/seo/Seo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AuthTabs from "@/components/auth/AuthTabs";
import LogoBranding from "@/components/branding/LogoBranding";
import { ChevronLeft, Lock } from "lucide-react";

type LocationState = {
  from?: string;
};

const AdminLogin = () => {
  const { isAuthenticated, user } = useAuth();
  const { logoStyle } = useLogo();
  const location = useLocation();
  const { from } = (location.state as LocationState) ?? {};
  const [canonicalRoleResolved, setCanonicalRoleResolved] = useState(false);
  const [canonicalRole, setCanonicalRole] = useState<string | null>(null);

  // If already authenticated, check canonical role from database for routing
  useEffect(() => {
    if (isAuthenticated && user && !canonicalRoleResolved) {
      console.log("[AdminLogin] User authenticated, resolving canonical role for redirect");
      fetchUserRoleForRedirect(user.id).then((role) => {
        setCanonicalRole(role);
        setCanonicalRoleResolved(true);
      });
    }
  }, [isAuthenticated, user, canonicalRoleResolved]);

  // If already authenticated
  if (isAuthenticated && canonicalRoleResolved) {
    // Check canonical role from database (not JWT metadata)
    if (canonicalRole === "admin") {
      console.log("[AdminLogin] User is admin, redirecting to /admin");
      return <Navigate to={from ?? "/admin"} replace />;
    }
    // If user is not admin, redirect to customer dashboard (not authorized for admin panel)
    console.log("[AdminLogin] User is not admin, redirecting to /dashboard");
    return <Navigate to="/dashboard" replace />;
  }

  // Still resolving role
  if (isAuthenticated && !canonicalRoleResolved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-sm text-muted-foreground">Checking authorization…</span>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100dvh-80px)] w-full overflow-hidden bg-background">
      <Seo
        title="Admin Portal | No More Mosquitoes"
        description="Owner and manager portal for business administration."
        canonicalUrl="https://nomoremosquitoes.us/admin/login"
      />
      
      {/* Mesh/Gradient background elements */}
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
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-6">
              <Lock className="h-8 w-8" />
            </div>
            <Link to="/">
              <LogoBranding 
                style={logoStyle} 
                className="mb-6"
                iconClassName="h-16 w-16"
                textClassName="text-2xl"
              />
            </Link>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
              Admin Portal
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Business management and operational dashboard
            </p>
          </div>

          <Card className="border-border/60 bg-card/80 shadow-xl backdrop-blur-sm sm:rounded-[24px]">
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-xl font-semibold tracking-tight">
                Admin & Owner Access
              </CardTitle>
              <CardDescription>
                Sign in with your admin credentials to manage the business
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AuthTabs defaultMode="login" />
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-xs font-semibold text-primary mb-2">ADMIN FEATURES</p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex gap-2">
                  <span>✓</span>
                  <span>Customer and employee management</span>
                </li>
                <li className="flex gap-2">
                  <span>✓</span>
                  <span>Revenue tracking and billing</span>
                </li>
                <li className="flex gap-2">
                  <span>✓</span>
                  <span>Route optimization and scheduling</span>
                </li>
                <li className="flex gap-2">
                  <span>✓</span>
                  <span>Performance analytics and reports</span>
                </li>
              </ul>
            </div>

            <p className="px-8 text-center text-xs text-muted-foreground">
              Need customer portal access instead?{" "}
              <Link to="/login" className="underline underline-offset-4 hover:text-primary font-semibold">
                Visit customer portal
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
