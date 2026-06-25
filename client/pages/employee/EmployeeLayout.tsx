import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useEmployee } from "@/hooks/employee/useEmployee";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { enableEmployeePwa, disableEmployeePwa } from "@/lib/employee/pwa";
import { OfflineIndicator } from "@/components/employee/OfflineIndicator";

const TECHNICIAN_NAV = [
  { label: "Dashboard", to: "/employee" },
  { label: "Assignments", to: "/employee/assignments" },
  { label: "Today's Route", to: "/employee/route" },
  { label: "Onboarding", to: "/employee/onboarding" },
  { label: "Messages", to: "/employee/messages" },
  { label: "Timesheets", to: "/employee/timesheets" },
  { label: "Profile", to: "/employee/profile" },
];

const CUSTOMER_SERVICE_NAV = [
  { label: "Dashboard", to: "/employee" },
  { label: "Tickets", to: "/employee/tickets" },
  { label: "Satisfaction", to: "/employee/satisfaction" },
  { label: "Reschedule Requests", to: "/employee/reschedule-requests" },
];

const SALES_NAV = [
  { label: "Dashboard", to: "/employee" },
];

// Admins viewing the employee portal (for oversight) see every nav item —
// the underlying pages are still gated per-tool (RequireCustomerService /
// RequireSales), this is just so an admin checking in on the portal isn't
// missing links.
const ADMIN_NAV = [
  ...TECHNICIAN_NAV,
  { label: "Tickets", to: "/employee/tickets" },
  { label: "Satisfaction", to: "/employee/satisfaction" },
  { label: "Reschedule Requests", to: "/employee/reschedule-requests" },
];

function navForRole(role: string | undefined) {
  switch (role) {
    case "customer_service": return CUSTOMER_SERVICE_NAV;
    case "sales": return SALES_NAV;
    case "admin": return ADMIN_NAV;
    default: return TECHNICIAN_NAV; // technician, dispatcher, support, employee
  }
}

const EmployeeLayout = () => {
  const { data: profile } = useProfile();
  // customer_service/sales roles have no employees table row at all (no
  // field work, no route/assignment actions to queue) — useEmployee()
  // correctly resolves undefined for them, which the queue/cache hooks
  // already treat as a no-op.
  const { data: employee } = useEmployee();
  const nav = navForRole(profile?.role);
  const location = useLocation();

  // Mobile/tablet nav drawer (below lg:, where the sidebar would otherwise
  // render as a block above the page content). Closes on navigation.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  // PWA manifest + service worker registration is scoped to this layout's
  // lifetime only — mounted while anywhere under /employee/*, removed on
  // unmount (e.g. logging out into the public site). No other layout in
  // the app calls this, so public/customer/admin pages are never affected.
  useEffect(() => {
    enableEmployeePwa();
    return () => disableEmployeePwa();
  }, []);

  const navLinks = (
    <nav className="grid gap-1 text-sm font-semibold text-muted-foreground" aria-label="Employee navigation">
      {nav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/employee"}
          className={({ isActive }) =>
            `rounded-xl px-3 py-2 transition ${isActive ? "bg-primary/10 text-primary" : "hover:bg-muted/50 hover:text-foreground"}`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <section className="bg-background">
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-72 p-4">
          <SheetTitle className="sr-only">Employee navigation</SheetTitle>
          {navLinks}
        </SheetContent>
      </Sheet>

      <OfflineIndicator employeeId={employee?.id} />

      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[220px_1fr] lg:px-8">
        {/* Mobile/tablet nav trigger — inside the same padded container as
            the rest of the page content (not a sibling above it), so it
            inherits the same effective top offset that already correctly
            clears MainLayout's fixed header. */}
        <div className="lg:hidden">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-2"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="h-4 w-4" />
            Menu
          </Button>
        </div>
        <aside className="hidden lg:block rounded-2xl border border-border/70 bg-card/90 p-4">
          {navLinks}
        </aside>
        <div className="min-h-[60vh]">
          <Outlet />
        </div>
      </div>
    </section>
  );
};

export default EmployeeLayout;
