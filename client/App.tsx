import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import MainLayout from "@/components/layout/MainLayout";
import RequireAuth from "@/components/auth/RequireAuth";
import RequireAdmin from "@/components/auth/RequireAdmin";
import RequireCustomer from "@/components/auth/RequireCustomer";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { LogoProvider } from "@/contexts/LogoContext";
import { CartProvider } from "@/contexts/CartContext";
import { AuthDialogProvider } from "@/components/auth/AuthDialogProvider";
import { ScheduleDialogProvider } from "@/components/schedule/ScheduleDialogProvider";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Licenses from "./pages/Licenses";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Guarantee from "./pages/Guarantee";
import Pricing from "./pages/Pricing";
import Services from "./pages/Services";
import OurStory from "./pages/OurStory";
import Reviews from "./pages/Reviews";
import ServiceArea from "./pages/ServiceArea";
import FAQ from "./pages/FAQ";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Contact from "./pages/Contact";
import Safety from "./pages/Safety";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
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
import DashboardMarketplace from "./pages/dashboard/Marketplace";
import DashboardOrders from "./pages/dashboard/Orders";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminLogin from "./pages/admin/AdminLogin";
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
import AdminWebsiteManager from "./pages/admin/WebsiteManager";
import AdminPromos from "./pages/admin/Promos";
import AdminServiceAreas from "./pages/admin/ServiceAreas";
import AdminReports from "./pages/admin/Reports";
import AdminRevenue from "./pages/admin/Revenue";
import AdminSettings from "./pages/admin/Settings";
import AdminEmployeeTracking from "./pages/admin/EmployeeTracking";
import AdminRoutePlanning from "./pages/admin/RoutePlanning";
import AdminEmployees from "./pages/admin/Employees";
import RequireEmployee from "@/components/auth/RequireEmployee";
import EmployeeLayout from "./pages/employee/EmployeeLayout";
import EmployeeDashboard from "./pages/employee/Dashboard";
import EmployeeAssignments from "./pages/employee/Assignments";
import EmployeeAssignmentDetail from "./pages/employee/AssignmentDetail";
import EmployeeMessages from "./pages/employee/Messages";
import EmployeeTimesheets from "./pages/employee/Timesheets";
import EmployeeProfile from "./pages/employee/Profile";
import EmployeeLogin from "./pages/employee/Login";

// SECTION 2: Standardized QueryClient defaults for production stability
// These defaults apply globally to all queries unless explicitly overridden per-hook
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 0, // Do not retry failed requests - let timeout + error handling resolve
      staleTime: 5 * 60 * 1000, // Data is fresh for 5 minutes
      gcTime: 15 * 60 * 1000, // Keep cached data for 15 minutes
      refetchOnWindowFocus: false, // Don't refetch when tab regains focus
      refetchOnReconnect: false, // Don't refetch on network reconnect
      refetchOnMount: false, // Don't refetch when component remounts
    },
  },
});

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");


const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <Elements stripe={stripePromise}>
          <LanguageProvider>
          <LogoProvider>
            <CartProvider>
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
                    <Route path="/blog/:slug" element={<BlogPost />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/safety" element={<Safety />} />
                    <Route path="/licenses" element={<Licenses />} />
                    <Route path="/schedule" element={<Schedule />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/admin/login" element={<AdminLogin />} />
                    <Route
                      path="/dashboard"
                      element={
                        <RequireCustomer>
                          <DashboardLayout />
                        </RequireCustomer>
                      }
                    >
                      <Route index element={<Dashboard />} />
                      <Route path="appointments" element={<DashboardAppointments />} />
                      <Route path="billing" element={<DashboardBilling />} />
                      <Route path="properties" element={<DashboardProperties />} />
                      <Route path="marketplace" element={<DashboardMarketplace />} />
                      <Route path="orders" element={<DashboardOrders />} />
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
                      <Route path="route-planning" element={<AdminRoutePlanning />} />
                      <Route path="billing" element={<AdminBilling />} />
                      <Route path="revenue" element={<AdminRevenue />} />
                      <Route path="employee-tracking" element={<AdminEmployeeTracking />} />
                      <Route path="website-manager" element={<AdminWebsiteManager />} />
                      <Route path="content" element={<AdminContent />} />
                      <Route path="pricing" element={<AdminPricing />} />
                      <Route path="promos" element={<AdminPromos />} />
                      <Route path="service-areas" element={<AdminServiceAreas />} />
                      <Route path="employees" element={<AdminEmployees />} />
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
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/guarantee" element={<Guarantee />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Routes>
                </ScheduleDialogProvider>
              </AuthDialogProvider>
            </TooltipProvider>
            </CartProvider>
          </LogoProvider>
        </LanguageProvider>
        </Elements>
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
