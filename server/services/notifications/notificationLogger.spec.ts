import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../lib/supabaseAdmin", async () => {
  const { createFakeSupabase } = await import("../../testUtils/fakeSupabase");
  return { supabaseAdmin: createFakeSupabase() };
});
vi.mock("../../lib/supabase", () => ({ supabase: null }));

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import type { FakeSupabase } from "../../testUtils/fakeSupabase";
import { logNotification, isDuplicateNotification } from "./notificationLogger";

const fakeDb = supabaseAdmin as unknown as FakeSupabase;

beforeEach(() => {
  for (const table of Object.keys(fakeDb.tables)) fakeDb.tables[table] = [];
});

describe("isDuplicateNotification — the primitive every send path relies on", () => {
  it("returns false when nothing has been sent yet for this appointment/type", async () => {
    const result = await isDuplicateNotification("appt-1", "reminder_2h");
    expect(result).toBe(false);
  });

  it("returns true once a 'sent' row exists for that exact appointment + type", async () => {
    await logNotification({
      appointmentId: "appt-1", channel: "email", notificationType: "reminder_2h", status: "sent",
    });

    expect(await isDuplicateNotification("appt-1", "reminder_2h")).toBe(true);
  });

  it("does not flag a duplicate for a different notification type on the same appointment", async () => {
    await logNotification({
      appointmentId: "appt-1", channel: "email", notificationType: "reminder_24h", status: "sent",
    });

    expect(await isDuplicateNotification("appt-1", "reminder_2h")).toBe(false);
    expect(await isDuplicateNotification("appt-1", "review_request")).toBe(false);
  });

  it("does not flag a duplicate for a different appointment with the same type", async () => {
    await logNotification({
      appointmentId: "appt-1", channel: "email", notificationType: "review_request", status: "sent",
    });

    expect(await isDuplicateNotification("appt-2", "review_request")).toBe(false);
  });

  it("a 'skipped' or 'failed' log entry does not count as a sent duplicate", async () => {
    await logNotification({
      appointmentId: "appt-1", channel: "email", notificationType: "review_request", status: "skipped",
      errorMessage: "review_request_enabled is false",
    });
    await logNotification({
      appointmentId: "appt-1", channel: "email", notificationType: "review_request", status: "failed",
      errorMessage: "Resend API error",
    });

    // Neither a skip nor a failure should block a later real send attempt.
    expect(await isDuplicateNotification("appt-1", "review_request")).toBe(false);
  });
});
