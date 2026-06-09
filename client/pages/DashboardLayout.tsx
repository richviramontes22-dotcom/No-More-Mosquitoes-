import { NavLink, Outlet, useLocation, Navigate } from "react-router-dom";
import { useTranslation } from "@/hooks/use-translation";
import {
  LayoutDashboard,
  Calendar,
  CreditCard,
  Home,
  LifeBuoy,
  UserCircle,
  ArrowLeft,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useSubscriptions } from "@/hooks/dashboard/useSubscriptions";
import OnboardingProgressWidget from "@/components/dashboard/OnboardingProgressWidget";
import { cn } from "@/lib/utils";

const PAID_ONLY_ROUTES = [
  "/dashboard/appointments",
  "/dashboard/billing",
  "/dashboard/properties",
  "/dashboard/marketplace",
  "/dashboard/orders",
  "/dashboard/messages",
  "/dashboard/support",
  "/dashboard/videos",
  "/dashboard/help",
];

const DashboardLayout = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();

  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: subscriptions = [], isLoading: subsLoading } = useSubscriptions(user?.id);

  const hasActiveSubscription = subscriptions.some((s) => s.status === "active");
  const isPreCustomer = !profileLoading && !subsLoading && !hasActiveSubscription;

  const isSettled = !profileLoading && !subsLoading;
  const onRestrictedRoute = PAID_ONLY_ROUTES.some((r) =>
    location.pathname.startsWith(r)
  );
  if (isSettled && isPreCustomer && onRestrictedRoute) {
    return <Navigate to="/dashboard/profile" replace />;
  }

  // Grouped navigation sections
  type NavItem = { label: string; to: string; icon: React.ElementType };
  type NavSection = { label: string; items: NavItem[] };

  const fullSections: NavSection[] = [
    {
      label: "Service",
      items: [
        { label: t("dashboard.navOverview"),     to: "/dashboard",               icon: LayoutDashboard },
        { label: t("dashboard.navAppointments"), to: "/dashboard/appointments",  icon: Calendar       },
        { label: t("dashboard.navProperties"),   to: "/dashboard/properties",    icon: Home           },
      ],
    },
    {
      label: "Account",
      items: [
        { label: t("dashboard.navBilling"),      to: "/dashboard/billing",       icon: CreditCard     },
        { label: t("dashboard.navProfile"),      to: "/dashboard/profile",       icon: UserCircle     },
      ],
    },
    {
      label: "Shop",
      items: [
        { label: "Shop",                         to: "/dashboard/marketplace",   icon: ShoppingBag    },
      ],
    },
    {
      label: "Help",
      items: [
        { label: "Help & Contact",               to: "/dashboard/help",          icon: LifeBuoy       },
      ],
    },
  ];

  // Pre-customers see only Profile
  const sections: NavSection[] = isPreCustomer
    ? [{ label: "Account", items: [{ label: t("dashboard.navProfile"), to: "/dashboard/profile", icon: UserCircle }] }]
    : fullSections;

  return (
    <section className="bg-background min-h-screen">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[280px_1fr] lg:px-8">
        <aside className="space-y-6">
          {isPreCustomer && <OnboardingProgressWidget />}

          <div className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm">
            <div className="mb-3 px-3 py-1.5">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground/60">
                {isPreCustomer ? "Account" : "Customer Portal"}
              </h2>
            </div>

            <nav className="space-y-4" aria-label="Customer dashboard">
              {sections.map((section) => (
                <div key={section.label}>
                  {!isPreCustomer && (
                    <p className="px-3 pb-1 text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground/50">
                      {section.label}
                    </p>
                  )}
                  <div className="grid gap-0.5 text-sm font-semibold text-muted-foreground">
                    {section.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={true}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200",
                            isActive
                              ? "bg-primary text-primary-foreground shadow-brand translate-x-1"
                              : "hover:bg-muted/50 hover:text-foreground"
                          )
                        }
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
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
