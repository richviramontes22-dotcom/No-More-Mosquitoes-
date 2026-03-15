import { NavLink, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/layout/PageTransition";
import {
  LayoutDashboard,
  Users,
  Home,
  Calendar,
  Truck,
  MessageSquare,
  Ticket,
  Map,
  CreditCard,
  BarChart3,
  FileText,
  Settings,
  ShieldCheck,
  Zap,
  Globe
} from "lucide-react";

const nav = [
  { label: "Overview", to: "/admin", icon: LayoutDashboard },
  { label: "Customers", to: "/admin/customers", icon: Users },
  { label: "Properties", to: "/admin/properties", icon: Home },
  { label: "Appointments", to: "/admin/appointments", icon: Calendar },
  { label: "Visits", to: "/admin/visits", icon: Truck },
  { label: "Messages", to: "/admin/messages", icon: MessageSquare },
  { label: "Tickets", to: "/admin/tickets", icon: Ticket },
  { label: "Employee Tracking", to: "/admin/employee-tracking", icon: Map },
  { label: "Billing", to: "/admin/billing", icon: CreditCard },
  { label: "Revenue", to: "/admin/revenue", icon: BarChart3 },
  { label: "Content", to: "/admin/content", icon: FileText },
  { label: "Pricing & Plans", to: "/admin/pricing", icon: Zap },
  { label: "Service Areas", to: "/admin/service-areas", icon: Globe },
  { label: "Reports", to: "/admin/reports", icon: BarChart3 },
  { label: "Settings", to: "/admin/settings", icon: Settings },
];

const AdminLayout = () => {
  const location = useLocation();

  return (
    <section className="bg-background min-h-screen">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[280px_1fr] lg:px-8">
        <aside className="space-y-6">
          <div className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm">
            <div className="mb-4 px-3 py-2">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/70 flex items-center gap-2">
                <ShieldCheck className="h-3 w-3" />
                Admin Terminal
              </h2>
            </div>
            <nav className="grid gap-1 text-sm font-semibold text-muted-foreground" aria-label="Admin navigation">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/admin"}
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
        </aside>
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
