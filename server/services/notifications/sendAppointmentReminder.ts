import { getResendClient, getFromEmail, isEmailConfigured } from "./resendClient";
import { buildReminder24hEmail, buildReminderSameDayEmail, buildReminder2hEmail } from "./emailTemplates";
import { logNotification, isDuplicateNotification, NotificationType } from "./notificationLogger";

export interface ReminderTrigger {
  appointmentId: string;
  userId: string;
  recipientEmail: string;
  recipientName: string;
  propertyAddress: string;
  scheduledDate: string;   // "2026-06-02"
  windowLabel: string;     // "Morning (8AM–12PM)"
  serviceType?: string | null;
  notificationType: "reminder_24h" | "reminder_same_day" | "reminder_2h";
}

/**
 * Sends a 24-hour or same-day reminder email.
 * Checks for duplicates before sending.
 * Logs result to notification_log.
 * Never throws.
 */
export async function sendAppointmentReminder(trigger: ReminderTrigger): Promise<void> {
  if (!isEmailConfigured()) {
    console.log("[Notifications] RESEND_API_KEY not set — skipping reminder email");
    return;
  }

  // Duplicate guard
  const alreadySent = await isDuplicateNotification(trigger.appointmentId, trigger.notificationType);
  if (alreadySent) {
    console.log(`[Notifications] ${trigger.notificationType} already sent for appointment ${trigger.appointmentId} — skipping`);
    return;
  }

  const dashboardUrl = `${process.env.APP_BASE_URL || "https://nomoremosquitoes.us"}/dashboard/appointments`;
  const displayDate  = formatDate(trigger.scheduledDate);
  const serviceType  = trigger.serviceType || "Mosquito Service";

  const emailData = {
    customerName:    trigger.recipientName,
    propertyAddress: trigger.propertyAddress,
    scheduledDate:   displayDate,
    windowLabel:     trigger.windowLabel,
    serviceType,
    dashboardUrl,
  };

  const { subject, html } =
    trigger.notificationType === "reminder_24h" ? buildReminder24hEmail(emailData)
    : trigger.notificationType === "reminder_2h" ? buildReminder2hEmail(emailData)
    : buildReminderSameDayEmail(emailData);

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
      notificationType:   trigger.notificationType,
      subject,
      status:             "sent",
      provider:           "resend",
      providerMessageId:  result.data?.id ?? null,
      sentAt:             new Date().toISOString(),
    });

    console.log(`[Notifications] ${trigger.notificationType} sent to ${trigger.recipientEmail} for appointment ${trigger.appointmentId}`);
  } catch (err: any) {
    console.error(`[Notifications] Failed to send ${trigger.notificationType} for ${trigger.appointmentId}:`, err.message);
    await logNotification({
      appointmentId:    trigger.appointmentId,
      profileId:        trigger.userId,
      recipientEmail:   trigger.recipientEmail,
      channel:          "email",
      notificationType: trigger.notificationType,
      subject,
      status:           "failed",
      provider:         "resend",
      errorMessage:     err.message ?? "Unknown error",
    });
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
