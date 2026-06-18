import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { getResendClient, getFromEmail, isEmailConfigured } from "../services/notifications/resendClient";
import { buildRescheduleEmail } from "../services/notifications/emailTemplates";
import { logNotification } from "../services/notifications/notificationLogger";
import { notifyAdmin } from "../services/notifications/adminNotificationService";
import { createRescheduleRequest } from "../services/appointments/rescheduleRequestService";

// Use service role for server-side reads so RLS doesn't block appointment lookup.
// User identity is already validated via getAuthenticatedUser() before any query.
const db = supabaseAdmin ?? supabase;

const router = Router();

const ACTIVE_STATUSES = ["requested", "scheduled", "confirmed"];

function formatDateForEmail(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  } catch {
    return iso;
  }
}

async function getAuthenticatedUser(req: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw Object.assign(new Error("Missing authorization header"), { status: 401 });
  }
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw Object.assign(new Error("Invalid session"), { status: 401 });
  return user;
}

async function checkWindowAvailability(
  scheduledDate: string,
  windowId: string,
  excludeAppointmentId: string,
  serviceAreaId?: string | null,
): Promise<string | null> {
  try {
    const { data: blackouts } = await supabase
      .from("blackout_dates")
      .select("scope, service_area_id")
      .eq("date", scheduledDate);

    for (const b of blackouts || []) {
      if (b.scope === "all") return "That date is not available for scheduling.";
      if (b.scope === "service_area" && serviceAreaId && b.service_area_id === serviceAreaId) {
        return "That date is not available for your service area.";
      }
    }

    const parsedDate = new Date(scheduledDate + "T00:00:00");
    const dayOfWeek  = parsedDate.getDay();

    const { data: hoursRows } = await supabase
      .from("business_hours")
      .select("is_operational, windows, service_area_id")
      .eq("day_of_week", dayOfWeek);

    const hoursRow =
      hoursRows?.find((r: any) => serviceAreaId && r.service_area_id === serviceAreaId) ??
      hoursRows?.find((r: any) => !r.service_area_id);

    if (!hoursRow?.is_operational) return "Service is not available on that day.";

    const windowDef = (hoursRow.windows as any[]).find((w: any) => w.id === windowId);
    if (!windowDef) return "That arrival window is not offered on this day.";

    const { data: activeTechs } = await db.from("employees").select("id").eq("status", "active");
    const activeTechCount = (activeTechs && activeTechs.length > 0) ? activeTechs.length : 1;
    const capacity = activeTechCount * (windowDef.max_jobs_per_tech ?? 3);

    // Count active appointments for this slot, excluding the one being rescheduled.
    // Uses db (supabaseAdmin) — anon key is blocked by RLS on appointments table.
    const { count } = await db
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("scheduled_date", scheduledDate)
      .eq("window", windowId)
      .neq("id", excludeAppointmentId)
      .in("status", ACTIVE_STATUSES);

    if ((count ?? 0) >= capacity) {
      return "That arrival window just filled up. Please choose another time.";
    }

    return null;
  } catch {
    return null; // fail open
  }
}

/**
 * POST /api/appointments/:id/reschedule
 * Allows an authenticated customer to reschedule their own appointment.
 */
router.post("/appointments/:id/reschedule", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = req.params;
    const { scheduledDate, windowId, windowLabel, windowStart } = req.body;

    if (!scheduledDate || !windowId) {
      return res.status(400).json({ error: "scheduledDate and windowId are required" });
    }

    // Verify appointment belongs to this user (db bypasses RLS — auth check is above)
    const { data: appt, error: fetchErr } = await db
      .from("appointments")
      .select("id, user_id, property_id, status, service_area_id")
      .eq("id", id)
      .single();

    if (fetchErr || !appt) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    if (appt.user_id !== user.id) {
      return res.status(403).json({ error: "Not authorized to modify this appointment" });
    }
    if (["canceled", "cancelled", "completed"].includes(appt.status)) {
      return res.status(400).json({ error: "Cannot reschedule a canceled or completed appointment" });
    }

    // Check availability (excluding this appointment from the count)
    const unavailable = await checkWindowAvailability(
      scheduledDate,
      windowId,
      id,
      appt.service_area_id ?? null,
    );
    if (unavailable) {
      return res.status(409).json({ error: unavailable, code: "WINDOW_UNAVAILABLE" });
    }

    // Build scheduled_at from windowStart for UI compatibility
    const scheduledAt = windowStart
      ? `${scheduledDate}T${windowStart}:00`
      : `${scheduledDate}T08:00:00`;

    const { error: updateErr } = await db
      .from("appointments")
      .update({
        scheduled_date: scheduledDate,
        window:         windowId,
        window_label:   windowLabel || windowId,
        scheduled_at:   scheduledAt,
        status:         "scheduled",
      })
      .eq("id", id);

    if (updateErr) {
      console.error("[CustomerAppointments] Reschedule update failed:", updateErr.message);
      return res.status(500).json({ error: "Failed to reschedule appointment" });
    }

    console.log(`[CustomerAppointments] Appointment ${id} rescheduled to ${scheduledDate} ${windowId} by user ${user.id}`);

    // Alert admin — customer rescheduled (fire-and-forget)
    notifyAdmin({
      event_type:  "scheduling.appointment_rescheduled",
      severity:    "info",
      title:       `Appointment rescheduled by customer — ${scheduledDate}`,
      body:        `Customer rescheduled appointment ${id} to ${scheduledDate} (${windowLabel || windowId}).`,
      entity_type: "appointment",
      entity_id:   id,
      metadata:    {
        rescheduled_by: "customer",
        user_id:        user.id,
        new_date:       scheduledDate,
        window_label:   windowLabel || windowId,
      },
    });

    // Fire-and-forget reschedule notification email
    if (isEmailConfigured()) {
      (async () => {
        try {
          const [profileResult, propertyResult] = await Promise.all([
            db.from("profiles").select("name, email").eq("id", user.id).single(),
            appt.property_id
              ? db.from("properties").select("address, city, state").eq("id", appt.property_id).maybeSingle()
              : Promise.resolve({ data: null }),
          ]);
          const profile  = profileResult.data;
          const property = (propertyResult as any).data;
          if (!profile?.email) return;

          const addressParts = [property?.address, property?.city, property?.state].filter(Boolean);
          const { subject, html } = buildRescheduleEmail({
            customerName:     profile.name || profile.email.split("@")[0],
            propertyAddress:  addressParts.join(", ") || "your property",
            newScheduledDate: formatDateForEmail(scheduledDate),
            newWindowLabel:   windowLabel || windowId,
            dashboardUrl:     `${process.env.APP_BASE_URL || "https://nomoremosquitoes.us"}/dashboard/appointments`,
          });
          const resend = getResendClient()!;
          const result = await resend.emails.send({ from: getFromEmail(), to: profile.email, subject, html });
          await logNotification({
            appointmentId: id, profileId: user.id, recipientEmail: profile.email,
            channel: "email", notificationType: "appointment_rescheduled", subject,
            status: "sent", provider: "resend", providerMessageId: result.data?.id ?? null,
          });
        } catch (err: any) {
          console.error("[CustomerAppointments] Reschedule email failed:", err.message);
        }
      })();
    }

    return res.json({ success: true, scheduledDate, windowId, windowLabel });
  } catch (e: any) {
    return res.status(e.status || 500).json({ error: e.message || "Internal server error" });
  }
});

/**
 * POST /api/appointments/:id/reschedule-request
 * Additive to the instant self-service reschedule above — for when a
 * customer wants a date that isn't open for instant rebooking. Creates a
 * pending request only; an admin must explicitly approve before anything
 * about the appointment changes.
 */
router.post("/appointments/:id/reschedule-request", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = req.params;
    const { preferredDate, preferredWindowLabel, reason } = req.body ?? {};

    if (!preferredDate || !preferredWindowLabel) {
      return res.status(400).json({ error: "preferredDate and preferredWindowLabel are required" });
    }

    const { data: appt, error: fetchErr } = await db
      .from("appointments")
      .select("id, user_id, status, scheduled_date")
      .eq("id", id)
      .single();

    if (fetchErr || !appt) return res.status(404).json({ error: "Appointment not found" });
    if (appt.user_id !== user.id) return res.status(403).json({ error: "Not authorized to modify this appointment" });
    if (["canceled", "cancelled", "completed"].includes(appt.status)) {
      return res.status(400).json({ error: "Cannot request a reschedule for a canceled or completed appointment" });
    }

    const request = await createRescheduleRequest({
      appointmentId: id,
      customerId: user.id,
      currentScheduledDate: appt.scheduled_date ?? null,
      preferredDate,
      preferredWindowLabel,
      reason: reason || null,
    });

    if (!request) return res.status(500).json({ error: "Failed to create reschedule request" });

    notifyAdmin({
      event_type: "scheduling.reschedule_requested",
      severity: "info",
      title: `Reschedule request — ${preferredDate}`,
      body: `Customer requested a reschedule for appointment ${id} to ${preferredDate} (${preferredWindowLabel}).`,
      entity_type: "appointment",
      entity_id: id,
      metadata: { request_id: request.id, preferred_date: preferredDate, preferred_window_label: preferredWindowLabel },
    });

    return res.status(201).json({ success: true, request });
  } catch (e: any) {
    return res.status(e.status || 500).json({ error: e.message || "Internal server error" });
  }
});

/**
 * GET /api/appointments/reschedule-requests
 * Customer's own reschedule request history, for showing pending status in
 * the dashboard.
 */
router.get("/appointments/reschedule-requests", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { data, error } = await db
      .from("appointment_reschedule_requests")
      .select("*")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ requests: data ?? [] });
  } catch (e: any) {
    return res.status(e.status || 500).json({ error: e.message || "Internal server error" });
  }
});

export default router;
