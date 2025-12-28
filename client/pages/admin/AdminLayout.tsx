import { NavLink, Outlet } from "react-router-dom";

const nav = [
  { label: "Overview", to: "/admin" },
  { label: "Customers", to: "/admin/customers" },
  { label: "Properties", to: "/admin/properties" },
  { label: "Appointments", to: "/admin/appointments" },
  { label: "Visits", to: "/admin/visits" },
  { label: "Messages", to: "/admin/messages" },
  { label: "Tickets", to: "/admin/tickets" },
  { label: "Employee Tracking", to: "/admin/employee-tracking" },
  { label: "Billing", to: "/admin/billing" },
  { label: "Revenue", to: "/admin/revenue" },
  { label: "Content", to: "/admin/content" },
  { label: "Pricing & Plans", to: "/admin/pricing" },
  { label: "Service Areas", to: "/admin/service-areas" },
  { label: "Reports", to: "/admin/reports" },
  { label: "Settings", to: "/admin/settings" },
];

const AdminLayout = () => {
  return (
    <section className="bg-background">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[260px_1fr] lg:px-8">
        <aside className="rounded-2xl border border-border/70 bg-card/90 p-4">
          <nav className="grid gap-1 text-sm font-semibold text-muted-foreground" aria-label="Admin navigation">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/admin"}
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

export default AdminLayout;
