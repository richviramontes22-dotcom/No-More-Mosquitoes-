import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { generateDayPlan } from "./dayPlanGenerator";
import { applySmartOptimizeToRoute } from "./smartRoutingOptimizer";

const db = supabaseAdmin ?? supabase;

export type RouteAutomationMode = "manual_only" | "review_window" | "fully_automatic";

export interface RouteAutomationSettings {
  id: string;
  mode: RouteAutomationMode;
  review_window_minutes: number;
  auto_publish_cutoff_time: string | null; // "HH:MM:SS" or null
  require_smart_optimize: boolean;
  block_low_confidence: boolean;
  block_mock_geo: boolean;
  block_drive_cap_exceeded: boolean;
  enabled: boolean;
  // Platform Growth Phase 2 — earlier-stage automation, each independently
  // opt-in and disabled/safe by default.
  auto_generate_enabled: boolean;
  auto_optimize_enabled: boolean;
  auto_generate_time: string | null; // "HH:MM:SS" or null — no restriction
  auto_generate_days: string[] | null; // lowercase weekday names, e.g. ["monday"] — null/empty = every day
  require_admin_review_before_publish: boolean;
  allow_full_auto_publish: boolean;
  created_at: string;
  updated_at: string;
}

const DEFAULT_SETTINGS = {
  mode: "manual_only" as RouteAutomationMode,
  review_window_minutes: 60,
  auto_publish_cutoff_time: null,
  require_smart_optimize: true,
  block_low_confidence: true,
  block_mock_geo: true,
  block_drive_cap_exceeded: true,
  enabled: false,
  auto_generate_enabled: false,
  auto_optimize_enabled: false,
  auto_generate_time: null,
  auto_generate_days: null,
  require_admin_review_before_publish: true,
  allow_full_auto_publish: false,
};

/**
 * Reads the (singleton) route automation settings row, creating the default
 * disabled/manual_only row if one doesn't exist yet (e.g. migration ran but
 * the seed insert was skipped, or a fresh environment).
 */
export async function getRouteAutomationSettings(): Promise<RouteAutomationSettings> {
  const { data } = await db
    .from("route_automation_settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (data) return data as RouteAutomationSettings;

  const { data: created, error } = await db
    .from("route_automation_settings")
    .insert(DEFAULT_SETTINGS)
    .select("*")
    .single();

  if (error || !created) {
    // Fail safe to the most conservative in-memory default rather than throwing —
    // callers (auto-publish job, admin UI) must never crash because settings are missing.
    return { id: "", ...DEFAULT_SETTINGS, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  }

  return created as RouteAutomationSettings;
}

export async function updateRouteAutomationSettings(
  updates: Partial<Omit<RouteAutomationSettings, "id" | "created_at" | "updated_at">>
): Promise<RouteAutomationSettings> {
  const current = await getRouteAutomationSettings();

  const { data, error } = await db
    .from("route_automation_settings")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", current.id)
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to update route automation settings");
  return data as RouteAutomationSettings;
}

export interface AutoPublishEvaluation {
  routeId: string;
  eligible: boolean;
  reason?: string;
  blockers: string[];
}

/**
 * Evaluates whether a single route is safe to auto-publish under the given
 * (or current) settings. Pure read — does not mutate the route or write an
 * audit log entry; callers decide what to do with the result.
 */
export async function evaluateRouteForAutoPublish(
  routeId: string,
  settings?: RouteAutomationSettings
): Promise<AutoPublishEvaluation> {
  const s = settings ?? (await getRouteAutomationSettings());
  const blockers: string[] = [];

  const { data: route } = await db
    .from("routes")
    .select("id, status, employee_id, confidence, conflict_notes, total_duration_minutes, algorithm_version")
    .eq("id", routeId)
    .maybeSingle();

  if (!route) {
    return { routeId, eligible: false, reason: "route_not_found", blockers: ["Route not found"] };
  }

  // Never auto-publish a route that's already terminal or actively in progress.
  if (["completed", "canceled", "in_progress", "published"].includes((route as any).status)) {
    return {
      routeId,
      eligible: false,
      reason: "not_publishable_status",
      blockers: [`Route status is '${(route as any).status}' — not eligible for auto-publish`],
    };
  }

  if (!s.enabled || s.mode === "manual_only") {
    return { routeId, eligible: false, reason: "automation_disabled", blockers: ["Automation is disabled (manual_only mode)"] };
  }

  const confidence: string | null = (route as any).confidence ?? null;
  if (s.block_low_confidence && confidence === "low") {
    blockers.push("Route has low confidence (mostly estimated coordinates)");
  }

  const conflictNotes: string[] = (route as any).conflict_notes ?? [];
  const usesMockGeo = conflictNotes.some((n) => /mock|estimated|fallback geocod/i.test(n));
  if (s.block_mock_geo && usesMockGeo) {
    blockers.push("Route includes stops with estimated (mock) coordinates");
  }

  if (s.block_drive_cap_exceeded) {
    const { data: cap } = await db
      .from("technician_capacity_profiles")
      .select("max_drive_minutes_per_day")
      .eq("employee_id", (route as any).employee_id)
      .maybeSingle();

    const maxDriveMinutes = cap?.max_drive_minutes_per_day;
    const totalDuration = (route as any).total_duration_minutes;
    if (maxDriveMinutes != null && totalDuration != null && totalDuration > maxDriveMinutes) {
      blockers.push(
        `Estimated route duration (${Math.round(totalDuration)} min) exceeds technician's daily drive cap (${maxDriveMinutes} min)`
      );
    }
  }

  // require_smart_optimize is a gate, not a trigger — fully_automatic mode does not
  // itself invoke Smart Optimize. A route must already have been optimized (by an
  // admin, or a future scheduled job) to qualify; this keeps stop reordering a
  // deliberate, reviewable action rather than something automation does silently.
  if (s.require_smart_optimize && (route as any).algorithm_version !== "smart-nearest-neighbor-v1") {
    blockers.push("Route has not been Smart Optimized yet");
  }

  return { routeId, eligible: blockers.length === 0, blockers };
}

/**
 * Writes one row to route_audit_log for an automation decision. Every
 * automated action (or non-action) is recorded here so admins can see
 * exactly what the system did and why — same table used for all manual
 * route actions, just with actor_role = "system".
 */
export async function logAutomationDecision(params: {
  routeId: string;
  decision: "auto_approved" | "auto_published" | "blocked" | "approved_pending_admin_publish";
  mode: RouteAutomationMode;
  blockers?: string[];
}): Promise<void> {
  const { error } = await db.from("route_audit_log").insert({
    route_id: params.routeId,
    actor_id: null,
    actor_role: "system",
    action: `automation_${params.decision}`,
    metadata: { mode: params.mode, blockers: params.blockers ?? [] },
  });

  if (error) {
    console.error("[routeAutomationPolicy] Failed to write automation audit log:", error.message);
  }
}

export interface AutoPublishRunResult {
  checked: number;
  published: number;
  blocked: number;
  skipped: number;
  details: AutoPublishEvaluation[];
}

/**
 * Scans draft/approved routes for a given date and auto-publishes the ones
 * eligible under the current settings. No-op (zero side effects) unless
 * `enabled` is true and `mode` is review_window or fully_automatic.
 *
 * - review_window: a route must have existed for at least
 *   `review_window_minutes` before it's even evaluated, giving an admin time
 *   to intervene manually.
 * - fully_automatic: evaluated immediately, no wait.
 * - Both modes respect `auto_publish_cutoff_time` (don't auto-publish before
 *   that time of day) and all four safety toggles via evaluateRouteForAutoPublish.
 *
 * Intended to be called by a scheduled job (see netlify/functions/auto-publish-routes.ts)
 * but is also safe to call on-demand (e.g. from an admin "run now" action).
 */
export async function autoPublishEligibleRoutes(date: string): Promise<AutoPublishRunResult> {
  const settings = await getRouteAutomationSettings();

  if (!settings.enabled || settings.mode === "manual_only") {
    return { checked: 0, published: 0, blocked: 0, skipped: 0, details: [] };
  }

  const { data: candidates } = await db
    .from("routes")
    .select("id, status, created_at")
    .eq("date", date)
    .in("status", ["draft", "approved"]);

  const rows = candidates ?? [];
  const details: AutoPublishEvaluation[] = [];
  let published = 0;
  let blocked = 0;
  let skipped = 0;

  for (const route of rows as any[]) {
    if (settings.mode === "review_window") {
      const elapsedMs = Date.now() - new Date(route.created_at).getTime();
      if (elapsedMs < settings.review_window_minutes * 60_000) {
        skipped++;
        continue; // still inside the human review window — leave untouched
      }
    }

    if (settings.auto_publish_cutoff_time) {
      const [h, m] = settings.auto_publish_cutoff_time.split(":").map(Number);
      const cutoff = new Date();
      cutoff.setHours(h, m, 0, 0);
      if (new Date() < cutoff) {
        skipped++;
        continue; // not yet past the configured cutoff time of day
      }
    }

    const evaluation = await evaluateRouteForAutoPublish(route.id, settings);
    details.push(evaluation);

    if (!evaluation.eligible) {
      await logAutomationDecision({ routeId: route.id, decision: "blocked", blockers: evaluation.blockers, mode: settings.mode });
      blocked++;
      continue;
    }

    const now = new Date().toISOString();

    if (route.status === "draft") {
      await db.from("routes").update({ status: "approved", approved_at: now }).eq("id", route.id);
      await logAutomationDecision({ routeId: route.id, decision: "auto_approved", mode: settings.mode });
    }

    // Two independent gates must both clear before automation is allowed to
    // actually publish (vs. stop at approved): require_admin_review_before_publish
    // defaults TRUE (safe), and allow_full_auto_publish defaults FALSE (safe).
    // A route can be auto-approved without either of these — only the final
    // publish step is gated this strictly.
    const canFullyAutoPublish = !settings.require_admin_review_before_publish && settings.allow_full_auto_publish;

    if (!canFullyAutoPublish) {
      await logAutomationDecision({
        routeId: route.id,
        decision: "approved_pending_admin_publish",
        mode: settings.mode,
        blockers: [
          settings.require_admin_review_before_publish ? "require_admin_review_before_publish is true" : null,
          !settings.allow_full_auto_publish ? "allow_full_auto_publish is false" : null,
        ].filter(Boolean) as string[],
      });
      continue; // stops at approved — an admin must publish manually
    }

    await db.from("routes").update({ status: "published", published_at: now, locked_at: now }).eq("id", route.id);
    await logAutomationDecision({ routeId: route.id, decision: "auto_published", mode: settings.mode });
    published++;
  }

  return { checked: rows.length, published, blocked, skipped, details };
}

export interface AutoGenerateRunResult {
  ranAt: string;
  generatedDates: string[];
  skippedReason?: "disabled" | "day_not_allowed" | "before_generate_time";
  routesGenerated: number;
  routesOptimized: number;
  errors: string[];
}

function isAllowedDay(settings: RouteAutomationSettings, now: Date): boolean {
  if (!settings.auto_generate_days || settings.auto_generate_days.length === 0) return true;
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  return settings.auto_generate_days.map((d) => d.toLowerCase()).includes(dayName);
}

function isPastGenerateTime(settings: RouteAutomationSettings, now: Date): boolean {
  if (!settings.auto_generate_time) return true;
  const [h, m] = settings.auto_generate_time.split(":").map(Number);
  const allowed = new Date(now);
  allowed.setHours(h, m, 0, 0);
  return now >= allowed;
}

/**
 * Auto-generates draft day plans for the given dates (typically "today" and
 * "tomorrow"), and — if auto_optimize_enabled — immediately runs Smart
 * Optimize on each freshly-generated route. No-op unless
 * auto_generate_enabled is true, and further gated by auto_generate_days /
 * auto_generate_time. Never touches publish status — generated routes land
 * in 'draft', same as a manual "Generate Day Plan" click; whether they ever
 * get approved/published is entirely up to autoPublishEligibleRoutes() and
 * its own independent gates.
 *
 * Intended to be called by the same scheduled sweep that calls
 * autoPublishEligibleRoutes() (see netlify/functions/auto-publish-routes.ts).
 */
export async function autoGenerateAndOptimizeDayPlans(dates: string[]): Promise<AutoGenerateRunResult> {
  const settings = await getRouteAutomationSettings();
  const now = new Date();
  const result: AutoGenerateRunResult = {
    ranAt: now.toISOString(),
    generatedDates: [],
    routesGenerated: 0,
    routesOptimized: 0,
    errors: [],
  };

  if (!settings.auto_generate_enabled) {
    result.skippedReason = "disabled";
    return result;
  }
  if (!isAllowedDay(settings, now)) {
    result.skippedReason = "day_not_allowed";
    return result;
  }
  if (!isPastGenerateTime(settings, now)) {
    result.skippedReason = "before_generate_time";
    return result;
  }

  for (const date of dates) {
    try {
      const generated = await generateDayPlan(date, { actorId: null, actorRole: "system" });
      if (generated.blocked_reason) continue; // e.g. company blackout — already logged by generateDayPlan
      result.generatedDates.push(date);
      result.routesGenerated += generated.routes.length;

      if (settings.auto_optimize_enabled) {
        for (const route of generated.routes) {
          try {
            const optimized = await applySmartOptimizeToRoute(route.id, null, "system");
            if (optimized.success) result.routesOptimized++;
          } catch (err: any) {
            result.errors.push(`optimize route ${route.id}: ${err.message}`);
          }
        }
      }
    } catch (err: any) {
      result.errors.push(`generate ${date}: ${err.message}`);
    }
  }

  return result;
}
