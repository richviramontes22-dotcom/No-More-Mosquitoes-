import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../lib/supabaseAdmin", async () => {
  const { createFakeSupabase } = await import("../../testUtils/fakeSupabase");
  return { supabaseAdmin: createFakeSupabase({}, {}) };
});
vi.mock("../../lib/supabase", () => ({ supabase: null }));

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import type { FakeSupabase } from "../../testUtils/fakeSupabase";
import { getLastPingsByEmployee, isStale, STALE_THRESHOLD_MINUTES } from "./lastPings";

const fakeDb = supabaseAdmin as unknown as FakeSupabase;

beforeEach(() => {
  for (const table of Object.keys(fakeDb.tables)) fakeDb.tables[table] = [];
});

describe("isStale", () => {
  it("treats a null last-ping time as stale", () => {
    expect(isStale(null)).toBe(true);
  });

  it("treats a ping within the threshold as not stale", () => {
    const recent = new Date(Date.now() - (STALE_THRESHOLD_MINUTES - 1) * 60_000).toISOString();
    expect(isStale(recent)).toBe(false);
  });

  it("treats a ping older than the threshold as stale", () => {
    const old = new Date(Date.now() - (STALE_THRESHOLD_MINUTES + 1) * 60_000).toISOString();
    expect(isStale(old)).toBe(true);
  });
});

describe("getLastPingsByEmployee", () => {
  it("returns an empty map for an empty employee id list, without querying", async () => {
    const result = await getLastPingsByEmployee([]);
    expect(result.size).toBe(0);
  });

  it("picks the most recent ping per employee, not just any ping", async () => {
    await fakeDb.from("employee_location_pings").insert({
      employee_id: "emp-1", latitude: 1, longitude: 1, captured_at: "2026-06-01T08:00:00Z",
    });
    await fakeDb.from("employee_location_pings").insert({
      employee_id: "emp-1", latitude: 2, longitude: 2, captured_at: "2026-06-01T09:00:00Z",
    });
    await fakeDb.from("employee_location_pings").insert({
      employee_id: "emp-2", latitude: 3, longitude: 3, captured_at: "2026-06-01T07:00:00Z",
    });

    const result = await getLastPingsByEmployee(["emp-1", "emp-2"]);

    expect(result.get("emp-1")?.captured_at).toBe("2026-06-01T09:00:00Z");
    expect(result.get("emp-1")?.latitude).toBe(2);
    expect(result.get("emp-2")?.captured_at).toBe("2026-06-01T07:00:00Z");
  });

  it("omits employees with no pings at all", async () => {
    await fakeDb.from("employee_location_pings").insert({
      employee_id: "emp-1", latitude: 1, longitude: 1, captured_at: "2026-06-01T08:00:00Z",
    });

    const result = await getLastPingsByEmployee(["emp-1", "emp-no-pings"]);

    expect(result.has("emp-1")).toBe(true);
    expect(result.has("emp-no-pings")).toBe(false);
  });
});
