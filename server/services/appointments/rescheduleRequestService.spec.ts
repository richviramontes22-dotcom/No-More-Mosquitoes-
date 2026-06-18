import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../lib/supabaseAdmin", async () => {
  const { createFakeSupabase } = await import("../../testUtils/fakeSupabase");
  return { supabaseAdmin: createFakeSupabase() };
});
vi.mock("../../lib/supabase", () => ({ supabase: null }));
vi.mock("../notifications/resendClient", () => ({
  getResendClient: () => null,
  getFromEmail: () => "test@example.com",
  isEmailConfigured: () => false, // matches test env: no RESEND_API_KEY set
}));

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import type { FakeSupabase } from "../../testUtils/fakeSupabase";
import {
  createRescheduleRequest,
  approveRescheduleRequest,
  denyRescheduleRequest,
} from "./rescheduleRequestService";

const fakeDb = supabaseAdmin as unknown as FakeSupabase;

beforeEach(() => {
  for (const table of Object.keys(fakeDb.tables)) fakeDb.tables[table] = [];
});

describe("createRescheduleRequest", () => {
  it("creates a pending request and does not touch the appointment", async () => {
    await fakeDb.from("appointments").insert({
      id: "appt-1", user_id: "cust-1", status: "scheduled", scheduled_date: "2026-06-20",
    });

    const request = await createRescheduleRequest({
      appointmentId: "appt-1",
      customerId: "cust-1",
      currentScheduledDate: "2026-06-20",
      preferredDate: "2026-06-25",
      preferredWindowLabel: "Morning (8AM–12PM)",
      reason: "Out of town",
    });

    expect(request).not.toBeNull();
    expect(request?.status).toBe("pending");
    expect(fakeDb.tables.appointment_reschedule_requests).toHaveLength(1);

    // appointment is completely untouched — additive, not a replacement for
    // the instant self-service reschedule
    const appt = fakeDb.tables.appointments.find((a: any) => a.id === "appt-1");
    expect(appt.status).toBe("scheduled");
    expect(appt.scheduled_date).toBe("2026-06-20");
  });
});

describe("approveRescheduleRequest", () => {
  it("updates the appointment and marks the request approved", async () => {
    await fakeDb.from("appointments").insert({ id: "appt-2", user_id: "cust-2", status: "scheduled" });
    const request = await fakeDb.from("appointment_reschedule_requests").insert({
      appointment_id: "appt-2", customer_id: "cust-2",
      preferred_date: "2026-06-25", preferred_window_label: "Morning", status: "pending",
    }).select("*").single();

    const result = await approveRescheduleRequest(request.data.id, {
      scheduledDate: "2026-06-25", windowId: "morning", windowLabel: "Morning (8AM–12PM)",
      windowStart: "08:00", adminId: "admin-1",
    });

    expect(result.request?.status).toBe("approved");
    const appt = fakeDb.tables.appointments.find((a: any) => a.id === "appt-2");
    expect(appt.scheduled_date).toBe("2026-06-25");
    expect(appt.window).toBe("morning");
    expect(appt.status).toBe("scheduled");
  });

  it("refuses to approve a request that's already been reviewed", async () => {
    await fakeDb.from("appointments").insert({ id: "appt-3", user_id: "cust-3", status: "scheduled" });
    const request = await fakeDb.from("appointment_reschedule_requests").insert({
      appointment_id: "appt-3", customer_id: "cust-3",
      preferred_date: "2026-06-25", preferred_window_label: "Morning", status: "approved",
    }).select("*").single();

    const result = await approveRescheduleRequest(request.data.id, {
      scheduledDate: "2026-06-25", windowId: "morning", windowLabel: "Morning", adminId: "admin-1",
    });

    expect(result.request).toBeNull();
    expect(result.error).toMatch(/already been reviewed/);
  });

  it("refuses to approve a reschedule for a completed appointment", async () => {
    await fakeDb.from("appointments").insert({ id: "appt-4", user_id: "cust-4", status: "completed" });
    const request = await fakeDb.from("appointment_reschedule_requests").insert({
      appointment_id: "appt-4", customer_id: "cust-4",
      preferred_date: "2026-06-25", preferred_window_label: "Morning", status: "pending",
    }).select("*").single();

    const result = await approveRescheduleRequest(request.data.id, {
      scheduledDate: "2026-06-25", windowId: "morning", windowLabel: "Morning", adminId: "admin-1",
    });

    expect(result.request).toBeNull();
    expect(result.error).toMatch(/canceled or completed/);
  });
});

describe("denyRescheduleRequest", () => {
  it("marks the request denied without touching the appointment", async () => {
    await fakeDb.from("appointments").insert({ id: "appt-5", user_id: "cust-5", status: "scheduled", scheduled_date: "2026-06-20" });
    const request = await fakeDb.from("appointment_reschedule_requests").insert({
      appointment_id: "appt-5", customer_id: "cust-5",
      preferred_date: "2026-06-25", preferred_window_label: "Morning", status: "pending",
    }).select("*").single();

    const updated = await denyRescheduleRequest(request.data.id, "admin-1", "Fully booked that week");

    expect(updated?.status).toBe("denied");
    expect(updated?.admin_notes).toBe("Fully booked that week");
    const appt = fakeDb.tables.appointments.find((a: any) => a.id === "appt-5");
    expect(appt.scheduled_date).toBe("2026-06-20");
  });

  it("returns null for a request that's already been reviewed", async () => {
    const request = await fakeDb.from("appointment_reschedule_requests").insert({
      appointment_id: "appt-6", customer_id: "cust-6",
      preferred_date: "2026-06-25", preferred_window_label: "Morning", status: "denied",
    }).select("*").single();

    const updated = await denyRescheduleRequest(request.data.id, "admin-1");
    expect(updated).toBeNull();
  });
});
