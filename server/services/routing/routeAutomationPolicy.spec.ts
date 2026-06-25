import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../lib/supabaseAdmin", async () => {
  const { createFakeSupabase } = await import("../../testUtils/fakeSupabase");
  return { supabaseAdmin: createFakeSupabase() };
});
vi.mock("../../lib/supabase", () => ({ supabase: null }));

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import type { FakeSupabase } from "../../testUtils/fakeSupabase";
import {
  getRouteAutomationSettings,
  evaluateRouteForAutoPublish,
  autoPublishEligibleRoutes,
  autoGenerateAndOptimizeDayPlans,
} from "./routeAutomationPolicy";

const fakeDb = supabaseAdmin as unknown as FakeSupabase;

beforeEach(() => {
  for (const table of Object.keys(fakeDb.tables)) fakeDb.tables[table] = [];
});

describe("getRouteAutomationSettings — defaults", () => {
  it("creates a safe-by-default row when none exists", async () => {
    const settings = await getRouteAutomationSettings();

    expect(settings.mode).toBe("manual_only");
    expect(settings.enabled).toBe(false);
    expect(settings.auto_generate_enabled).toBe(false);
    expect(settings.auto_optimize_enabled).toBe(false);
    expect(settings.require_admin_review_before_publish).toBe(true);
    expect(settings.allow_full_auto_publish).toBe(false);
  });
});

describe("autoGenerateAndOptimizeDayPlans — disabled by default", () => {
  it("no-ops without touching routes/appointments when auto_generate_enabled is false", async () => {
    fakeDb.tables.appointments = [{ id: "appt-1", status: "scheduled", scheduled_at: "2026-06-19T08:00:00Z" }];

    const result = await autoGenerateAndOptimizeDayPlans(["2026-06-19"]);

    expect(result.skippedReason).toBe("disabled");
    expect(result.routesGenerated).toBe(0);
    expect(result.routesOptimized).toBe(0);
    expect(fakeDb.tables.routes ?? []).toHaveLength(0);
  });

  it("still no-ops when explicitly disabled even with auto_optimize_enabled true", async () => {
    await fakeDb.from("route_automation_settings").insert({
      mode: "manual_only", enabled: false,
      auto_generate_enabled: false, auto_optimize_enabled: true,
      require_admin_review_before_publish: true, allow_full_auto_publish: false,
    });

    const result = await autoGenerateAndOptimizeDayPlans(["2026-06-19"]);
    expect(result.skippedReason).toBe("disabled");
    expect(result.routesGenerated).toBe(0);
  });
});

describe("evaluateRouteForAutoPublish — hard blockers", () => {
  const baseSettings = {
    id: "s1", mode: "fully_automatic" as const, review_window_minutes: 60,
    auto_publish_cutoff_time: null, require_smart_optimize: true,
    block_low_confidence: true, block_mock_geo: true, block_drive_cap_exceeded: true,
    enabled: true,
    auto_generate_enabled: false, auto_optimize_enabled: false,
    auto_generate_time: null, auto_generate_days: null,
    // Both full-auto-publish gates wide open — the most permissive possible config.
    require_admin_review_before_publish: false, allow_full_auto_publish: true,
    created_at: "", updated_at: "",
  };

  it("blocks a low-confidence route even with full auto-publish gates open", async () => {
    await fakeDb.from("routes").insert({
      id: "route-low-conf", status: "draft", employee_id: "tech-1",
      confidence: "low", conflict_notes: [], total_duration_minutes: 100,
      algorithm_version: "smart-nearest-neighbor-v1",
    });
    const routeId = fakeDb.tables.routes[0].id;

    const evaluation = await evaluateRouteForAutoPublish(routeId, baseSettings);
    expect(evaluation.eligible).toBe(false);
    expect(evaluation.blockers.some((b) => /low confidence/.test(b))).toBe(true);
  });

  it("blocks a route with mock/estimated geo even with full auto-publish gates open", async () => {
    await fakeDb.from("routes").insert({
      id: "route-mock-geo", status: "approved", employee_id: "tech-1",
      confidence: "medium", conflict_notes: ["Stop at 123 Main uses estimated coordinates."],
      total_duration_minutes: 100, algorithm_version: "smart-nearest-neighbor-v1",
    });
    const routeId = fakeDb.tables.routes[0].id;

    const evaluation = await evaluateRouteForAutoPublish(routeId, baseSettings);
    expect(evaluation.eligible).toBe(false);
    expect(evaluation.blockers.some((b) => /estimated/.test(b))).toBe(true);
  });

  it("blocks a route that exceeds the technician's drive cap", async () => {
    await fakeDb.from("technician_capacity_profiles").insert({ employee_id: "tech-cap", max_drive_minutes_per_day: 60 });
    await fakeDb.from("routes").insert({
      id: "route-over-cap", status: "draft", employee_id: "tech-cap",
      confidence: "high", conflict_notes: [], total_duration_minutes: 200,
      algorithm_version: "smart-nearest-neighbor-v1",
    });
    const routeId = fakeDb.tables.routes[0].id;

    const evaluation = await evaluateRouteForAutoPublish(routeId, baseSettings);
    expect(evaluation.eligible).toBe(false);
    expect(evaluation.blockers.some((b) => /drive cap/.test(b))).toBe(true);
  });

  it("allows a clean route through (eligible: true) when no blockers apply", async () => {
    await fakeDb.from("routes").insert({
      id: "route-clean", status: "draft", employee_id: "tech-clean",
      confidence: "high", conflict_notes: [], total_duration_minutes: 100,
      algorithm_version: "smart-nearest-neighbor-v1",
    });
    const routeId = fakeDb.tables.routes[0].id;

    const evaluation = await evaluateRouteForAutoPublish(routeId, baseSettings);
    expect(evaluation.eligible).toBe(true);
    expect(evaluation.blockers).toHaveLength(0);
  });
});

describe("autoPublishEligibleRoutes — full auto-publish gating", () => {
  it("stops a clean, eligible route at 'approved' when require_admin_review_before_publish is true (the default)", async () => {
    await fakeDb.from("route_automation_settings").insert({
      mode: "fully_automatic", enabled: true,
      review_window_minutes: 60, auto_publish_cutoff_time: null,
      require_smart_optimize: true, block_low_confidence: true, block_mock_geo: true, block_drive_cap_exceeded: true,
      auto_generate_enabled: false, auto_optimize_enabled: false, auto_generate_time: null, auto_generate_days: null,
      require_admin_review_before_publish: true, // default safe gate — still true
      allow_full_auto_publish: true,
    });
    await fakeDb.from("routes").insert({
      id: "route-gate-test", status: "draft", date: "2026-06-19", employee_id: "tech-1",
      confidence: "high", conflict_notes: [], total_duration_minutes: 100,
      algorithm_version: "smart-nearest-neighbor-v1", created_at: new Date(0).toISOString(),
    });

    const result = await autoPublishEligibleRoutes("2026-06-19");

    expect(result.published).toBe(0);
    const route = fakeDb.tables.routes.find((r: any) => r.id === "route-gate-test");
    expect(route.status).toBe("approved"); // auto-approved, but not published
  });

  it("fully publishes a clean route only when both gates are explicitly opened", async () => {
    await fakeDb.from("route_automation_settings").insert({
      mode: "fully_automatic", enabled: true,
      review_window_minutes: 60, auto_publish_cutoff_time: null,
      require_smart_optimize: true, block_low_confidence: true, block_mock_geo: true, block_drive_cap_exceeded: true,
      auto_generate_enabled: false, auto_optimize_enabled: false, auto_generate_time: null, auto_generate_days: null,
      require_admin_review_before_publish: false,
      allow_full_auto_publish: true,
    });
    await fakeDb.from("routes").insert({
      id: "route-fully-open", status: "draft", date: "2026-06-19", employee_id: "tech-1",
      confidence: "high", conflict_notes: [], total_duration_minutes: 100,
      algorithm_version: "smart-nearest-neighbor-v1", created_at: new Date(0).toISOString(),
    });

    const result = await autoPublishEligibleRoutes("2026-06-19");

    expect(result.published).toBe(1);
    const route = fakeDb.tables.routes.find((r: any) => r.id === "route-fully-open");
    expect(route.status).toBe("published");
  });

  it("never publishes a blocked route even with both gates open", async () => {
    await fakeDb.from("route_automation_settings").insert({
      mode: "fully_automatic", enabled: true,
      review_window_minutes: 60, auto_publish_cutoff_time: null,
      require_smart_optimize: true, block_low_confidence: true, block_mock_geo: true, block_drive_cap_exceeded: true,
      auto_generate_enabled: false, auto_optimize_enabled: false, auto_generate_time: null, auto_generate_days: null,
      require_admin_review_before_publish: false,
      allow_full_auto_publish: true,
    });
    await fakeDb.from("routes").insert({
      id: "route-blocked", status: "draft", date: "2026-06-19", employee_id: "tech-1",
      confidence: "low", conflict_notes: [], total_duration_minutes: 100,
      algorithm_version: "smart-nearest-neighbor-v1", created_at: new Date(0).toISOString(),
    });

    const result = await autoPublishEligibleRoutes("2026-06-19");

    expect(result.published).toBe(0);
    expect(result.blocked).toBe(1);
    const route = fakeDb.tables.routes.find((r: any) => r.id === "route-blocked");
    expect(route.status).toBe("draft");
  });
});

describe("autoPublishEligibleRoutes — review_window timing", () => {
  // Every other test in this file uses mode: "fully_automatic" (no wait) or an
  // artificially ancient created_at that incidentally clears any window —
  // the review_window mode's actual "is this route still too new" branch had
  // no dedicated coverage.
  const reviewWindowSettings = {
    mode: "review_window" as const, enabled: true,
    review_window_minutes: 60, auto_publish_cutoff_time: null,
    require_smart_optimize: true, block_low_confidence: true, block_mock_geo: true, block_drive_cap_exceeded: true,
    auto_generate_enabled: false, auto_optimize_enabled: false, auto_generate_time: null, auto_generate_days: null,
    require_admin_review_before_publish: false, allow_full_auto_publish: true,
  };

  it("skips a route still inside the review window, leaving it untouched", async () => {
    await fakeDb.from("route_automation_settings").insert(reviewWindowSettings);
    await fakeDb.from("routes").insert({
      id: "route-too-new", status: "draft", date: "2026-06-19", employee_id: "tech-1",
      confidence: "high", conflict_notes: [], total_duration_minutes: 100,
      algorithm_version: "smart-nearest-neighbor-v1",
      created_at: new Date().toISOString(), // created "now" — well inside a 60-minute window
    });

    const result = await autoPublishEligibleRoutes("2026-06-19");

    expect(result.skipped).toBe(1);
    expect(result.published).toBe(0);
    expect(result.blocked).toBe(0);
    const route = fakeDb.tables.routes.find((r: any) => r.id === "route-too-new");
    expect(route.status).toBe("draft"); // untouched
  });

  it("publishes a route once it has aged past the review window", async () => {
    await fakeDb.from("route_automation_settings").insert(reviewWindowSettings);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
    await fakeDb.from("routes").insert({
      id: "route-aged-out", status: "draft", date: "2026-06-19", employee_id: "tech-1",
      confidence: "high", conflict_notes: [], total_duration_minutes: 100,
      algorithm_version: "smart-nearest-neighbor-v1",
      created_at: twoHoursAgo, // 2h old, past the 60-minute window
    });

    const result = await autoPublishEligibleRoutes("2026-06-19");

    expect(result.skipped).toBe(0);
    expect(result.published).toBe(1);
    const route = fakeDb.tables.routes.find((r: any) => r.id === "route-aged-out");
    expect(route.status).toBe("published");
  });
});
