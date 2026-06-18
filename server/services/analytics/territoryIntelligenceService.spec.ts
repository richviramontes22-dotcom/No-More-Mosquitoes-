import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../lib/supabaseAdmin", async () => {
  const { createFakeSupabase } = await import("../../testUtils/fakeSupabase");
  return { supabaseAdmin: createFakeSupabase() };
});
vi.mock("../../lib/supabase", () => ({ supabase: null }));

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import type { FakeSupabase } from "../../testUtils/fakeSupabase";
import { getTerritoryIntelligence } from "./territoryIntelligenceService";

const fakeDb = supabaseAdmin as unknown as FakeSupabase;

beforeEach(() => {
  for (const table of Object.keys(fakeDb.tables)) fakeDb.tables[table] = [];
});

describe("getTerritoryIntelligence — empty data safe behavior", () => {
  it("returns empty zips/counties with no error when every table is empty", async () => {
    const result = await getTerritoryIntelligence();
    expect(result.zips).toEqual([]);
    expect(result.counties).toEqual([]);
  });
});

describe("getTerritoryIntelligence — active ZIP aggregation", () => {
  it("aggregates demand, customers, appointments, subscriptions, and revenue for an active ZIP", async () => {
    await fakeDb.from("service_areas").insert({ zip: "92602", city: "Irvine", county: "Orange", state: "CA", is_active: true, capacity: 50 });
    await fakeDb.from("leads").insert({ id: "lead-1", zip: "92602", created_at: "2026-06-01T00:00:00Z" });
    await fakeDb.from("leads").insert({ id: "lead-2", zip: "92602", created_at: "2026-06-02T00:00:00Z" });
    await fakeDb.from("properties").insert({ id: "prop-1", zip: "92602" });
    await fakeDb.from("appointments").insert({ id: "appt-1", property_id: "prop-1", scheduled_at: "2026-06-10T08:00:00Z" });
    await fakeDb.from("subscriptions").insert({ id: "sub-1", property_id: "prop-1", status: "active", amount_cents: 10000 });

    const result = await getTerritoryIntelligence();
    const row = result.zips.find((z) => z.zip === "92602");

    expect(row).toBeDefined();
    expect(row!.service_status).toBe("active");
    expect(row!.demand_count).toBe(2);
    expect(row!.customer_count).toBe(1);
    expect(row!.appointment_count).toBe(1);
    expect(row!.subscription_count).toBe(1);
    expect(row!.estimated_revenue_cents).toBe(10000);
  });

  it("normalizes ZIP+4 property zips to 5 digits when joining", async () => {
    await fakeDb.from("service_areas").insert({ zip: "92653", city: "Laguna Hills", county: "Orange", state: "CA", is_active: true, capacity: 20 });
    await fakeDb.from("properties").insert({ id: "prop-zip4", zip: "92653-1143" });
    await fakeDb.from("appointments").insert({ id: "appt-zip4", property_id: "prop-zip4", scheduled_at: "2026-06-10T08:00:00Z" });

    const result = await getTerritoryIntelligence();
    const row = result.zips.find((z) => z.zip === "92653");
    expect(row?.appointment_count).toBe(1);
  });
});

describe("getTerritoryIntelligence — out-of-area ZIP aggregation", () => {
  it("surfaces a ZIP with no service_areas row as 'unmapped' rather than dropping it", async () => {
    await fakeDb.from("service_area_demand_events").insert({ zip: "79936", event_type: "out_of_area_quote", created_at: "2026-06-01T00:00:00Z" });
    await fakeDb.from("service_area_demand_events").insert({ zip: "79936", event_type: "waitlist_signup", created_at: "2026-06-02T00:00:00Z" });

    const result = await getTerritoryIntelligence();
    const row = result.zips.find((z) => z.zip === "79936");

    expect(row).toBeDefined();
    expect(row!.service_status).toBe("unmapped");
    expect(row!.out_of_area_count).toBe(2);
    expect(row!.city).toBeNull();
    expect(row!.county).toBeNull();
  });

  it("counts out-of-area events separately from an inactive service_areas row", async () => {
    await fakeDb.from("service_areas").insert({ zip: "92301", city: "Adelanto", county: "San Bernardino", state: "CA", is_active: false, capacity: 10 });
    await fakeDb.from("service_area_demand_events").insert({ zip: "92301", event_type: "out_of_area_quote", created_at: "2026-06-01T00:00:00Z" });

    const result = await getTerritoryIntelligence();
    const row = result.zips.find((z) => z.zip === "92301");
    expect(row!.service_status).toBe("inactive");
    expect(row!.out_of_area_count).toBe(1);
  });
});

describe("getTerritoryIntelligence — score calculation", () => {
  it("computes opportunity_score exactly per the documented formula with no penalty", async () => {
    await fakeDb.from("service_areas").insert({ zip: "92618", city: "Irvine", county: "Orange", state: "CA", is_active: true, capacity: 100 });
    await fakeDb.from("leads").insert({ id: "l1", zip: "92618", created_at: "2026-06-01T00:00:00Z" });
    await fakeDb.from("service_area_demand_events").insert({ zip: "92618", event_type: "waitlist_signup", created_at: "2026-06-01T00:00:00Z" });
    await fakeDb.from("properties").insert({ id: "p1", zip: "92618" });
    await fakeDb.from("appointments").insert({ id: "a1", property_id: "p1", scheduled_at: "2026-06-05T00:00:00Z" });
    await fakeDb.from("subscriptions").insert({ id: "s1", property_id: "p1", status: "active", amount_cents: 5000 });

    const result = await getTerritoryIntelligence();
    const row = result.zips.find((z) => z.zip === "92618")!;

    // demand=1*3 + out_of_area=1*4 + customers=1*5 + appts=1*2 + subs=1*8 - penalty(0)
    expect(row.score_breakdown.demand_component).toBe(3);
    expect(row.score_breakdown.out_of_area_component).toBe(4);
    expect(row.score_breakdown.customer_component).toBe(5);
    expect(row.score_breakdown.appointment_component).toBe(2);
    expect(row.score_breakdown.subscription_component).toBe(8);
    expect(row.score_breakdown.penalty).toBe(0);
    expect(row.opportunity_score).toBe(3 + 4 + 5 + 2 + 8);
  });

  it("applies the capacity penalty when an active ZIP's customer count is at/over capacity", async () => {
    await fakeDb.from("service_areas").insert({ zip: "92660", city: "Newport Beach", county: "Orange", state: "CA", is_active: true, capacity: 1 });
    await fakeDb.from("properties").insert({ id: "p1", zip: "92660" });
    await fakeDb.from("subscriptions").insert({ id: "s1", property_id: "p1", status: "active", amount_cents: 1000 });

    const result = await getTerritoryIntelligence();
    const row = result.zips.find((z) => z.zip === "92660")!;
    expect(row.score_breakdown.penalty).toBe(10);
    expect(row.score_breakdown.penalty_reason).toMatch(/capacity/);
  });
});

describe("getTerritoryIntelligence — recommendation generation", () => {
  it("recommends expansion_candidate for an inactive ZIP with strong demand", async () => {
    await fakeDb.from("service_areas").insert({ zip: "92880", city: "Corona", county: "Riverside", state: "CA", is_active: false, capacity: 10 });
    for (let i = 0; i < 3; i++) {
      await fakeDb.from("leads").insert({ id: `lead-${i}`, zip: "92880", created_at: "2026-06-01T00:00:00Z" });
    }

    const result = await getTerritoryIntelligence();
    const row = result.zips.find((z) => z.zip === "92880")!;
    expect(row.recommendation).toBe("expansion_candidate");
  });

  it("recommends activate_zip for an inactive ZIP with light demand", async () => {
    await fakeDb.from("service_areas").insert({ zip: "92881", city: "Corona", county: "Riverside", state: "CA", is_active: false, capacity: 10 });
    await fakeDb.from("leads").insert({ id: "lead-x", zip: "92881", created_at: "2026-06-01T00:00:00Z" });

    const result = await getTerritoryIntelligence();
    const row = result.zips.find((z) => z.zip === "92881")!;
    expect(row.recommendation).toBe("activate_zip");
  });

  it("recommends low_priority for an inactive ZIP with zero signal", async () => {
    await fakeDb.from("service_areas").insert({ zip: "92882", city: "Corona", county: "Riverside", state: "CA", is_active: false, capacity: 10 });

    const result = await getTerritoryIntelligence();
    const row = result.zips.find((z) => z.zip === "92882")!;
    expect(row.recommendation).toBe("low_priority");
  });

  it("recommends add_technician_capacity for an active ZIP at capacity", async () => {
    await fakeDb.from("service_areas").insert({ zip: "92691", city: "Mission Viejo", county: "Orange", state: "CA", is_active: true, capacity: 1 });
    await fakeDb.from("properties").insert({ id: "p1", zip: "92691" });
    await fakeDb.from("subscriptions").insert({ id: "s1", property_id: "p1", status: "active", amount_cents: 1000 });

    const result = await getTerritoryIntelligence();
    const row = result.zips.find((z) => z.zip === "92691")!;
    expect(row.recommendation).toBe("add_technician_capacity");
  });

  it("recommends review_manually for an active ZIP with zero activity of any kind", async () => {
    await fakeDb.from("service_areas").insert({ zip: "92692", city: "Mission Viejo", county: "Orange", state: "CA", is_active: true, capacity: 20 });

    const result = await getTerritoryIntelligence();
    const row = result.zips.find((z) => z.zip === "92692")!;
    expect(row.recommendation).toBe("review_manually");
  });
});

describe("getTerritoryIntelligence — filters", () => {
  it("filters by area_filter=out_of_area to exclude active ZIPs", async () => {
    await fakeDb.from("service_areas").insert({ zip: "92701", city: "Santa Ana", county: "Orange", state: "CA", is_active: true, capacity: 10 });
    await fakeDb.from("service_area_demand_events").insert({ zip: "00000", event_type: "out_of_area_quote", created_at: "2026-06-01T00:00:00Z" });

    const result = await getTerritoryIntelligence({ areaFilter: "out_of_area" });
    expect(result.zips.find((z) => z.zip === "92701")).toBeUndefined();
    expect(result.zips.find((z) => z.zip === "00000")).toBeDefined();
  });
});
