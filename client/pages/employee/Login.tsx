import { Navigate, useLocation } from "react-router-dom";
import SectionHeading from "@/components/common/SectionHeading";
import { PageHero } from "@/components/page";
import Seo from "@/components/seo/Seo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AuthTabs from "@/components/auth/AuthTabs";
import { useAuth } from "@/contexts/AuthContext";

type LocationState = { from?: string };

const EmployeeLogin = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const { from } = (location.state as LocationState) ?? {};

  if (isAuthenticated) {
    return <Navigate to={from ?? "/employee"} replace />;
  }

  return (
    <div className="flex flex-col gap-0">
      <Seo title="Employee Login" description="Technician & dispatcher portal access." canonicalUrl="https://nomoremosquitoes.us/employee/login" />
      <PageHero
        variant="centered"
        title="Employee portal"
        description="Log in to access your route, assignments, time clock, and messaging."
        primaryCta={{ label: "View Employee Dashboard", href: "/employee" }}
      />
      <section className="bg-background py-24">
        <div className="mx-auto grid w/full max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft">
            <CardHeader>
              <CardTitle className="font-display text-3xl">Sign in to Employee Portal</CardTitle>
              <CardDescription>Use the same credentials as your customer/admin account.</CardDescription>
            </CardHeader>
            <CardContent>
              <AuthTabs />
            </CardContent>
          </Card>
          <div className="space-y-10">
            <div className="rounded-[32px] border border-border/60 bg-muted/40 p-10 shadow-soft">
              <SectionHeading eyebrow="What’s inside" title="Routes, time clock, and messaging" description="Everything you need for today’s jobs." />
              <ul className="mt-8 space-y-4 text-sm text-muted-foreground">
                <li>• Clock in/out with geotag and see your timesheet.</li>
                <li>• Navigate to assignments and send customer messages.</li>
                <li>• Upload photos and complete checklists on site.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default EmployeeLogin;
