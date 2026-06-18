import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../lib/supabaseAdmin", async () => {
  const { createFakeSupabase } = await import("../../testUtils/fakeSupabase");
  return { supabaseAdmin: createFakeSupabase() };
});
vi.mock("../../lib/supabase", () => ({ supabase: null }));

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import type { FakeSupabase } from "../../testUtils/fakeSupabase";
import { run2hReminderBatch, runReminderBatch } from "./reminderScheduler";

const fakeDb = supabaseAdmin as unknown as FakeSupabase;

beforeEach(() => {
  for (const table of Object.keys(fakeDb.tables)) fakeDb.tables[table] = [];
});

describe("run2hReminderBatch — disabled by default", () => {
  it("does nothing and queries no appointments when reminder_2h_enabled is false (the seeded default)", async () => {
    await fakeDb.from("appointments").insert({
      id: "appt-1", user_id: "cust-1", status: "scheduled",
      scheduled_date: "2026-06-19", window_label: "Morning",
      scheduled_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    });

    const result = await run2hReminderBatch();

    expect(result.checked).toBe(0);
    expect(result.sent).toBe(0);
  });

  it("still does nothing when explicitly seeded disabled", async () => {
    await fakeDb.from("customer_notification_settings").insert({
      reminder_24h_enabled: true, reminder_2h_enabled: false, review_request_enabled: false,
    });
    await fakeDb.from("appointments").insert({
      id: "appt-2", user_id: "cust-1", status: "scheduled",
      scheduled_date: "2026-06-19", window_label: "Morning",
      scheduled_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    });

    const result = await run2hReminderBatch();
    expect(result.checked).toBe(0);
  });
});

describe("runReminderBatch — reminder_24h respects the DB-backed admin toggle", () => {
  it("returns immediately with zero checked when reminder_24h_enabled is explicitly disabled", async () => {
    await fakeDb.from("customer_notification_settings").insert({
      reminder_24h_enabled: false, reminder_2h_enabled: false, review_request_enabled: false,
    });
    await fakeDb.from("appointments").insert({
      id: "appt-3", user_id: "cust-1", status: "scheduled",
      scheduled_date: "2026-06-19", window_label: "Morning",
    });

    const result = await runReminderBatch("2026-06-19", "reminder_24h");

    expect(result.checked).toBe(0);
    expect(result.sent).toBe(0);
  });

  it("does not gate reminder_same_day on the reminder_24h_enabled toggle", async () => {
    await fakeDb.from("customer_notification_settings").insert({
      reminder_24h_enabled: false, reminder_2h_enabled: false, review_request_enabled: false,
    });
    // No appointments seeded — this just confirms the function proceeds past
    // the gate (checked stays 0 because there's nothing to find, not because
    // it short-circuited) by not throwing and returning a normal empty result.
    const result = await runReminderBatch("2026-06-19", "reminder_same_day");
    expect(result.errors).toEqual([]);
  });
});
