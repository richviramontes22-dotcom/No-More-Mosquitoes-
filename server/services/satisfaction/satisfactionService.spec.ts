import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../lib/supabaseAdmin", async () => {
  const { createFakeSupabase } = await import("../../testUtils/fakeSupabase");
  return { supabaseAdmin: createFakeSupabase() };
});
vi.mock("../../lib/supabase", () => ({ supabase: null }));
vi.mock("../notifications/adminNotificationService", () => ({ notifyAdmin: vi.fn() }));

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import type { FakeSupabase } from "../../testUtils/fakeSupabase";
import { notifyAdmin } from "../notifications/adminNotificationService";
import {
  classifySatisfactionRating,
  submitSurvey,
  resolveSatisfactionIssue,
  getSatisfactionDashboard,
} from "./satisfactionService";

const fakeDb = supabaseAdmin as unknown as FakeSupabase;

beforeEach(() => {
  for (const table of Object.keys(fakeDb.tables)) fakeDb.tables[table] = [];
  vi.clearAllMocks();
});

describe("classifySatisfactionRating — promoter/passive/detractor classification", () => {
  it.each([
    [10, "promoter"], [9, "promoter"],
    [8, "passive"], [7, "passive"],
    [6, "detractor"], [3, "detractor"], [0, "detractor"],
  ] as const)("rates %i as %s", (rating, expected) => {
    expect(classifySatisfactionRating(rating)).toBe(expected);
  });
});

describe("submitSurvey — one survey per appointment", () => {
  it("creates a survey for a new appointment", async () => {
    const result = await submitSurvey({ appointmentId: "appt-1", profileId: "cust-1", rating: 9 });
    expect(result.survey).not.toBeNull();
    expect(result.survey!.satisfaction_type).toBe("promoter");
  });

  it("rejects a second submission for the same appointment", async () => {
    await submitSurvey({ appointmentId: "appt-1", profileId: "cust-1", rating: 9 });
    const second = await submitSurvey({ appointmentId: "appt-1", profileId: "cust-1", rating: 2 });
    expect(second.survey).toBeNull();
    expect(second.error).toBe("already_submitted");
    expect(fakeDb.tables.customer_satisfaction_surveys).toHaveLength(1);
  });
});

describe("submitSurvey — detractor alert/ticket creation", () => {
  it("creates an admin alert and a support ticket for a detractor", async () => {
    const result = await submitSurvey({ appointmentId: "appt-2", profileId: "cust-1", rating: 3, comment: "Mosquitoes still everywhere" });
    expect(result.survey!.satisfaction_type).toBe("detractor");
    expect(result.survey!.followup_required).toBe(true);

    // handleDetractor is fire-and-forget — allow microtasks to flush
    await new Promise((r) => setTimeout(r, 10));

    expect(notifyAdmin).toHaveBeenCalledTimes(1);
    expect((notifyAdmin as any).mock.calls[0][0].event_type).toBe("satisfaction.detractor_reported");

    expect(fakeDb.tables.tickets).toHaveLength(1);
    expect(fakeDb.tables.tickets[0].category).toBe("service_quality");
    expect(fakeDb.tables.tickets[0].priority).toBe("high");
  });

  it("never creates an alert or ticket for a promoter or passive", async () => {
    await submitSurvey({ appointmentId: "appt-3", profileId: "cust-1", rating: 10 });
    await submitSurvey({ appointmentId: "appt-4", profileId: "cust-1", rating: 8 });
    await new Promise((r) => setTimeout(r, 10));

    expect(notifyAdmin).not.toHaveBeenCalled();
    expect(fakeDb.tables.tickets ?? []).toHaveLength(0);
  });
});

describe("getSatisfactionDashboard — NPS score calculation", () => {
  it("returns null (not 0) when there are zero responses", async () => {
    const dashboard = await getSatisfactionDashboard();
    expect(dashboard.nps_score).toBeNull();
    expect(dashboard.total_responses).toBe(0);
  });

  it("computes NPS as %promoters - %detractors", async () => {
    // 2 promoters, 1 passive, 1 detractor out of 4 -> (2-1)/4 * 100 = 25
    await submitSurvey({ appointmentId: "a1", profileId: "c1", rating: 10 });
    await submitSurvey({ appointmentId: "a2", profileId: "c1", rating: 9 });
    await submitSurvey({ appointmentId: "a3", profileId: "c1", rating: 8 });
    await submitSurvey({ appointmentId: "a4", profileId: "c1", rating: 2 });

    const dashboard = await getSatisfactionDashboard();
    expect(dashboard.total_responses).toBe(4);
    expect(dashboard.promoter_count).toBe(2);
    expect(dashboard.passive_count).toBe(1);
    expect(dashboard.detractor_count).toBe(1);
    expect(dashboard.nps_score).toBe(25);
  });
});

describe("resolveSatisfactionIssue — resolution tracking", () => {
  it("sets resolved_at and resolved_by, and removes it from the pending detractor list", async () => {
    const { survey } = await submitSurvey({ appointmentId: "appt-5", profileId: "cust-1", rating: 1 });
    let dashboard = await getSatisfactionDashboard();
    expect(dashboard.detractors_pending).toHaveLength(1);

    const resolved = await resolveSatisfactionIssue(survey!.id, "staff-1");
    expect(resolved!.resolved_at).not.toBeNull();
    expect(resolved!.resolved_by).toBe("staff-1");

    dashboard = await getSatisfactionDashboard();
    expect(dashboard.detractors_pending).toHaveLength(0);
    // still counted in the overall detractor total — resolving doesn't
    // erase history, it just clears the pending-followup queue
    expect(dashboard.detractor_count).toBe(1);
  });
});
