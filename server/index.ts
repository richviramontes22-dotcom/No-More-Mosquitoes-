import "dotenv/config";
import { assertStripeKeyNotTestInProduction } from "./lib/stripeMode";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleScheduleRequest } from "./routes/schedule";
import employeeAuth from "./routes/employeeAuth";
import employeeShifts from "./routes/employeeShifts";
import employeeAssignments from "./routes/employeeAssignments";
import employeeMessages from "./routes/employeeMessages";
import smsWebhook from "./routes/webhooks.sms";
// memory.ts seedIfEmpty removed — employee assignments now persist to Supabase (Phase 3A)
import adminStripe from "./routes/adminStripe";
import billingStripe from "./routes/billingStripe";
import marketplaceStripe from "./routes/marketplaceStripe";
import adminTracking from "./routes/adminTracking";
import regridRoutes from "./routes/regrid";
import parcelQuoteRouter from "./routes/parcelQuote";
import stripeWebhooks from "./routes/webhooksStripe";
import waitlistRouter from "./routes/waitlist";
import adminSettingsRouter from "./routes/adminSettings";
import adminRoutesRouter from "./routes/adminRoutes";
import adminEmployeesRouter from "./routes/adminEmployees";
import adminCustomersRouter from "./routes/adminCustomers";
import adminContentRouter from "./routes/adminContent";
import adminPlansRouter from "./routes/adminPlans";
import adminPromosRouter from "./routes/adminPromos";
import adminCmsRouter from "./routes/adminCms";
import adminServiceAreasRouter from "./routes/adminServiceAreas";
import adminMarketplaceRouter from "./routes/adminMarketplace";
import availabilityRouter from "./routes/availability";
import adminBlackoutDatesRouter from "./routes/adminBlackoutDates";
import customerAppointmentsRouter from "./routes/customerAppointments";
import adminAppointmentsRouter from "./routes/adminAppointments";
import devAuthRouter from "./routes/devAuth";
import adminBusinessHoursRouter from "./routes/adminBusinessHours";
import adminAlertsRouter from "./routes/adminAlerts";
import adminLeadsRouter from "./routes/adminLeads";
import adminPromotionalPopupsRouter from "./routes/adminPromotionalPopups";
import adminServiceAreaDemandRouter from "./routes/adminServiceAreaDemand";
import adminReferralsRouter from "./routes/adminReferrals";
import adminLegalRouter from "./routes/adminLegal";
import unsubscribeRouter from "./routes/unsubscribe";
import adminOnboardingRouter from "./routes/adminOnboarding";
import employeeOnboardingRouter from "./routes/employeeOnboarding";
import adminWorkforceRouter from "./routes/adminWorkforce";
import adminDebugRouter from "./routes/adminDebug";
import adminMetricsRouter from "./routes/adminMetrics";
import adminTerritoryIntelligenceRouter from "./routes/adminTerritoryIntelligence";
import adminWorkforceOptimizationRouter from "./routes/adminWorkforceOptimization";
import adminOperationsRouter from "./routes/adminOperations";
import satisfactionRouter from "./routes/satisfaction";
import salesDashboardRouter from "./routes/salesDashboard";
import customerServiceDashboardRouter from "./routes/customerServiceDashboard";
import healthRouter from "./routes/health";
import { requestIdMiddleware } from "./middleware/requestId";

export function createServer() {
  // Guard: hard-fail before any route is registered if a test key is used in production.
  assertStripeKeyNotTestInProduction();
  const app = express();

  // Middleware
  const allowedOrigins = [
    process.env.APP_BASE_URL || "https://nomoremosquitoes.us",
    "http://localhost:8080",
    "http://localhost:3000",
  ];
  app.use(cors({
    origin: (origin, cb) => {
      // Allow server-to-server calls (no origin) and known domains
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS: origin not allowed"), false);
    },
    credentials: true,
  }));
  app.use(requestIdMiddleware); // attaches req.requestId + x-request-id response header

  // Webhook needs raw body before express.json()
  app.use("/api/webhooks", express.raw({ type: "application/json" }), stripeWebhooks);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);
  app.post("/api/schedule", handleScheduleRequest);

  // /api/db-check removed — replaced by authenticated /api/health/database

  // Employee API
  app.use("/api/employee", employeeAuth);
  app.use("/api/employee", employeeShifts);
  app.use("/api/employee", employeeAssignments);
  app.use("/api/employee", employeeMessages);
  app.use("/api/employee", employeeOnboardingRouter);
  app.use("/api/employee", adminRoutesRouter); // employee/routes/today endpoint

  // Webhooks
  app.use("/api/webhooks", smsWebhook);

  // Admin Stripe API
  app.use("/api/admin", adminStripe);

  // Admin Settings API
  app.use("/api/admin", adminSettingsRouter);

  // Admin Routes API
  app.use("/api/admin", adminRoutesRouter);

  // Admin Employees API (invite, list, edit, deactivate)
  app.use("/api/admin", adminEmployeesRouter);

  // Admin Onboarding API (forms, versions, employee progress)
  app.use("/api/admin", adminOnboardingRouter);

  // Admin Workforce API (schedules, capacity, availability, overrides)
  app.use("/api/admin", adminWorkforceRouter);

  // Admin Debug API (system status, feature flags — no secrets exposed)
  app.use("/api/admin", adminDebugRouter);

  // Admin Metrics API (operational counts)
  app.use("/api/admin", adminMetricsRouter);
  app.use("/api/admin", adminTerritoryIntelligenceRouter);
  app.use("/api/admin", adminWorkforceOptimizationRouter);
  app.use("/api/admin", adminOperationsRouter);

  // Health endpoints (public lightweight + provider status)
  app.use("/api", healthRouter);

  // Admin Customers API (invite)
  app.use("/api/admin", adminCustomersRouter);

  // Admin Content API (blog, FAQs, marketplace catalog)
  app.use("/api/admin", adminContentRouter);

  // Admin Plans API (service plans + Stripe sync)
  app.use("/api/admin", adminPlansRouter);

  // Admin Promos API (promo codes, campaigns, validation)
  app.use("/api/admin", adminPromosRouter);
  app.use("/api", adminPromosRouter); // /api/promos/validate is customer-facing

  // Admin CMS API (content slots, image slots, marketplace catalog, preview)
  app.use("/api/admin", adminCmsRouter);

  // Marketplace admin API (order detail, fulfillment status, subscription alerts)
  app.use("/api/admin", adminMarketplaceRouter);

  // Service Areas API (admin CRUD + public ZIP check)
  app.use("/api/admin", adminServiceAreasRouter);
  app.use("/api", adminServiceAreasRouter); // /api/service-areas/check is public

  // Availability API (public — customer booking)
  app.use("/api", availabilityRouter);

  // Customer Appointments API (authenticated — reschedule, etc.)
  app.use("/api", customerAppointmentsRouter);

  // Blackout Dates API (admin only)
  app.use("/api/admin", adminBlackoutDatesRouter);

  // Admin Appointments API (dispatch, cancel)
  app.use("/api/admin", adminAppointmentsRouter);

  // Business Hours API (admin CRUD)
  app.use("/api/admin", adminBusinessHoursRouter);

  // Admin Alerts API (internal owner notifications)
  app.use("/api/admin", adminAlertsRouter);

  // Admin Leads API (CRM Phase 1 + Phase 2 — Lead Inbox, notes, status)
  app.use("/api/admin", adminLeadsRouter);
  app.use("/api", adminLeadsRouter); // /api/leads/quote-link/:token is public

  // Promotional Popups — admin CRUD + public active endpoint
  app.use("/api/admin", adminPromotionalPopupsRouter);
  app.use("/api", adminPromotionalPopupsRouter); // /api/promotional-popups/active is public

  // Admin Service Area Demand API (CRM Phase 2 — demand intelligence)
  app.use("/api/admin", adminServiceAreaDemandRouter);

  // Referral Program — admin endpoints are defined with an /admin/referrals/*
  // path internally (unlike most admin*.ts files), and /referrals/validate +
  // /referrals/my-code are customer/public-facing — single mount at /api covers all.
  app.use("/api", adminReferralsRouter);
  app.use("/api", satisfactionRouter);
  app.use("/api", salesDashboardRouter);
  app.use("/api", customerServiceDashboardRouter);

  // Legal Documents — admin endpoints are defined with an /admin/legal/* path
  // internally; /legal/status, /legal/documents/:type, /legal/acceptances are
  // public/customer-facing — single mount at /api covers all.
  app.use("/api", adminLegalRouter);

  // Email unsubscribe (one-click CAN-SPAM compliance — unauthenticated)
  app.use("/api", unsubscribeRouter);

  // Billing Stripe API
  app.use("/api/billing", billingStripe);

  // Marketplace Stripe API
  app.use("/api/marketplace", marketplaceStripe);

  // Admin Tracking API
  app.use("/api/admin", adminTracking);

  // Regrid API (legacy — kept for backward compat; new flow uses /api/parcel)
  app.use("/api/regrid", regridRoutes);

  // Parcel acreage quote API (county GIS adapters + permanent cache)
  app.use("/api/parcel", parcelQuoteRouter);

  // Waitlist API
  app.use("/api/waitlist", waitlistRouter);

  // Dev-only: test account auto-confirmation (never active in production)
  if (process.env.NODE_ENV !== "production") {
    app.use("/api/dev", devAuthRouter);
  }

  return app;
}
