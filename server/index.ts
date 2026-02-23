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
import adminTracking from "./routes/adminTracking";
import regridRoutes from "./routes/regrid";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
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
      const { data, error } = await supabase.from("profiles").select("id").limit(1);
      res.json({
        connected: !error,
        error: error?.message,
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

  // Admin Tracking API
  app.use("/api/admin", adminTracking);

  // Regrid API
  app.use("/api/regrid", regridRoutes);

  // Seed demo data (in-memory) so employee API works without DB
  seedIfEmpty();

  return app;
}
