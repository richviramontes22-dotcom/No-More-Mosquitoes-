/**
 * Admin operational metrics.
 *
 * GET /api/admin/metrics/operations
 * Returns aggregate operational data — no PII, no secrets.
 * Missing or untracked metrics return null with trackingMissing: true.
 */

import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireAdmin } from "../middleware/requireAdmin";
import { getReferralAnalytics, getRouteAnalytics, getCrmAnalytics } from "../services/analytics/platformAnalyticsService";

const router = Router();
const db = supabaseAdmin ?? supabase;

router.get("/metrics/operations", requireAdmin, async (req: any, res) => {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const next7Days    = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const requestId    = req.requestId;

  const sc = async (fn: () => PromiseLike<any>): Promise<number | null> => {
    try { const r = await fn(); return typeof r.count === "number" ? r.count : null; }
    catch { return null; }
  };

  const [
    appointmentsTodayCount,
    appointmentsNext7Count,
    activeSubsCount,
    activeEmpsCount,
    reminderSent7dCount,
    reminderFailed7dCount,
    routePublishBlockedCount,
    parcelManualReviewCount,
  ] = await Promise.all([
    sc(() => db.from("appointments").select("id", { count: "exact", head: true })
      .gte("scheduled_at", `${today}T00:00:00Z`)
      .lt("scheduled_at",  `${today}T23:59:59Z`)),

    sc(() => db.from("appointments").select("id", { count: "exact", head: true })
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", next7Days)
      .eq("status", "scheduled")),

    sc(() => db.from("subscriptions").select("id", { count: "exact", head: true })
      .eq("status", "active")),

    sc(() => db.from("employees").select("id", { count: "exact", head: true })
      .eq("status", "active")),

    sc(() => db.from("notification_log").select("id", { count: "exact", head: true })
      .in("notification_type", ["reminder_24h", "reminder_same_day"])
      .eq("status", "sent")
      .gte("created_at", sevenDaysAgo)),

    sc(() => db.from("notification_log").select("id", { count: "exact", head: true })
      .in("notification_type", ["reminder_24h", "reminder_same_day"])
      .eq("status", "failed")
      .gte("created_at", sevenDaysAgo)),

    sc(() => db.from("route_audit_log").select("id", { count: "exact", head: true })
      .in("action", ["route_publish.blocked", "day_published_force_override"])
      .gte("created_at", sevenDaysAgo)),

    // Parcel manual reviews not yet persisted to DB
    Promise.resolve(null),
  ]);

  // Workforce readiness
  let missingSchedules: number | null = null;
  let missingCapacityProfiles: number | null = null;
  try {
    const [allEmps, scheduleRows, capacityRows] = await Promise.all([
      db.from("employees").select("id").eq("status", "active").in("role", ["technician", "dispatcher"]),
      db.from("technician_schedule_templates").select("employee_id"),
      db.from("technician_capacity_profiles").select("employee_id"),
    ]);
    const allIds    = new Set((allEmps.data || []).map((e: any) => e.id));
    const schedIds  = new Set((scheduleRows.data || []).map((r: any) => r.employee_id));
    const capIds    = new Set((capacityRows.data || []).map((r: any) => r.employee_id));
    missingSchedules       = [...allIds].filter(id => !schedIds.has(id)).length;
    missingCapacityProfiles = [...allIds].filter(id => !capIds.has(id)).length;
  } catch { /* leave as null */ }

  res.json({
    ok: true,
    requestId,
    generated_at: now.toISOString(),
    metrics: {
      appointments: {
        today: appointmentsTodayCount,
        next_7_days: appointmentsNext7Count,
      },
      subscriptions: {
        active: activeSubsCount,
      },
      employees: {
        active: activeEmpsCount,
      },
      reminders: {
        sent_last_7d: reminderSent7dCount,
        failed_last_7d: reminderFailed7dCount,
        trackingMissing: reminderSent7dCount === null,
      },
      workforce: {
        missing_schedules: missingSchedules,
        missing_capacity_profiles: missingCapacityProfiles,
        trackingMissing: missingSchedules === null,
      },
      routes: {
        publish_validation_failures_last_7d: routePublishBlockedCount,
        trackingMissing: routePublishBlockedCount === null,
      },
      parcel: {
        manual_review_count: parcelManualReviewCount,
        trackingMissing: true,  // Parcel volume not yet persisted to DB
      },
    },
  });
});

// GET /api/admin/metrics/platform-analytics
// Lightweight foundation dashboards (Platform Growth Phase 2) — referral,
// route, and CRM aggregates. Tables/cards, no charting library additions.
router.get("/metrics/platform-analytics", requireAdmin, async (req: any, res) => {
  try {
    const windowDays = Math.min(parseInt(String(req.query.window_days ?? "30"), 10) || 30, 180);
    const [referrals, routes, crm] = await Promise.all([
      getReferralAnalytics(),
      getRouteAnalytics(windowDays),
      getCrmAnalytics(),
    ]);
    res.json({ referrals, routes, crm });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
