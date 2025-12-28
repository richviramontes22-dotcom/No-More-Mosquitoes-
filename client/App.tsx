import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import RequireAuth from "@/components/auth/RequireAuth";
import RequireAdmin from "@/components/auth/RequireAdmin";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthDialogProvider } from "@/components/auth/AuthDialogProvider";
import { ScheduleDialogProvider } from "@/components/schedule/ScheduleDialogProvider";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import PlaceholderPage from "./pages/Placeholder";
import Pricing from "./pages/Pricing";
import Services from "./pages/Services";
import OurStory from "./pages/OurStory";
import Reviews from "./pages/Reviews";
import ServiceArea from "./pages/ServiceArea";
import FAQ from "./pages/FAQ";
import Blog from "./pages/Blog";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Schedule from "./pages/Schedule";
import DashboardLayout from "./pages/DashboardLayout";
import DashboardAppointments from "./pages/dashboard/Appointments";
import DashboardBilling from "./pages/dashboard/Billing";
import DashboardProperties from "./pages/dashboard/Properties";
import DashboardMessages from "./pages/dashboard/Messages";
import DashboardSupport from "./pages/dashboard/Support";
import DashboardVideos from "./pages/dashboard/Videos";
import DashboardProfile from "./pages/dashboard/Profile";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverview from "./pages/admin/Overview";
import AdminCustomers from "./pages/admin/Customers";
import AdminProperties from "./pages/admin/Properties";
import AdminAppointments from "./pages/admin/Appointments";
import AdminVisits from "./pages/admin/Visits";
import AdminMessages from "./pages/admin/Messages";
import AdminTickets from "./pages/admin/Tickets";
import AdminBilling from "./pages/admin/Billing";
import AdminContent from "./pages/admin/Content";
import AdminPricing from "./pages/admin/Pricing";
import AdminServiceAreas from "./pages/admin/ServiceAreas";
import AdminReports from "./pages/admin/Reports";
import AdminRevenue from "./pages/admin/Revenue";
import AdminSettings from "./pages/admin/Settings";
import AdminEmployeeTracking from "./pages/admin/EmployeeTracking";
import RequireEmployee from "@/components/auth/RequireEmployee";
import EmployeeLayout from "./pages/employee/EmployeeLayout";
import EmployeeDashboard from "./pages/employee/Dashboard";
import EmployeeAssignments from "./pages/employee/Assignments";
import EmployeeAssignmentDetail from "./pages/employee/AssignmentDetail";
import EmployeeMessages from "./pages/employee/Messages";
import EmployeeTimesheets from "./pages/employee/Timesheets";
import EmployeeProfile from "./pages/employee/Profile";
import EmployeeLogin from "./pages/employee/Login";

const queryClient = new QueryClient();

const PLACEHOLDER_ROUTES = [
  {
    path: "/contact",
    title: "Contact",
    description:
      "Reach our local office for quotes, billing, or technician dispatch. We reply to calls, texts, and emails Monday–Saturday 7a–7p.",
    callToActionLabel: "Call or Text Now",
    callToActionPath: "tel:+19497630492",
  },
  {
    path: "/privacy",
    title: "Privacy Policy",
    description:
      "Review how we handle your contact details, property data, and consent preferences across analytics, call tracking, and service reminders.",
    callToActionLabel: "Request Data Report",
  },
  {
    path: "/terms",
    title: "Terms of Service",
    description:
      "Understand scheduling expectations, safety commitments, guarantees, and how we handle weather-related adjustments.",
  },
  {
    path: "/guarantee",
    title: "Satisfaction Guarantee",
    description:
      "If mosquitoes return between scheduled visits, we re-service at no charge. Learn exactly how our 100% guarantee protects your home.",
  },
  {
    path: "/licenses",
    title: "Licenses & Insurance",
    description:
      "View current California structural pest control licensing, insurance certificates, and safety documentation.",
  },
];

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <TooltipProvider>
            <AuthDialogProvider>
              <ScheduleDialogProvider>
              <Toaster />
              <Sonner />
              <Routes>
                <Route element={<MainLayout />}>
                  <Route index element={<Index />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/services" element={<Services />} />
                  <Route path="/our-story" element={<OurStory />} />
                  <Route path="/reviews" element={<Reviews />} />
                  <Route path="/service-area" element={<ServiceArea />} />
                  <Route path="/faq" element={<FAQ />} />
                  <Route path="/blog" element={<Blog />} />
                  <Route path="/schedule" element={<Schedule />} />
                  <Route path="/login" element={<Login />} />
                  <Route
                    path="/dashboard"
                    element={
                      <RequireAuth>
                        <DashboardLayout />
                      </RequireAuth>
                    }
                  >
                    <Route index element={<Dashboard />} />
                    <Route path="appointments" element={<DashboardAppointments />} />
                    <Route path="billing" element={<DashboardBilling />} />
                    <Route path="properties" element={<DashboardProperties />} />
                    <Route path="messages" element={<DashboardMessages />} />
                    <Route path="support" element={<DashboardSupport />} />
                    <Route path="videos" element={<DashboardVideos />} />
                    <Route path="profile" element={<DashboardProfile />} />
                  </Route>

                  <Route
                    path="/admin"
                    element={
                      <RequireAdmin>
                        <AdminLayout />
                      </RequireAdmin>
                    }
                  >
                    <Route index element={<AdminOverview />} />
                    <Route path="customers" element={<AdminCustomers />} />
                    <Route path="properties" element={<AdminProperties />} />
                    <Route path="appointments" element={<AdminAppointments />} />
                    <Route path="visits" element={<AdminVisits />} />
                    <Route path="messages" element={<AdminMessages />} />
                    <Route path="tickets" element={<AdminTickets />} />
                    <Route path="billing" element={<AdminBilling />} />
                    <Route path="revenue" element={<AdminRevenue />} />
                    <Route path="employee-tracking" element={<AdminEmployeeTracking />} />
                    <Route path="content" element={<AdminContent />} />
                    <Route path="pricing" element={<AdminPricing />} />
                    <Route path="service-areas" element={<AdminServiceAreas />} />
                    <Route path="reports" element={<AdminReports />} />
                    <Route path="settings" element={<AdminSettings />} />
                  </Route>

                  <Route path="/employee/login" element={<EmployeeLogin />} />

                  <Route
                    path="/employee"
                    element={
                      <RequireEmployee>
                        <EmployeeLayout />
                      </RequireEmployee>
                    }
                  >
                    <Route index element={<EmployeeDashboard />} />
                    <Route path="assignments" element={<EmployeeAssignments />} />
                    <Route path="assignments/:id" element={<EmployeeAssignmentDetail />} />
                    <Route path="messages" element={<EmployeeMessages />} />
                    <Route path="timesheets" element={<EmployeeTimesheets />} />
                    <Route path="profile" element={<EmployeeProfile />} />
                  </Route>
                  {PLACEHOLDER_ROUTES.map((route) => (
                    <Route
                      key={route.path}
                      path={route.path}
                      element={
                        <PlaceholderPage
                          title={route.title}
                          description={route.description}
                          callToActionLabel={route.callToActionLabel}
                          callToActionPath={route.callToActionPath}
                        />
                      }
                    />
                  ))}
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
              </ScheduleDialogProvider>
            </AuthDialogProvider>
          </TooltipProvider>
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

const container = document.getElementById("root")!;
// Reuse the same root during HMR to avoid duplicate createRoot warnings
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let root = (window as any).__APP_ROOT as Root | undefined;
if (!root) {
  root = createRoot(container);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__APP_ROOT = root;
}
root.render(<App />);
