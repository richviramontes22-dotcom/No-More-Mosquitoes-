import { getResendClient, getFromEmail, isEmailConfigured } from "./resendClient";
import { buildConfirmationEmail } from "./emailTemplates";
import { logNotification, isDuplicateNotification } from "./notificationLogger";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { supabase } from "../../lib/supabase";

const db = supabaseAdmin ?? supabase;

export interface ConfirmationTrigger {
  appointmentId: string;
  userId: string;
  recipientEmail: string;
  recipientName: string;
  propertyAddress: string;
  scheduledDate?: string | null;   // "2026-06-02"
  windowLabel?: string | null;     // "Morning (8AM–12PM)"
  serviceType?: string | null;
}

/**
 * Sends an appointment confirmation email.
 * - Checks for duplicate sends before proceeding.
 * - Logs the result (success or failure) to notification_log.
 * - Never throws — designed for fire-and-forget use.
 */
export async function sendAppointmentConfirmation(trigger: ConfirmationTrigger): Promise<void> {
  if (!isEmailConfigured()) {
    console.log("[Notifications] RESEND_API_KEY not set — skipping confirmation email");
    return;
  }

  // Duplicate guard
  const alreadySent = await isDuplicateNotification(trigger.appointmentId, "appointment_confirmation");
  if (alreadySent) {
    console.log(`[Notifications] Confirmation already sent for appointment ${trigger.appointmentId} — skipping`);
    return;
  }

  const dashboardUrl = `${process.env.APP_BASE_URL || "https://nomoremosquitoes.us"}/dashboard/appointments`;

  // Format the date for display
  const displayDate = trigger.scheduledDate
    ? formatDate(trigger.scheduledDate)
    : "Your scheduled date";

  const windowLabel = trigger.windowLabel || "Your confirmed arrival window";
  const serviceType = trigger.serviceType || "Mosquito Service";

  const { subject, html } = buildConfirmationEmail({
    customerName:    trigger.recipientName,
    propertyAddress: trigger.propertyAddress,
    scheduledDate:   displayDate,
    windowLabel,
    serviceType,
    dashboardUrl,
  });

  const resend = getResendClient()!;

  try {
    const result = await resend.emails.send({
      from:    getFromEmail(),
      to:      trigger.recipientEmail,
      subject,
      html,
    });

    await logNotification({
      appointmentId:      trigger.appointmentId,
      profileId:          trigger.userId,
      recipientEmail:     trigger.recipientEmail,
      channel:            "email",
      notificationType:   "appointment_confirmation",
      subject,
      status:             "sent",
      provider:           "resend",
      providerMessageId:  result.data?.id ?? null,
      sentAt:             new Date().toISOString(),
    });

    console.log(`[Notifications] Confirmation sent to ${trigger.recipientEmail} for appointment ${trigger.appointmentId}`);
  } catch (err: any) {
    console.error(`[Notifications] Failed to send confirmation for ${trigger.appointmentId}:`, err.message);
    await logNotification({
      appointmentId:    trigger.appointmentId,
      profileId:        trigger.userId,
      recipientEmail:   trigger.recipientEmail,
      channel:          "email",
      notificationType: "appointment_confirmation",
      subject,
      status:           "failed",
      provider:         "resend",
      errorMessage:     err.message ?? "Unknown error",
    });
  }
}

// ─── Helper: look up appointment data and trigger confirmation ────────────────

/**
 * Looks up appointment + profile + property from the DB and sends a confirmation.
 * Used when the caller only has an appointmentId.
 * Never throws.
 */
export async function sendConfirmationForAppointment(appointmentId: string): Promise<void> {
  if (!isEmailConfigured()) return;
  try {
    const { data: appt } = await db
      .from("appointments")
      .select("id, user_id, property_id, scheduled_date, window_label, service_type")
      .eq("id", appointmentId)
      .single();

    if (!appt?.user_id) return;

    const [profileResult, propertyResult] = await Promise.all([
      db.from("profiles").select("name, email").eq("id", appt.user_id).single(),
      db.from("properties").select("address, city, state").eq("id", appt.property_id).single(),
    ]);

    const profile  = profileResult.data;
    const property = propertyResult.data;

    if (!profile?.email) return;

    const addressParts = [property?.address, property?.city, property?.state].filter(Boolean);

    await sendAppointmentConfirmation({
      appointmentId:   appt.id,
      userId:          appt.user_id,
      recipientEmail:  profile.email,
      recipientName:   profile.name || profile.email.split("@")[0],
      propertyAddress: addressParts.join(", ") || "your property",
      scheduledDate:   appt.scheduled_date ?? null,
      windowLabel:     appt.window_label ?? null,
      serviceType:     appt.service_type ?? null,
    });
  } catch (err: any) {
    console.error("[Notifications] sendConfirmationForAppointment error:", err.message);
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      month:   "long",
      day:     "numeric",
      year:    "numeric",
    });
  } catch {
    return iso;
  }
}
