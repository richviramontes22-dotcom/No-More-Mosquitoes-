import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "@/hooks/use-translation";
import {
  LayoutDashboard,
  Calendar,
  CreditCard,
  Home,
  MessageSquare,
  LifeBuoy,
  Video,
  UserCircle,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";

const DashboardLayout = () => {
  const { t } = useTranslation();
  const location = useLocation();

  const nav = [
    { label: t("dashboard.navOverview"), to: "/dashboard", icon: LayoutDashboard },
    { label: t("dashboard.navAppointments"), to: "/dashboard/appointments", icon: Calendar },
    { label: t("dashboard.navBilling"), to: "/dashboard/billing", icon: CreditCard },
    { label: t("dashboard.navProperties"), to: "/dashboard/properties", icon: Home },
    { label: t("dashboard.navMessages"), to: "/dashboard/messages", icon: MessageSquare },
    { label: t("dashboard.navSupport"), to: "/dashboard/support", icon: LifeBuoy },
    { label: t("dashboard.navVideos"), to: "/dashboard/videos", icon: Video },
    { label: t("dashboard.navProfile"), to: "/dashboard/profile", icon: UserCircle },
  ];

  return (
    <section className="bg-background min-h-screen">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[280px_1fr] lg:px-8">
        <aside className="space-y-6">
          <div className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm">
            <div className="mb-4 px-3 py-2">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
                Customer Portal
              </h2>
            </div>
            <nav className="grid gap-1 text-sm font-semibold text-muted-foreground" aria-label="Customer dashboard">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/dashboard"}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-brand translate-x-1"
                        : "hover:bg-muted/50 hover:text-foreground"
                    }`
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="px-4">
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
              <NavLink to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Public Site
              </NavLink>
            </Button>
          </div>
        </aside>
        <main id="dashboard-content" className="min-h-[70vh]">
          <Outlet />
        </main>
      </div>
    </section>
  );
};

export default DashboardLayout;
