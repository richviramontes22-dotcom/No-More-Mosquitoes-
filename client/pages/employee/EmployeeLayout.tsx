import { NavLink, Outlet } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";

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
  const nav = navForRole(profile?.role);

  return (
    <section className="bg-background">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[220px_1fr] lg:px-8">
        <aside className="rounded-2xl border border-border/70 bg-card/90 p-4">
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
        </aside>
        <div className="min-h-[60vh]">
          <Outlet />
        </div>
      </div>
    </section>
  );
};

export default EmployeeLayout;
