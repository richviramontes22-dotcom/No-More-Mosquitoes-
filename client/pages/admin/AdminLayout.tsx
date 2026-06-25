import { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/layout/PageTransition";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Activity, Users, Home, Calendar, Truck, MessageSquare,
  Ticket, Map, Navigation, CreditCard, BarChart3, FileText,
  Settings, ShieldCheck, Zap, Globe, Tag, Layers, UserCog, ChevronRight, Bell, Scale, CalendarDays,
  UserPlus, Gift, Smile, Menu,
} from "lucide-react";

type NavItem = { label: string; to: string; icon: React.ElementType };
type NavGroup = { key: string; label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    key: "customers",
    label: "Customers",
    items: [
      { label: "Leads", to: "/admin/leads", icon: UserPlus },
      { label: "Customers", to: "/admin/customers", icon: Users },
      { label: "Properties", to: "/admin/properties", icon: Home },
    ],
  },
  {
    key: "field",
    label: "Field Operations",
    items: [
      { label: "Appointments", to: "/admin/appointments", icon: Calendar },
      { label: "Reschedule Requests", to: "/admin/reschedule-requests", icon: CalendarDays },
      { label: "Route Planning", to: "/admin/route-planning", icon: Navigation },
      { label: "Visits", to: "/admin/visits", icon: Truck },
      { label: "Service Areas", to: "/admin/service-areas", icon: Globe },
    ],
  },
  {
    key: "workforce",
    label: "Workforce",
    items: [
      { label: "Employees", to: "/admin/employees", icon: UserCog },
      { label: "Workforce", to: "/admin/workforce", icon: CalendarDays },
      { label: "Live Tracking", to: "/admin/employee-tracking", icon: Map },
      { label: "Legal & Compliance", to: "/admin/legal-compliance", icon: Scale },
      { label: "Legal Documents", to: "/admin/legal", icon: FileText },
    ],
  },
  {
    key: "support",
    label: "Support",
    items: [
      { label: "Messages", to: "/admin/messages", icon: MessageSquare },
      { label: "Tickets", to: "/admin/tickets", icon: Ticket },
      { label: "Satisfaction", to: "/admin/satisfaction", icon: Smile },
      { label: "Email Management", to: "/admin/email-management", icon: MessageSquare },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    items: [
      { label: "Billing", to: "/admin/billing", icon: CreditCard },
      { label: "Revenue", to: "/admin/revenue", icon: BarChart3 },
      { label: "Pricing & Plans", to: "/admin/pricing", icon: Zap },
      { label: "Promotions", to: "/admin/promos", icon: Tag },
      { label: "Referrals", to: "/admin/referrals", icon: Gift },
    ],
  },
  {
    key: "content",
    label: "Content",
    items: [
      { label: "Website Manager", to: "/admin/website-manager", icon: Layers },
      { label: "Blog & FAQs", to: "/admin/content", icon: FileText },
    ],
  },
  {
    key: "analytics",
    label: "Analytics",
    items: [
      { label: "Reports", to: "/admin/reports", icon: BarChart3 },
      { label: "Analytics", to: "/admin/analytics", icon: BarChart3 },
      { label: "Territory Intelligence", to: "/admin/territory-intelligence", icon: Map },
      { label: "Workforce Optimization", to: "/admin/workforce-optimization", icon: Users },
    ],
  },
  {
    key: "system",
    label: "System",
    items: [
      { label: "Alerts", to: "/admin/alerts", icon: Bell },
      { label: "Notifications Log", to: "/admin/notifications", icon: Bell },
      { label: "Business Hours", to: "/admin/business-hours", icon: Settings },
      { label: "Debug", to: "/admin/debug", icon: ShieldCheck },
    ],
  },
];

// Prefix match: /admin/customers matches /admin/customers and /admin/customers/123
const matchesRoute = (pathname: string, to: string, exact = false): boolean => {
  if (exact) return pathname === to;
  return pathname === to || pathname.startsWith(to + "/");
};

const AdminLayout = () => {
  const location = useLocation();

  const getActiveGroupKey = (path: string): string | null => {
    for (const group of NAV_GROUPS) {
      if (group.items.some((item) => matchesRoute(path, item.to))) return group.key;
    }
    return null;
  };

  // Only the active group is open by default
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const active = getActiveGroupKey(location.pathname);
    return active ? new Set([active]) : new Set();
  });

  // Auto-open the group for the current route on navigation
  useEffect(() => {
    const active = getActiveGroupKey(location.pathname);
    if (active) setOpenGroups((prev) => new Set([...prev, active]));
  }, [location.pathname]);

  // Mobile/tablet nav drawer (below the lg: breakpoint where the sidebar
  // would otherwise render as a giant vertical block above the page
  // content). Closes automatically on navigation.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isOverview = matchesRoute(location.pathname, "/admin", true);
  const isOperations = matchesRoute(location.pathname, "/admin/operations");
  const isSettings = matchesRoute(location.pathname, "/admin/settings");

  const navContent = (
    <>
      <nav className="p-2 space-y-0.5" aria-label="Admin navigation">

              {/* Overview — always visible, not in a group */}
              <Link
                to="/admin"
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                  isOverview
                    ? "bg-primary text-primary-foreground shadow-brand"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <LayoutDashboard className="h-4 w-4 shrink-0" />
                Overview
              </Link>

              {/* Operations Command Center — always visible, not in a group */}
              <Link
                to="/admin/operations"
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                  isOperations
                    ? "bg-primary text-primary-foreground shadow-brand"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <Activity className="h-4 w-4 shrink-0" />
                Operations Center
              </Link>

              {/* Collapsible domain groups */}
              {NAV_GROUPS.map((group) => {
                const isOpen = openGroups.has(group.key);
                const hasActive = group.items.some((item: NavItem) =>
                  matchesRoute(location.pathname, item.to)
                );

                return (
                  <div key={group.key}>
                    {/* Group toggle */}
                    <button
                      onClick={() => toggleGroup(group.key)}
                      aria-expanded={isOpen}
                      className={`mt-0.5 w-full flex items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                        hasActive
                          ? "text-primary"
                          : "text-muted-foreground/50 hover:text-muted-foreground/80"
                      }`}
                    >
                      <span>{group.label}</span>
                      <ChevronRight
                        className={`h-3 w-3 shrink-0 transition-transform duration-200 ${
                          isOpen ? "rotate-90" : ""
                        }`}
                      />
                    </button>

                    {/* Group items */}
                    {isOpen && (
                      <div className="ml-2 space-y-0.5 border-l-2 border-border/30 pl-2.5 pb-1">
                        {group.items.map((item) => {
                          const active = matchesRoute(location.pathname, item.to);
                          return (
                            <Link
                              key={item.to}
                              to={item.to}
                              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                                active
                                  ? "bg-primary text-primary-foreground shadow-brand"
                                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                              }`}
                            >
                              <item.icon className="h-4 w-4 shrink-0" />
                              <span className="truncate">{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Settings — pinned at bottom */}
              <div className="border-t border-border/40 mt-1 pt-1">
                <Link
                  to="/admin/settings"
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                    isSettings
                      ? "bg-primary text-primary-foreground shadow-brand"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  <Settings className="h-4 w-4 shrink-0" />
                  Settings
                </Link>
              </div>

      </nav>
    </>
  );

  return (
    <section className="bg-background min-h-screen">
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-80 p-0 overflow-y-auto">
          <SheetTitle className="sr-only">Admin navigation</SheetTitle>
          <div className="border-b border-border/50 bg-muted/20 px-4 py-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Admin Panel
              </span>
            </div>
          </div>
          {navContent}
        </SheetContent>
      </Sheet>

      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[240px_1fr] lg:px-8">

        {/* Mobile/tablet nav trigger — inside the same padded container as
            the rest of the page content (not a sibling above it), so it
            inherits the same effective top offset that already correctly
            clears MainLayout's fixed header — a hardcoded offset here
            would have to duplicate that math and could drift out of sync. */}
        <div className="lg:hidden">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-2"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="h-4 w-4" />
            Admin Menu
          </Button>
        </div>

        {/* ── Sidebar — desktop only, lg: and up ── */}
        <aside className="hidden lg:block sticky top-24 self-start">
          <div className="rounded-2xl border border-border/60 bg-card/90 shadow-sm overflow-hidden">

            {/* Brand strip */}
            <div className="border-b border-border/50 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Admin Panel
                </span>
              </div>
            </div>

            {navContent}
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="min-h-[70vh] flex flex-col">
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname} locationKey={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </main>

      </div>
    </section>
  );
};

export default AdminLayout;
