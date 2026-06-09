/**
 * Admin debug endpoints.
 *
 * GET /api/admin/debug/system-status
 *   Returns a safe snapshot of system configuration — provider presence,
 *   feature flags, Stripe mode, etc.
 *
 * Security rules:
 *   - Admin JWT required
 *   - Never returns secret values, API keys, or tokens
 *   - Never returns raw Stripe or Supabase objects
 *   - Never returns PII beyond aggregate counts
 */

import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { getStripeDiagnostics } from "../lib/stripeMode";
import { getAllFlags, flags } from "../lib/featureFlags";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();
const db = supabaseAdmin ?? supabase;

router.get("/debug/system-status", requireAdmin, async (req: any, res) => {
  // Only accessible when debug panel is enabled OR when explicitly called in dev
  if (!flags.adminDebugPanel() && process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Debug panel is disabled. Set ENABLE_ADMIN_DEBUG_PANEL=true to enable." });
  }

  const requestId = req.requestId || "no-request-id";

  try {
    // Aggregate counts — no PII
    const [activeSubsRes, activeEmpsRes, todayApptsRes] = await Promise.allSettled([
      db.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
      db.from("employees").select("id", { count: "exact", head: true }).eq("status", "active"),
      db.from("appointments").select("id", { count: "exact", head: true })
        .gte("scheduled_at", new Date().toISOString().slice(0, 10) + "T00:00:00Z")
        .lt("scheduled_at",  new Date().toISOString().slice(0, 10) + "T23:59:59Z"),
    ]);

    const stripeDiag = getStripeDiagnostics();

    const status = {
      requestId,
      generated_at: new Date().toISOString(),
      environment: process.env.NODE_ENV || "unknown",
      app_version: process.env.APP_VERSION || process.env.npm_package_version || "unknown",

      providers: {
        supabase: {
          url_configured:          !!process.env.VITE_SUPABASE_URL,
          anon_key_configured:     !!process.env.VITE_SUPABASE_ANON_KEY,
          service_role_configured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        },
        stripe: stripeDiag,
        resend: {
          api_key_configured:  !!process.env.RESEND_API_KEY,
          from_email_configured: !!process.env.RESEND_FROM_EMAIL,
          from_email: process.env.RESEND_FROM_EMAIL
            ? process.env.RESEND_FROM_EMAIL.replace(/(.{2}).+(@.+)/, "$1***$2")
            : null,
        },
        twilio: {
          account_sid_configured: !!process.env.TWILIO_ACCOUNT_SID,
          auth_token_configured:  !!process.env.TWILIO_AUTH_TOKEN,
          from_number_configured: !!process.env.TWILIO_FROM_NUMBER,
        },
      },

      feature_flags: getAllFlags(),

      operational: {
        reminder_dry_run:     flags.reminderDryRun(),
        workforce_validation: flags.workforceValidation(),
        route_publish_gate:   flags.routePublishGate(),
        regrid_fallback:      flags.regridFallback(),
        parcel_county_lookup: flags.parcelCountyLookup(),
      },

      counts: {
        active_subscriptions: activeSubsRes.status === "fulfilled" ? (activeSubsRes.value as any)?.count ?? "error" : "error",
        active_employees:     activeEmpsRes.status === "fulfilled" ? (activeEmpsRes.value as any)?.count ?? "error" : "error",
        appointments_today:   todayApptsRes.status === "fulfilled" ? (todayApptsRes.value as any)?.count ?? "error" : "error",
      },

      checkpoint_persistence: "not_enabled",
    };

    res.json({ ok: true, status });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: "Failed to load system status", requestId });
  }
});

export default router;
