import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleScheduleRequest } from "./routes/schedule";
import employeeAuth from "./routes/employeeAuth";
import employeeShifts from "./routes/employeeShifts";
import employeeAssignments from "./routes/employeeAssignments";
import employeeMessages from "./routes/employeeMessages";
import smsWebhook from "./routes/webhooks.sms";
import { seedIfEmpty } from "./lib/memory";
import adminStripe from "./routes/adminStripe";
import billingStripe from "./routes/billingStripe";
import marketplaceStripe from "./routes/marketplaceStripe";
import adminTracking from "./routes/adminTracking";
import regridRoutes from "./routes/regrid";
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

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());

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

  app.get("/api/db-check", async (_req, res) => {
    try {
      const { supabase } = await import("./lib/supabase");

      const results: Record<string, any> = {};

      // Check Profiles and stripe_customer_id column
      const { data: profData, error: profError } = await supabase.from("profiles").select("id, stripe_customer_id").limit(1);
      results.profiles = { success: !profError, error: profError?.message };

      // Check Plans
      const { data: plansData, error: plansError } = await supabase.from("plans").select("id").limit(1);
      results.plans = { success: !plansError, error: plansError?.message };

      // Check Subscriptions
      const { data: subData, error: subError } = await supabase.from("subscriptions").select("id").limit(1);
      results.subscriptions = { success: !subError, error: subError?.message };

      // Check Payments
      const { data: payData, error: payError } = await supabase.from("payments").select("id").limit(1);
      results.payments = { success: !payError, error: payError?.message };

      const allSuccess = Object.values(results).every((r: any) => r.success);

      res.json({
        connected: allSuccess,
        results,
        url: process.env.VITE_SUPABASE_URL ? "Set" : "Missing"
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Employee API (stubs)
  app.use("/api/employee", employeeAuth);
  app.use("/api/employee", employeeShifts);
  app.use("/api/employee", employeeAssignments);
  app.use("/api/employee", employeeMessages);

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

  // Billing Stripe API
  app.use("/api/billing", billingStripe);

  // Marketplace Stripe API
  app.use("/api/marketplace", marketplaceStripe);

  // Admin Tracking API
  app.use("/api/admin", adminTracking);

  // Regrid API
  app.use("/api/regrid", regridRoutes);

  // Waitlist API
  app.use("/api/waitlist", waitlistRouter);

  // Seed demo data (in-memory) so employee API works without DB
  seedIfEmpty();

  return app;
}
