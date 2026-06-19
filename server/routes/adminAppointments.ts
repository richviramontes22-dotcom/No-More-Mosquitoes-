import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin";
import { requireCustomerService } from "../middleware/requireRole";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { sendEnRouteSMS } from "../services/notifications/sendEnRouteSMS";
import { getResendClient, getFromEmail, isEmailConfigured } from "../services/notifications/resendClient";
import { buildCancellationEmail } from "../services/notifications/emailTemplates";
import { logNotification } from "../services/notifications/notificationLogger";
import { notifyAdmin } from "../services/notifications/adminNotificationService";
import { notifyEmployeeAssigned, notifyEmployeeAssignmentCancelled } from "../services/notifications/employeeNotificationService";
import { listRescheduleRequests, approveRescheduleRequest, denyRescheduleRequest } from "../services/appointments/rescheduleRequestService";

const db = supabaseAdmin ?? supabase;
const router = Router();

// ─── Helper: fetch appointment + profile + property for notifications ─────────

async function getAppointmentContext(appointmentId: string) {
  const [apptResult, assignResult] = await Promise.all([
    db.from("appointments")
      .select("id, user_id, property_id, status, scheduled_date, window, window_label, service_area_id")
      .eq("id", appointmentId)
      .single(),
    db.from("assignments")
      .select("id, employee_id, status, en_route_at")
      .eq("appointment_id", appointmentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const appt = apptResult.data;
  if (!appt) return null;

  const [profileResult, propertyResult] = await Promise.all([
    db.from("profiles").select("id, name, email, phone").eq("id", appt.user_id).single(),
    db.from("properties").select("address, city, state").eq("id", appt.property_id).maybeSingle(),
  ]);

  return {
    appt,
    assignment: assignResult.data ?? null,
    profile: profileResult.data ?? null,
    property: propertyResult.data ?? null,
  };
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "your scheduled date";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  } catch {
    return iso;
  }
}

function buildAddress(property: { address?: string; city?: string; state?: string } | null): string {
  if (!property) return "your property";
  return [property.address, property.city, property.state].filter(Boolean).join(", ") || "your property";
}

// ─── POST /api/admin/appointments/:id/dispatch ────────────────────────────────
//
// Marks an appointment as dispatched (en_route):
//   - Sets appointments.status = 'en_route'
//   - Upserts assignment status = 'en_route', sets en_route_at if not already set
//   - Sends en-route SMS to customer (fire-and-forget — dispatch succeeds even if SMS fails)
//   - Returns { success, smsSent, skipReason }

router.post("/appointments/:id/dispatch", requireAdmin, async (req, res) => {
  const { id } = req.params;

  const ctx = await getAppointmentContext(id);
  if (!ctx) return res.status(404).json({ error: "Appointment not found" });

  const { appt, assignment } = ctx;

  const TERMINAL = ["canceled", "cancelled", "completed"];
  if (TERMINAL.includes(appt.status)) {
    return res.status(400).json({ error: `Cannot dispatch a ${appt.status} appointment` });
  }
  if (appt.status === "en_route") {
    return res.status(400).json({ error: "Appointment is already en route" });
  }

  // Update appointment status
  const { error: apptErr } = await db
    .from("appointments")
    .update({ status: "en_route" })
    .eq("id", id);

  if (apptErr) {
    console.error("[AdminAppointments] Dispatch update failed:", apptErr.message);
    return res.status(500).json({ error: "Failed to update appointment status" });
  }

  // Upsert assignment — set en_route_at only if not already set
  const enRouteAt = assignment?.en_route_at ?? new Date().toISOString();
  if (assignment?.id) {
    await db
      .from("assignments")
      .update({ status: "en_route", en_route_at: enRouteAt })
      .eq("id", assignment.id);
  } else {
    // No assignment yet — create a bare one so the record is consistent
    await db
      .from("assignments")
      .insert({ appointment_id: id, status: "en_route", en_route_at: enRouteAt });
  }

  // Fire-and-forget SMS — respond to admin immediately
  const { profile, property, appt: a } = ctx;
  const phone = (profile as any)?.phone ?? null;

  let smsSent = false;
  let skipReason: string | null = null;

  if (!phone) {
    skipReason = "Customer has no phone number on file";
    console.log(`[AdminAppointments] Dispatch SMS skipped for appointment ${id}: ${skipReason}`);
  } else {
    sendEnRouteSMS({
      appointmentId: id,
      profileId: profile?.id ?? null,
      recipientPhone: phone,
      smsData: {
        customerName:    profile?.name || "Valued Customer",
        windowLabel:     a.window_label || a.window || "your arrival window",
        propertyAddress: buildAddress(property),
        scheduledDate:   formatDate(a.scheduled_date),
      },
    }).catch((err) => console.error("[AdminAppointments] SMS send error:", err?.message));
    smsSent = true;
  }

  console.log(`[AdminAppointments] Appointment ${id} dispatched`);
  return res.json({ success: true, smsSent, skipReason });
});

// ─── PATCH /api/admin/appointments/:id/cancel ─────────────────────────────────
//
// Cancels an appointment and sends a cancellation email to the customer.
// Does NOT process Stripe refunds — that is handled manually in Billing.

router.patch("/appointments/:id/cancel", requireAdmin, async (req, res) => {
  const { id } = req.params;

  const ctx = await getAppointmentContext(id);
  if (!ctx) return res.status(404).json({ error: "Appointment not found" });

  const { appt, profile, property } = ctx;

  if (["canceled", "cancelled"].includes(appt.status)) {
    return res.status(400).json({ error: "Appointment is already canceled" });
  }
  if (appt.status === "completed") {
    return res.status(400).json({ error: "Cannot cancel a completed appointment" });
  }

  const { error: cancelErr } = await db
    .from("appointments")
    .update({ status: "canceled" })
    .eq("id", id);

  if (cancelErr) {
    console.error("[AdminAppointments] Cancel update failed:", cancelErr.message);
    return res.status(500).json({ error: "Failed to cancel appointment" });
  }

  // Cancel linked assignments — skip any that are already in a terminal state.
  // Non-fatal: a failure here does not roll back the appointment cancellation.
  try {
    const { data: linkedAssignments } = await db
      .from("assignments")
      .select("id, status, employee_id")
      .eq("appointment_id", id)
      .not("status", "in", '("completed","skipped","no_show","canceled","cancelled")');

    if (linkedAssignments && linkedAssignments.length > 0) {
      await db
        .from("assignments")
        .update({ status: "skipped" })
        .eq("appointment_id", id)
        .not("status", "in", '("completed","skipped","no_show","canceled","cancelled")');

      console.log(`[AdminAppointments] Skipped ${linkedAssignments.length} assignment(s) for canceled appointment ${id}`);

      // Notify each affected employee of the cancellation (fire-and-forget)
      for (const asgn of linkedAssignments) {
        if (asgn.id) {
          notifyEmployeeAssignmentCancelled(asgn.id);
        }
      }
    }
  } catch (cascadeErr: any) {
    console.error("[AdminAppointments] Assignment cascade failed (non-fatal):", cascadeErr.message);
  }

  // Fire-and-forget cancellation email
  let emailSent = false;
  if (isEmailConfigured() && profile?.email) {
    const displayDate = formatDate(appt.scheduled_date);
    const windowLabel = appt.window_label || appt.window || "your arrival window";
    const { subject, html } = buildCancellationEmail({
      customerName:    profile.name || profile.email.split("@")[0],
      propertyAddress: buildAddress(property),
      scheduledDate:   displayDate,
      windowLabel,
      dashboardUrl:    `${process.env.APP_BASE_URL || "https://nomoremosquitoes.us"}/dashboard/appointments`,
    });

    const resend = getResendClient()!;
    resend.emails.send({ from: getFromEmail(), to: profile.email, subject, html })
      .then(async (result) => {
        await logNotification({
          appointmentId: id, profileId: profile.id, recipientEmail: profile.email,
          channel: "email", notificationType: "appointment_canceled", subject,
          status: "sent", provider: "resend", providerMessageId: result.data?.id ?? null,
        });
        console.log(`[AdminAppointments] Cancellation email sent to ${profile.email}`);
      })
      .catch(async (err) => {
        await logNotification({
          appointmentId: id, profileId: profile.id, recipientEmail: profile.email,
          channel: "email", notificationType: "appointment_canceled", subject,
          status: "failed", provider: "resend", errorMessage: err.message,
        });
        console.error("[AdminAppointments] Cancellation email failed:", err.message);
      });
    emailSent = true;
  }

  // Alert admin — appointment cancellation
  notifyAdmin({
    event_type:  "scheduling.appointment_cancelled",
    severity:    "warning",
    title:       `Appointment cancelled by admin — ${id.slice(0, 8)}`,
    body:        `Admin cancelled appointment ${id}. Customer: ${profile?.email ?? "unknown"}.`,
    entity_type: "appointment",
    entity_id:   id,
    metadata:    {
      cancelled_by: "admin",
      customer_email: profile?.email ?? null,
      appointment_id: id,
    },
  });

  console.log(`[AdminAppointments] Appointment ${id} canceled`);
  return res.json({ success: true, emailSent });
});

// ─── POST /api/admin/assignments ─────────────────────────────────────────────
//
// Upserts one or more appointment assignments to an employee and sends a
// notification email to the employee (fire-and-forget, non-fatal).

router.post("/assignments", requireAdmin, async (req, res) => {
  const { appointment_ids, employee_id } = req.body;
  if (!Array.isArray(appointment_ids) || appointment_ids.length === 0 || !employee_id) {
    return res.status(400).json({ error: "appointment_ids array and employee_id are required" });
  }

  // Fetch employee
  const { data: employee } = await db
    .from("employees")
    .select("id, name, email, phone")
    .eq("id", employee_id)
    .maybeSingle();
  if (!employee) return res.status(404).json({ error: "Employee not found" });

  // Upsert assignments — use "scheduled" to match the status CHECK constraint
  const upserts = appointment_ids.map((appt_id: string) => ({
    appointment_id: appt_id,
    employee_id,
    status: "scheduled",
  }));

  const { error: upsertErr } = await db
    .from("assignments")
    .upsert(upserts, { onConflict: "appointment_id" });

  if (upsertErr) {
    console.error("[AdminAssignments] Upsert failed:", upsertErr.message);
    return res.status(500).json({ error: upsertErr.message });
  }

  // Fire-and-forget: notify each assigned employee via centralized service
  // (replaces the inline raw-HTML email with branded template + logging + pref checks)
  for (const appt_id of appointment_ids) {
    // Fetch the new/updated assignment ID for this appointment+employee pair
    const { data: assignRow } = await db
      .from("assignments")
      .select("id")
      .eq("appointment_id", appt_id)
      .eq("employee_id", employee_id)
      .maybeSingle();

    if (assignRow?.id) {
      notifyEmployeeAssigned(assignRow.id);
    }
  }

  console.log(`[AdminAssignments] Assigned ${appointment_ids.length} appointment(s) to employee ${employee_id}`);
  return res.json({ assigned: appointment_ids.length });
});

// ─── Reschedule requests (Platform Growth Phase 2 — additive review queue) ───

// Gated by requireCustomerService (admin OR customer_service) — reschedule
// review is explicitly a customer-service responsibility, not an
// admin-only one. requireCustomerService still excludes every other role
// (sales, technician, customer).
router.get("/reschedule-requests", requireCustomerService, async (req, res) => {
  const { status } = req.query as Record<string, string>;
  const valid = ["pending", "approved", "denied"];
  const requests = await listRescheduleRequests(status && valid.includes(status) ? (status as any) : undefined);
  res.json({ requests });
});

router.post("/reschedule-requests/:id/approve", requireCustomerService, async (req, res) => {
  const { scheduledDate, windowId, windowLabel, windowStart, adminNotes } = req.body ?? {};
  if (!scheduledDate || !windowId || !windowLabel) {
    return res.status(400).json({ error: "scheduledDate, windowId, and windowLabel are required" });
  }

  const result = await approveRescheduleRequest(req.params.id, {
    scheduledDate, windowId, windowLabel, windowStart,
    adminId: req.staffUserId ?? null,
    adminNotes,
  });

  if (!result.request) return res.status(400).json({ error: result.error || "Failed to approve request" });
  res.json({ success: true, request: result.request });
});

router.post("/reschedule-requests/:id/deny", requireCustomerService, async (req, res) => {
  const { adminNotes } = req.body ?? {};
  const updated = await denyRescheduleRequest(req.params.id, req.staffUserId ?? null, adminNotes);
  if (!updated) return res.status(404).json({ error: "Request not found or already reviewed" });
  res.json({ success: true, request: updated });
});

export default router;
