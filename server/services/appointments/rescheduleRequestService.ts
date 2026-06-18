import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { getResendClient, getFromEmail, isEmailConfigured } from "../notifications/resendClient";
import { buildRescheduleEmail } from "../notifications/emailTemplates";
import { logNotification } from "../notifications/notificationLogger";

const db = supabaseAdmin ?? supabase;

export type RescheduleRequestStatus = "pending" | "approved" | "denied";

export interface RescheduleRequest {
  id: string;
  appointment_id: string;
  customer_id: string;
  current_scheduled_date: string | null;
  preferred_date: string;
  preferred_window_label: string;
  reason: string | null;
  status: RescheduleRequestStatus;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRescheduleRequestParams {
  appointmentId: string;
  customerId: string;
  currentScheduledDate: string | null;
  preferredDate: string;
  preferredWindowLabel: string;
  reason?: string | null;
}

/**
 * Additive to the existing instant self-service reschedule
 * (POST /api/appointments/:id/reschedule). This only ever creates a row —
 * it never touches the appointment itself. An admin reviews and either
 * approves (which does update the appointment) or denies.
 */
export async function createRescheduleRequest(params: CreateRescheduleRequestParams): Promise<RescheduleRequest | null> {
  const { data, error } = await db
    .from("appointment_reschedule_requests")
    .insert({
      appointment_id: params.appointmentId,
      customer_id: params.customerId,
      current_scheduled_date: params.currentScheduledDate,
      preferred_date: params.preferredDate,
      preferred_window_label: params.preferredWindowLabel,
      reason: params.reason ?? null,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    console.error("[rescheduleRequestService] createRescheduleRequest failed:", error.message);
    return null;
  }
  return data as RescheduleRequest;
}

export async function listRescheduleRequests(status?: RescheduleRequestStatus): Promise<RescheduleRequest[]> {
  let query = db.from("appointment_reschedule_requests").select("*").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data } = await query;
  return (data ?? []) as RescheduleRequest[];
}

function formatDateForEmail(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  } catch {
    return iso;
  }
}

export interface ApproveRescheduleRequestParams {
  scheduledDate: string;
  windowId: string;
  windowLabel: string;
  windowStart?: string | null; // "HH:MM"
  adminId: string | null;
  adminNotes?: string | null;
}

/**
 * Admin approves a reschedule request: updates the underlying appointment
 * (same fields the instant self-service path writes — scheduled_date,
 * window, window_label, scheduled_at, status), marks the request approved,
 * and emails the customer using the existing appointment_rescheduled
 * template. Does not re-run capacity/availability validation — approval is
 * an explicit admin decision, the admin is expected to have checked the
 * calendar before approving.
 */
export async function approveRescheduleRequest(
  requestId: string,
  params: ApproveRescheduleRequestParams,
): Promise<{ request: RescheduleRequest | null; error?: string }> {
  const { data: request, error: fetchErr } = await db
    .from("appointment_reschedule_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (fetchErr || !request) return { request: null, error: "Reschedule request not found" };
  if ((request as any).status !== "pending") return { request: null, error: "Request has already been reviewed" };

  const { data: appt, error: apptErr } = await db
    .from("appointments")
    .select("id, user_id, property_id, status")
    .eq("id", (request as any).appointment_id)
    .single();

  if (apptErr || !appt) return { request: null, error: "Appointment not found" };
  if (["canceled", "cancelled", "completed"].includes((appt as any).status)) {
    return { request: null, error: "Cannot reschedule a canceled or completed appointment" };
  }

  const scheduledAt = params.windowStart
    ? `${params.scheduledDate}T${params.windowStart}:00`
    : `${params.scheduledDate}T08:00:00`;

  const { error: updateErr } = await db
    .from("appointments")
    .update({
      scheduled_date: params.scheduledDate,
      window: params.windowId,
      window_label: params.windowLabel,
      scheduled_at: scheduledAt,
      status: "scheduled",
    })
    .eq("id", (appt as any).id);

  if (updateErr) return { request: null, error: "Failed to update appointment" };

  const now = new Date().toISOString();
  const { data: updatedRequest } = await db
    .from("appointment_reschedule_requests")
    .update({ status: "approved", admin_notes: params.adminNotes ?? null, reviewed_by: params.adminId, reviewed_at: now })
    .eq("id", requestId)
    .select("*")
    .single();

  // Fire-and-forget customer notification — reuses the same template/type
  // the instant reschedule path uses, so this looks identical to the
  // customer regardless of which path produced the change.
  if (isEmailConfigured()) {
    (async () => {
      try {
        const [profileResult, propertyResult] = await Promise.all([
          db.from("profiles").select("name, email").eq("id", (appt as any).user_id).single(),
          (appt as any).property_id
            ? db.from("properties").select("address, city, state").eq("id", (appt as any).property_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        const profile = profileResult.data;
        const property = (propertyResult as any).data;
        if (!profile?.email) return;

        const addressParts = [property?.address, property?.city, property?.state].filter(Boolean);
        const { subject, html } = buildRescheduleEmail({
          customerName: profile.name || profile.email.split("@")[0],
          propertyAddress: addressParts.join(", ") || "your property",
          newScheduledDate: formatDateForEmail(params.scheduledDate),
          newWindowLabel: params.windowLabel,
          dashboardUrl: `${process.env.APP_BASE_URL || "https://nomoremosquitoes.us"}/dashboard/appointments`,
        });
        const resend = getResendClient()!;
        const result = await resend.emails.send({ from: getFromEmail(), to: profile.email, subject, html });
        await logNotification({
          appointmentId: (appt as any).id, profileId: (appt as any).user_id, recipientEmail: profile.email,
          channel: "email", notificationType: "appointment_rescheduled", subject,
          status: "sent", provider: "resend", providerMessageId: result.data?.id ?? null,
        });
      } catch (err: any) {
        console.error("[rescheduleRequestService] Approval email failed:", err.message);
      }
    })();
  }

  return { request: updatedRequest as RescheduleRequest };
}

export async function denyRescheduleRequest(
  requestId: string,
  adminId: string | null,
  adminNotes?: string | null,
): Promise<RescheduleRequest | null> {
  const { data: request } = await db
    .from("appointment_reschedule_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (!request || (request as any).status !== "pending") return null;

  const now = new Date().toISOString();
  const { data: updated, error } = await db
    .from("appointment_reschedule_requests")
    .update({ status: "denied", admin_notes: adminNotes ?? null, reviewed_by: adminId, reviewed_at: now })
    .eq("id", requestId)
    .select("*")
    .single();

  if (error) return null;

  if (isEmailConfigured()) {
    (async () => {
      try {
        const { data: appt } = await db.from("appointments").select("user_id").eq("id", (request as any).appointment_id).maybeSingle();
        if (!appt) return;
        const { data: profile } = await db.from("profiles").select("name, email").eq("id", (appt as any).user_id).maybeSingle();
        if (!profile?.email) return;

        const resend = getResendClient()!;
        const subject = "Update on your reschedule request";
        const html = `<p>Hi ${profile.name || profile.email.split("@")[0]},</p>
          <p>We're unable to accommodate your requested reschedule to ${formatDateForEmail((request as any).preferred_date)} (${(request as any).preferred_window_label}).${adminNotes ? ` ${adminNotes}` : ""}</p>
          <p>Your original appointment remains scheduled as-is. Please reach out or use your dashboard to try a different date.</p>`;
        const result = await resend.emails.send({ from: getFromEmail(), to: profile.email, subject, html });
        await logNotification({
          appointmentId: (request as any).appointment_id, profileId: (appt as any).user_id, recipientEmail: profile.email,
          channel: "email", notificationType: "appointment_rescheduled", subject,
          status: "sent", provider: "resend", providerMessageId: result.data?.id ?? null,
        });
      } catch (err: any) {
        console.error("[rescheduleRequestService] Denial email failed:", err.message);
      }
    })();
  }

  return updated as RescheduleRequest;
}
