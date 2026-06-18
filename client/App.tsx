import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Elements } from "@stripe/react-stripe-js";
import MainLayout from "@/components/layout/MainLayout";
import CheckoutLayout from "@/components/layout/CheckoutLayout";
import RequireAuth from "@/components/auth/RequireAuth";
import RequireAdmin from "@/components/auth/RequireAdmin";
import RequireCustomer from "@/components/auth/RequireCustomer";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { LogoProvider } from "@/contexts/LogoContext";
import { CartProvider } from "@/contexts/CartContext";
import { ScheduleDialogProvider } from "@/components/schedule/ScheduleDialogProvider";
import { captureReferralCodeFromUrl } from "@/lib/referralCapture";
import { ScrollToTop } from "@/components/common/ScrollToTop";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Licenses from "./pages/Licenses";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Guarantee from "./pages/Guarantee";
import PublicLegalDocument from "./pages/legal/PublicLegalDocument";
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
import Onboarding from "./pages/Onboarding";
import LegalAcceptance from "./pages/LegalAcceptance";
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
import DashboardHelp from "./pages/dashboard/Help";
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
import AdminReferrals from "./pages/admin/Referrals";
import AdminRescheduleRequests from "./pages/admin/RescheduleRequests";
import AdminServiceAreas from "./pages/admin/ServiceAreas";
import AdminReports from "./pages/admin/Reports";
import AdminAnalytics from "./pages/admin/Analytics";
import AdminRevenue from "./pages/admin/Revenue";
import AdminSettings from "./pages/admin/Settings";
import AdminNotifications from "./pages/admin/Notifications";
import AdminAlerts from "./pages/admin/Alerts";
import AdminLeads from "./pages/admin/Leads";
import AdminLeadDetail from "./pages/admin/LeadDetail";
import AdminBusinessHours from "./pages/admin/BusinessHours";
import AdminEmployeeTracking from "./pages/admin/EmployeeTracking";
import AdminRoutePlanning from "./pages/admin/RoutePlanning";
import AdminEmployees from "./pages/admin/Employees";
import AdminLegalCompliance from "./pages/admin/LegalCompliance";
import AdminLegal from "./pages/admin/AdminLegal";
import AdminWorkforce from "./pages/admin/Workforce";
import AdminDebug from "./pages/admin/Debug";
import AdminEmailManagement from "./pages/admin/EmailManagement";
import AdminWorkforceSchedules from "./pages/admin/WorkforceSchedules";
import AdminWorkforceCapacity from "./pages/admin/WorkforceCapacity";
import RequireEmployee from "@/components/auth/RequireEmployee";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { initSentry } from "@/lib/sentry";
import EmployeeLayout from "./pages/employee/EmployeeLayout";
import EmployeeDashboard from "./pages/employee/Dashboard";
import EmployeeAssignments from "./pages/employee/Assignments";
import EmployeeAssignmentDetail from "./pages/employee/AssignmentDetail";
import EmployeeMessages from "./pages/employee/Messages";
import EmployeeTimesheets from "./pages/employee/Timesheets";
import EmployeeProfile from "./pages/employee/Profile";
import EmployeeLogin from "./pages/employee/Login";
import EmployeeOnboarding from "./pages/employee/Onboarding";
import EmployeeRoute from "./pages/employee/Route";

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

// stripePromise is imported from lib/stripe — shared across the app
import { stripePromise } from "@/lib/stripe";


// Initialize Sentry as early as possible (no-op if not configured)
initSentry();

// Capture a `?ref=CODE` referral link before any routing happens — runs once
// per fresh page load, which is exactly when a referral link would be hit.
captureReferralCodeFromUrl();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ErrorBoundary context="app-root">
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <Elements stripe={stripePromise}>
          <LanguageProvider>
          <LogoProvider>
            <CartProvider>
            <TooltipProvider>
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
                      <Route path="orders" element={<Navigate to="/dashboard/marketplace" replace />} />
                      <Route path="messages" element={<Navigate to="/dashboard/help" replace />} />
                      <Route path="support" element={<Navigate to="/dashboard/help" replace />} />
                      <Route path="videos" element={<Navigate to="/dashboard/appointments" replace />} />
                      <Route path="help" element={<DashboardHelp />} />
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
                      <Route path="reschedule-requests" element={<AdminRescheduleRequests />} />
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
                      <Route path="referrals" element={<AdminReferrals />} />
                      <Route path="service-areas" element={<AdminServiceAreas />} />
                      <Route path="employees" element={<AdminEmployees />} />
                      <Route path="legal-compliance" element={<AdminLegalCompliance />} />
                      <Route path="legal" element={<AdminLegal />} />
                      <Route path="workforce" element={<AdminWorkforce />} />
                      <Route path="debug" element={<AdminDebug />} />
                      <Route path="email-management" element={<AdminEmailManagement />} />
                      <Route path="workforce/schedules" element={<AdminWorkforceSchedules />} />
                      <Route path="workforce/capacity" element={<AdminWorkforceCapacity />} />
                      <Route path="reports" element={<AdminReports />} />
                      <Route path="analytics" element={<AdminAnalytics />} />
                      <Route path="business-hours" element={<AdminBusinessHours />} />
                      <Route path="notifications" element={<AdminNotifications />} />
                      <Route path="alerts" element={<AdminAlerts />} />
                      <Route path="leads" element={<AdminLeads />} />
                      <Route path="leads/:id" element={<AdminLeadDetail />} />
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
                      <Route path="onboarding" element={<EmployeeOnboarding />} />
                      <Route path="route" element={<EmployeeRoute />} />
                    </Route>
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/guarantee" element={<Guarantee />} />
                    <Route path="/legal/terms" element={<PublicLegalDocument documentType="terms_and_conditions" fallbackTitle="Terms and Conditions" canonicalPath="/legal/terms" />} />
                    <Route path="/legal/privacy" element={<PublicLegalDocument documentType="privacy_policy" fallbackTitle="Privacy Policy" canonicalPath="/legal/privacy" />} />
                    <Route path="/legal/service-agreement" element={<PublicLegalDocument documentType="service_agreement" fallbackTitle="Service Agreement" canonicalPath="/legal/service-agreement" />} />
                    <Route path="/legal/pesticide-consent" element={<PublicLegalDocument documentType="pesticide_consent" fallbackTitle="Pesticide Consent and Acknowledgement" canonicalPath="/legal/pesticide-consent" />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>

                  {/* Checkout / onboarding — stripped layout, no nav or footer */}
                  <Route element={<CheckoutLayout />}>
                    <Route path="/onboarding" element={
                      <RequireAuth>
                        <Onboarding />
                      </RequireAuth>
                    } />
                    {/* RequireAuth only (not RequireCustomer) — RequireCustomer redirects
                        here, so gating this route with RequireCustomer would loop. */}
                    <Route path="/legal-acceptance" element={
                      <RequireAuth>
                        <LegalAcceptance />
                      </RequireAuth>
                    } />
                  </Route>
                </Routes>
                </ScheduleDialogProvider>
            </TooltipProvider>
            </CartProvider>
          </LogoProvider>
        </LanguageProvider>
        </Elements>
      </AuthProvider>
    </BrowserRouter>
    </ErrorBoundary>
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
