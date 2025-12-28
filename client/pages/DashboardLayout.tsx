import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "@/hooks/use-translation";

const DashboardLayout = () => {
  const { t } = useTranslation();

  const nav = [
    { label: t("dashboard.navOverview"), to: "/dashboard" },
    { label: t("dashboard.navAppointments"), to: "/dashboard/appointments" },
    { label: t("dashboard.navBilling"), to: "/dashboard/billing" },
    { label: t("dashboard.navProperties"), to: "/dashboard/properties" },
    { label: t("dashboard.navMessages"), to: "/dashboard/messages" },
    { label: t("dashboard.navSupport"), to: "/dashboard/support" },
    { label: t("dashboard.navVideos"), to: "/dashboard/videos" },
    { label: t("dashboard.navProfile"), to: "/dashboard/profile" },
  ];

  return (
    <section className="bg-background">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[240px_1fr] lg:px-8">
        <aside className="rounded-2xl border border-border/70 bg-card/90 p-4">
          <nav className="grid gap-1 text-sm font-semibold text-muted-foreground" aria-label="Customer dashboard">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/dashboard"}
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

export default DashboardLayout;
