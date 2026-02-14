import { NavLink, Outlet } from "react-router-dom";

const nav = [
  { label: "Dashboard", to: "/employee" },
  { label: "Assignments", to: "/employee/assignments" },
  { label: "Messages", to: "/employee/messages" },
  { label: "Timesheets", to: "/employee/timesheets" },
  { label: "Profile", to: "/employee/profile" },
];

const EmployeeLayout = () => {
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
