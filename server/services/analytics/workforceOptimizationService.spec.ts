import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../lib/supabaseAdmin", async () => {
  const { createFakeSupabase } = await import("../../testUtils/fakeSupabase");
  return { supabaseAdmin: createFakeSupabase() };
});
vi.mock("../../lib/supabase", () => ({ supabase: null }));

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import type { FakeSupabase } from "../../testUtils/fakeSupabase";
import { getWorkforceOptimization } from "./workforceOptimizationService";

const fakeDb = supabaseAdmin as unknown as FakeSupabase;

beforeEach(() => {
  for (const table of Object.keys(fakeDb.tables)) fakeDb.tables[table] = [];
});

const WINDOW = { dateFrom: "2026-06-15", dateTo: "2026-06-21" }; // 7 days, all Mon-Sun

describe("getWorkforceOptimization — empty data safe behavior", () => {
  it("returns empty arrays with no error when every table is empty", async () => {
    const result = await getWorkforceOptimization(WINDOW);
    expect(result.technician_utilization).toEqual([]);
    expect(result.territory_staffing).toEqual([]);
    expect(result.capacity_forecast).toHaveLength(7);
    result.capacity_forecast.forEach((row) => {
      expect(row.available_technicians).toBe(0);
      expect(row.total_stop_capacity).toBe(0);
      expect(row.scheduled_stops).toBe(0);
      expect(row.recommendation).toBe("no_action_needed");
    });
  });

  it("skips inactive employees entirely", async () => {
    await fakeDb.from("employees").insert({ id: "emp-inactive", role: "technician", status: "inactive", default_max_stops: 8, service_area_ids: [] });
    const result = await getWorkforceOptimization(WINDOW);
    expect(result.technician_utilization).toHaveLength(0);
  });
});

describe("getWorkforceOptimization — utilization calculation", () => {
  it("computes capacity from the global default (8) when no profile/template exists", async () => {
    await fakeDb.from("employees").insert({ id: "emp-1", role: "technician", status: "active", default_max_stops: null, service_area_ids: [] });

    const result = await getWorkforceOptimization(WINDOW);
    const row = result.technician_utilization[0];
    expect(row.available_days).toBe(7);
    expect(row.capacity).toBe(7 * 8); // 7 days * global default 8
  });

  it("uses the employee's default_max_stops when set", async () => {
    await fakeDb.from("employees").insert({ id: "emp-2", role: "technician", status: "active", default_max_stops: 5, service_area_ids: [] });

    const result = await getWorkforceOptimization(WINDOW);
    const row = result.technician_utilization[0];
    expect(row.capacity).toBe(7 * 5);
  });

  it("uses technician_capacity_profiles.max_stops_per_day over the employee default", async () => {
    await fakeDb.from("employees").insert({ id: "emp-3", role: "technician", status: "active", default_max_stops: 5, service_area_ids: [] });
    await fakeDb.from("technician_capacity_profiles").insert({ employee_id: "emp-3", max_stops_per_day: 12 });

    const result = await getWorkforceOptimization(WINDOW);
    const row = result.technician_utilization[0];
    expect(row.capacity).toBe(7 * 12);
  });

  it("excludes company-blackout days from available_days and capacity", async () => {
    await fakeDb.from("employees").insert({ id: "emp-4", role: "technician", status: "active", default_max_stops: 8, service_area_ids: [] });
    await fakeDb.from("blackout_dates").insert({ date: "2026-06-17", scope: "all" });

    const result = await getWorkforceOptimization(WINDOW);
    const row = result.technician_utilization[0];
    expect(row.available_days).toBe(6);
    expect(row.capacity).toBe(6 * 8);
  });

  it("counts scheduled and completed appointments from assignments", async () => {
    await fakeDb.from("employees").insert({ id: "emp-5", role: "technician", status: "active", default_max_stops: 8, service_area_ids: [] });
    await fakeDb.from("assignments").insert({ employee_id: "emp-5", appointment_id: "a1", status: "completed" });
    await fakeDb.from("assignments").insert({ employee_id: "emp-5", appointment_id: "a2", status: "scheduled" });

    const result = await getWorkforceOptimization(WINDOW);
    const row = result.technician_utilization[0];
    expect(row.scheduled_appointments).toBe(2);
    expect(row.completed_appointments).toBe(1);
  });
});

describe("getWorkforceOptimization — overload and underutilization detection", () => {
  it("flags overload_warning when scheduled appointments exceed capacity", async () => {
    await fakeDb.from("employees").insert({ id: "emp-over", role: "technician", status: "active", default_max_stops: 1, service_area_ids: [] });
    for (let i = 0; i < 20; i++) {
      await fakeDb.from("assignments").insert({ employee_id: "emp-over", appointment_id: `a${i}`, status: "scheduled" });
    }

    const result = await getWorkforceOptimization(WINDOW);
    const row = result.technician_utilization[0];
    expect(row.utilization_pct).toBeGreaterThan(100);
    expect(row.overload_warning).toBe(true);
    expect(row.overload_reason).toMatch(/exceed/);
  });

  it("does not flag overload for a lightly-scheduled technician (underutilization is visible via a low utilization_pct, not a separate flag)", async () => {
    await fakeDb.from("employees").insert({ id: "emp-under", role: "technician", status: "active", default_max_stops: 8, service_area_ids: [] });
    await fakeDb.from("assignments").insert({ employee_id: "emp-under", appointment_id: "a1", status: "scheduled" });

    const result = await getWorkforceOptimization(WINDOW);
    const row = result.technician_utilization[0];
    expect(row.overload_warning).toBe(false);
    expect(row.utilization_pct).toBeLessThan(50);
  });

  it("reports utilization_pct as null (not a division-by-zero artifact) when capacity is 0", async () => {
    await fakeDb.from("employees").insert({ id: "emp-noavail", role: "technician", status: "active", default_max_stops: 8, service_area_ids: [] });
    for (const d of ["2026-06-15", "2026-06-16", "2026-06-17", "2026-06-18", "2026-06-19", "2026-06-20", "2026-06-21"]) {
      await fakeDb.from("blackout_dates").insert({ date: d, scope: "all" });
    }

    const result = await getWorkforceOptimization(WINDOW);
    const row = result.technician_utilization[0];
    expect(row.capacity).toBe(0);
    expect(row.utilization_pct).toBeNull();
  });
});

describe("getWorkforceOptimization — capacity forecast recommendation generation", () => {
  it("recommends add_technician when over capacity with zero available technicians", async () => {
    await fakeDb.from("properties").insert({ id: "p1", zip: "92602" });
    await fakeDb.from("appointments").insert({ id: "a1", property_id: "p1", status: "scheduled", scheduled_date: "2026-06-17" });

    const result = await getWorkforceOptimization(WINDOW);
    const row = result.capacity_forecast.find((r) => r.date === "2026-06-17")!;
    expect(row.demand_pressure).toBe("over_capacity");
    expect(row.recommendation).toBe("add_technician");
  });

  it("recommends reduce_active_zips_temporarily when over capacity but some technicians are available", async () => {
    await fakeDb.from("employees").insert({ id: "emp-1", role: "technician", status: "active", default_max_stops: 1, service_area_ids: [] });
    await fakeDb.from("properties").insert({ id: "p1", zip: "92602" });
    for (let i = 0; i < 3; i++) {
      await fakeDb.from("appointments").insert({ id: `a${i}`, property_id: "p1", status: "scheduled", scheduled_date: "2026-06-17" });
    }

    const result = await getWorkforceOptimization(WINDOW);
    const row = result.capacity_forecast.find((r) => r.date === "2026-06-17")!;
    expect(row.demand_pressure).toBe("over_capacity");
    expect(row.recommendation).toBe("reduce_active_zips_temporarily");
  });

  it("recommends no_action_needed when demand is well under capacity", async () => {
    await fakeDb.from("employees").insert({ id: "emp-1", role: "technician", status: "active", default_max_stops: 8, service_area_ids: [] });

    const result = await getWorkforceOptimization(WINDOW);
    const row = result.capacity_forecast[0];
    expect(row.demand_pressure).toBe("low");
    expect(row.recommendation).toBe("no_action_needed");
  });

  it("recommends rebalance_routes when demand is high (85-100% of capacity) but not yet over", async () => {
    // 20 stops of capacity, 18 scheduled -> 90% — the "high" band between
    // moderate (watch_demand) and over_capacity (add_technician /
    // reduce_active_zips_temporarily), previously untested.
    await fakeDb.from("employees").insert({ id: "emp-1", role: "technician", status: "active", default_max_stops: 20, service_area_ids: [] });
    await fakeDb.from("properties").insert({ id: "p1", zip: "92602" });
    for (let i = 0; i < 18; i++) {
      await fakeDb.from("appointments").insert({ id: `a${i}`, property_id: "p1", status: "scheduled", scheduled_date: "2026-06-17" });
    }

    const result = await getWorkforceOptimization(WINDOW);
    const row = result.capacity_forecast.find((r) => r.date === "2026-06-17")!;
    expect(row.demand_pressure).toBe("high");
    expect(row.recommendation).toBe("rebalance_routes");
  });
});

describe("getWorkforceOptimization — territory staffing recommendation generation", () => {
  it("recommends add_coverage_in_county when there is demand but zero technician coverage", async () => {
    await fakeDb.from("service_areas").insert({ id: "sa-1", zip: "92602", city: "Irvine", county: "Orange", state: "CA", is_active: true, capacity: 50 });
    await fakeDb.from("properties").insert({ id: "p1", zip: "92602" });
    await fakeDb.from("appointments").insert({ id: "a1", property_id: "p1", status: "scheduled", scheduled_date: "2026-06-17", scheduled_at: "2026-06-17T08:00:00Z" });

    const result = await getWorkforceOptimization(WINDOW);
    const row = result.territory_staffing.find((r) => r.county === "Orange")!;
    expect(row.technician_coverage).toBe(0);
    expect(row.recommendation).toBe("add_coverage_in_county");
  });

  it("counts a technician as covering a county only when service_area_ids includes a service area in that county", async () => {
    await fakeDb.from("service_areas").insert({ id: "sa-1", zip: "92602", city: "Irvine", county: "Orange", state: "CA", is_active: true, capacity: 50 });
    await fakeDb.from("employees").insert({ id: "emp-cov", role: "technician", status: "active", default_max_stops: 8, service_area_ids: ["sa-1"] });

    const result = await getWorkforceOptimization(WINDOW);
    const row = result.territory_staffing.find((r) => r.county === "Orange")!;
    expect(row.technician_coverage).toBe(1);
  });
});
