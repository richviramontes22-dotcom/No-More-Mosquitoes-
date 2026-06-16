import type { RequestHandler } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import type { ScheduleRequestPayload, ScheduleResponse } from "@shared/api";
import { sendAppointmentConfirmation } from "../services/notifications/sendAppointmentConfirmation";
import { getEmailProvider, getFromEmail } from "../services/notifications/providers/index";
import { buildLeadAcknowledgementEmail } from "../services/notifications/emailTemplates";
import { logNotification } from "../services/notifications/notificationLogger";
import { notifyAdmin } from "../services/notifications/adminNotificationService";
import { upsertLeadFromScheduleRequest } from "../services/leads/leadService";

// Service role bypasses RLS for appointment count (capacity check) and INSERT.
// Auth validation (getUser) still uses the anon client with the user's JWT.
const db = supabaseAdmin ?? supabase;

const REQUIRED_FIELDS: Array<keyof ScheduleRequestPayload> = [
  "fullName",
  "email",
  "phone",
  "serviceAddress",
  "zipCode",
  "serviceFrequency",
  "preferredDate",
  "preferredContactMethod",
  "submittedAt",
];

const ACTIVE_STATUSES = ["requested", "scheduled", "confirmed"];

/**
 * Validates that the requested window (date + windowId) still has capacity.
 * Returns null if available, or an error string if not.
 *
 * This is a server-side re-check — the client checks availability before
 * submitting, but concurrent bookings could exhaust the slot in the interim.
 */
async function checkWindowAvailability(
  scheduledDate: string,
  windowId: string,
  serviceAreaId?: string | null,
): Promise<string | null> {
  try {
    // 1. Blackout check
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

    // 2. Business hours check
    const parsedDate = new Date(scheduledDate + "T00:00:00");
    const dayOfWeek  = parsedDate.getDay();

    let hoursQuery = supabase
      .from("business_hours")
      .select("is_operational, windows, service_area_id")
      .eq("day_of_week", dayOfWeek);

    const { data: hoursRows } = await hoursQuery;

    // Prefer area-specific row over global
    const hoursRow =
      hoursRows?.find((r: any) => serviceAreaId && r.service_area_id === serviceAreaId) ??
      hoursRows?.find((r: any) => !r.service_area_id);

    if (!hoursRow?.is_operational) return "Service is not available on that day.";

    const windowDef = (hoursRow.windows as any[]).find((w: any) => w.id === windowId);
    if (!windowDef) return "That arrival window is not offered on this day.";

    // 3. Capacity check — use live active employee count, fallback to 1
    const { data: activeTechs } = await db
      .from("employees")
      .select("id")
      .eq("status", "active");
    const activeTechCount = activeTechs && activeTechs.length > 0 ? activeTechs.length : 1;
    const capacity = activeTechCount * (windowDef.max_jobs_per_tech ?? 3);

    let countQuery = db
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("scheduled_date", scheduledDate)
      .eq("window", windowId)
      .in("status", ACTIVE_STATUSES);

    if (serviceAreaId) countQuery = countQuery.eq("service_area_id", serviceAreaId);

    const { count } = await countQuery;
    const bookedCount = count ?? 0;

    if (bookedCount >= capacity) {
      return "That arrival window just filled up. Please choose another time.";
    }

    return null; // available
  } catch {
    // If the availability check itself fails, allow the booking through
    // rather than blocking a customer due to an infrastructure error.
    console.warn("[Schedule] Availability check failed — allowing booking through");
    return null;
  }
}

export const handleScheduleRequest: RequestHandler = async (req, res) => {
  const payload = req.body as ScheduleRequestPayload | undefined;

  if (!payload) {
    res.status(400).json({ message: "Missing request body" });
    return;
  }

  const missingField = REQUIRED_FIELDS.find((field) => {
    const value = payload[field];
    if (typeof value === "string") {
      return value.trim() === "";
    }
    return value === undefined || value === null;
  });

  if (missingField) {
    res.status(400).json({ message: `Missing required field: ${missingField}` });
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    let userId = payload.userId;

    if (authHeader) {
      const token = authHeader.split(" ")[1];
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    }

    // ── Server-side availability validation ───────────────────────────────────
    // Only validate if the new window fields are present (new booking flow).
    // Legacy submissions that only set preferredDate are allowed through as-is.
    const windowId      = (payload as any).window       as string | undefined;
    const scheduledDate = (payload as any).scheduledDate as string | undefined;
    const serviceAreaId = (payload as any).serviceAreaId as string | undefined;

    if (windowId && scheduledDate) {
      const unavailableReason = await checkWindowAvailability(scheduledDate, windowId, serviceAreaId);
      if (unavailableReason) {
        res.status(409).json({ message: unavailableReason, code: "WINDOW_UNAVAILABLE" });
        return;
      }
    }

    // ── Persist to schedule_requests (lead capture, always) ───────────────────
    const { data, error } = await supabase
      .from("schedule_requests")
      .insert({
        full_name:     payload.fullName,
        email:         payload.email,
        phone:         payload.phone,
        address:       payload.serviceAddress,
        city:          payload.city,
        state:         payload.state,
        zip:           payload.zipCode,
        frequency:     payload.serviceFrequency,
        preferred_date: payload.preferredDate,
        contact_method: payload.preferredContactMethod,
        acreage:       payload.acreage ?? null,
        notes:         payload.notes,
        status:        "new",
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving schedule request to Supabase:", error);
    }

    // ── Lead acknowledgement email (fire-and-forget) ───────────────────────────
    // Send a "we received your request" email to the submitted address.
    ;(async () => {
      try {
        const supportEmail = process.env.SUPPORT_EMAIL || "support@nomoremosquitoes.us";
        const { subject, html, text } = buildLeadAcknowledgementEmail({
          customerName: payload.fullName,
          serviceType:  payload.serviceFrequency || "Mosquito Service",
          zip:          payload.zipCode,
          supportEmail,
        });

        const emailProvider = getEmailProvider();
        await emailProvider.send({
          to:      payload.email,
          from:    getFromEmail(),
          subject,
          html,
          text,
        });

        await logNotification({
          recipientEmail:   payload.email,
          channel:          "email",
          notificationType: "lead_acknowledgement",
          subject,
          status:           "sent",
          provider:         "resend",
          sentAt:           new Date().toISOString(),
          payload:          { schedule_request_id: data?.id ?? null },
        });

        console.log(`[Schedule] Lead acknowledgement email sent to ${payload.email}`);
      } catch (ackErr: any) {
        console.error("[Schedule] Lead acknowledgement email error (non-fatal):", ackErr.message);
      }
    })();

    // ── Alert owner of new lead ────────────────────────────────────────────────
    notifyAdmin({
      event_type:  "leads.new_schedule_request",
      severity:    "info",
      title:       `New schedule request — ${payload.fullName}`,
      body:        `${payload.fullName} submitted a schedule request for ${payload.serviceFrequency || "Mosquito Service"} in ${payload.zipCode}.`,
      entity_type: "lead",
      entity_id:   data?.id ?? undefined,
      metadata: {
        name:    payload.fullName,
        email:   payload.email,
        phone:   payload.phone,
        zip:     payload.zipCode,
        service: payload.serviceFrequency || "Mosquito Service",
      },
    });

    // ── CRM Phase 1: create/update lead record (best-effort) ───────────────────
    // Merges into an existing quote/manual-review lead for the same property
    // (via address_hash) or the same person (via email/phone) instead of
    // creating a duplicate — see SCHEDULE_REQUEST_MERGE_REPORT.md.
    if (data?.id) {
      const realPropertyId =
        payload.propertyId && !payload.propertyId.startsWith("prop-system")
          ? payload.propertyId
          : null;

      void upsertLeadFromScheduleRequest({
        scheduleRequestId: data.id,
        name: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        address: payload.serviceAddress,
        city: payload.city,
        state: payload.state,
        zip: payload.zipCode,
        acreage: payload.acreage ?? null,
        cadence: payload.serviceFrequency,
        profileId: userId ?? null,
        propertyId: realPropertyId,
      }).catch((err) => {
        console.error("[Schedule] upsertLeadFromScheduleRequest failed:", err);
      });
    }

    // ── Create appointment for authenticated users with a real property ────────
    if (userId && payload.propertyId && !payload.propertyId.startsWith("prop-system")) {
      const appointmentInsert: Record<string, any> = {
        user_id:      userId,
        property_id:  payload.propertyId,
        status:       "requested",
        service_type: "Mosquito Service",
        frequency:    payload.serviceFrequency,
        notes:        payload.notes,
      };

      // New window-based booking
      if (windowId && scheduledDate) {
        appointmentInsert.window        = windowId;
        appointmentInsert.window_label  = (payload as any).windowLabel || windowId;
        appointmentInsert.scheduled_date = scheduledDate;
        if (serviceAreaId) appointmentInsert.service_area_id = serviceAreaId;
        // Set scheduled_at to window start for UI compatibility (existing admin calendar reads it)
        const windowStart = (payload as any).windowStart as string | undefined;
        if (windowStart) {
          appointmentInsert.scheduled_at = `${scheduledDate}T${windowStart}:00`;
        } else {
          appointmentInsert.scheduled_at = `${scheduledDate}T08:00:00`;
        }
      } else {
        // Legacy fallback: use preferredDate as scheduled_at
        appointmentInsert.scheduled_at = payload.preferredDate;
      }

      const { data: newAppt, error: appointmentError } = await db
        .from("appointments")
        .insert(appointmentInsert)
        .select("id")
        .single();

      if (appointmentError) {
        console.error("Error saving appointment to Supabase:", appointmentError);
      }

      // Fire-and-forget confirmation email — must NOT block the HTTP response
      if (newAppt?.id && !appointmentError) {
        const addressParts = [payload.serviceAddress, payload.city, payload.state].filter(Boolean);
        sendAppointmentConfirmation({
          appointmentId:   newAppt.id,
          userId,
          recipientEmail:  payload.email,
          recipientName:   payload.fullName,
          propertyAddress: addressParts.join(", ") || payload.serviceAddress,
          scheduledDate:   scheduledDate ?? null,
          windowLabel:     (payload as any).windowLabel ?? null,
          serviceType:     "Mosquito Service",
        }).catch((err) => {
          console.error("[Schedule] Confirmation email error (non-fatal):", err?.message);
        });
      }
    }

    const response: ScheduleResponse = {
      success: true,
      ticketId: data?.id?.split("-")[0]?.toUpperCase() ?? `REQ-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      message: "Schedule request received and saved",
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Internal error handling schedule request:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
