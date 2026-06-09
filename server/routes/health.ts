/**
 * Health check endpoints.
 *
 * /api/health            — lightweight public app health
 * /api/health/database   — Supabase connectivity + latency
 * /api/health/stripe     — Stripe config/mode (no API calls)
 * /api/health/email      — Resend + reminder config
 * /api/health/parcel     — Parcel service config
 * /api/health/workforce  — Workforce readiness summary
 *
 * Security: /api/health is public. All /api/health/* sub-checks
 * are public for lightweight config status but never expose secrets.
 */

import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { getStripeMode } from "../lib/stripeMode";
import { flags } from "../lib/featureFlags";
import { detectCountyFromZip } from "../services/parcel/countyDetector";

const router = Router();
const db = supabaseAdmin ?? supabase;

// ─── GET /api/health ─────────────────────────────────────────────────────────
// Lightweight — used by uptime monitors and load balancers.
router.get("/health", (req: any, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "unknown",
    requestId: req.requestId,
    version: process.env.APP_VERSION || process.env.npm_package_version || "unknown",
  });
});

// ─── GET /api/health/database ─────────────────────────────────────────────────
router.get("/health/database", async (req: any, res) => {
  const start = Date.now();
  try {
    const { error } = await db
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .limit(1);

    const latencyMs = Date.now() - start;

    if (error) {
      return res.status(503).json({
        ok: false,
        latencyMs,
        requestId: req.requestId,
        error: "Database query failed",
      });
    }

    return res.json({ ok: true, latencyMs, requestId: req.requestId });
  } catch (err: any) {
    return res.status(503).json({
      ok: false,
      latencyMs: Date.now() - start,
      requestId: req.requestId,
      error: "Database unreachable",
    });
  }
});

// ─── GET /api/health/stripe ───────────────────────────────────────────────────
// No Stripe API call — only checks key presence and mode.
router.get("/health/stripe", (req: any, res) => {
  const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || process.env.STRIPE_SECRET;
  const mode = getStripeMode();
  const webhookConfigured = !!process.env.STRIPE_WEBHOOK_SECRET;

  res.json({
    ok: !!key,
    configured: !!key,
    mode,
    webhookConfigured,
    publishableKeyConfigured: !!process.env.VITE_STRIPE_PUBLISHABLE_KEY,
    requestId: req.requestId,
  });
});

// ─── GET /api/health/email ────────────────────────────────────────────────────
router.get("/health/email", (req: any, res) => {
  res.json({
    ok: !!process.env.RESEND_API_KEY,
    configured: !!process.env.RESEND_API_KEY,
    fromEmailConfigured: !!process.env.RESEND_FROM_EMAIL,
    reminderEmailsEnabled: flags.reminderEmails(),
    reminderDryRun: flags.reminderDryRun(),
    requestId: req.requestId,
  });
});

// ─── GET /api/health/parcel ───────────────────────────────────────────────────
router.get("/health/parcel", (req: any, res) => {
  // Test county detection with a known Orange County ZIP
  const testCounty = detectCountyFromZip("92618");

  res.json({
    ok: flags.parcelCountyLookup(),
    countyLookupEnabled: flags.parcelCountyLookup(),
    regridFallbackEnabled: flags.regridFallback(),
    googleServerKeyConfigured: !!(process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_SERVER_API_KEY),
    regridKeyConfigured: !!process.env.REGRID_API_KEY,
    testCountyDetection: testCounty,
    supportedCounties: ["orange", "riverside", "san_diego", "los_angeles"],
    requestId: req.requestId,
  });
});

// ─── GET /api/health/workforce ────────────────────────────────────────────────
router.get("/health/workforce", async (req: any, res) => {
  try {
    const [empsRes, schedulesRes, capacityRes] = await Promise.all([
      db.from("employees").select("id", { count: "exact", head: true }).eq("status", "active").in("role", ["technician", "dispatcher"]),
      db.from("technician_schedule_templates").select("employee_id").limit(500),
      db.from("technician_capacity_profiles").select("employee_id").limit(500),
    ]);

    const activeCount = (empsRes as any)?.count ?? 0;
    const scheduledIds = new Set((schedulesRes.data || []).map((r: any) => r.employee_id));
    const capacityIds  = new Set((capacityRes.data || []).map((r: any) => r.employee_id));

    const { data: empIds } = await db.from("employees").select("id").eq("status", "active").in("role", ["technician", "dispatcher"]);
    const allIds = (empIds || []).map((e: any) => e.id);
    const missingSchedules = allIds.filter((id: string) => !scheduledIds.has(id)).length;
    const missingCapacity  = allIds.filter((id: string) => !capacityIds.has(id)).length;

    return res.json({
      ok: true,
      workforceValidationEnabled: flags.workforceValidation(),
      routePublishGateEnabled: flags.routePublishGate(),
      activeTechnicians: activeCount,
      missingSchedules,
      missingCapacityProfiles: missingCapacity,
      setupComplete: missingSchedules === 0 && missingCapacity === 0,
      requestId: req.requestId,
    });
  } catch (err: any) {
    return res.status(503).json({
      ok: false,
      error: "Workforce check failed",
      requestId: req.requestId,
    });
  }
});

export default router;
