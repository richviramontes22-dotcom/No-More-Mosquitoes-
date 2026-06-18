import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { supabase } from "../../lib/supabase";
import { sendAppointmentReminder } from "./sendAppointmentReminder";
import { getTwilioClient, getTwilioFromNumber, isSmsConfigured } from "./twilioClient";
import { buildReminderSms } from "./smsTemplates";
import { logNotification } from "./notificationLogger";
import { logger } from "../../lib/logger";
import { checkpoint, CP } from "../../lib/checkpoint";
import { flags } from "../../lib/featureFlags";
import { captureException } from "../../lib/sentry";
import { getNotificationSettings } from "./notificationSettingsService";

const db = supabaseAdmin ?? supabase;

// Feature-flag driven — REMINDER_DRY_RUN=true logs intent without sending.
// Also gated by ENABLE_REMINDER_EMAILS flag (false = skip all sends).
const DRY_RUN = () => flags.reminderDryRun();
const EMAILS_ENABLED = () => flags.reminderEmails();

const SKIP_STATUSES = ["canceled", "cancelled", "completed"];

export interface ReminderRunResult {
  checked: number;
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
  dryRun?: boolean;
}

/**
 * Queries all appointments due for a reminder on the given date
 * and sends the appropriate reminder email.
 *
 * notificationType:
 *   'reminder_24h'       → appointments with scheduled_date = tomorrow
 *   'reminder_same_day'  → appointments with scheduled_date = today
 */
export async function runReminderBatch(
  targetDate: string,   // YYYY-MM-DD
  notificationType: "reminder_24h" | "reminder_same_day",
): Promise<ReminderRunResult> {
  const batchId = `${notificationType}-${targetDate}`;
  const isDryRun = DRY_RUN();
  const isEmailsEnabled = EMAILS_ENABLED();
  const result: ReminderRunResult = { checked: 0, sent: 0, skipped: 0, failed: 0, errors: [], dryRun: isDryRun };

  // Additional DB-backed admin toggle on top of the ENABLE_REMINDER_EMAILS env
  // gate above — defaults to true (matches today's live behavior) so this is
  // a no-op unless an admin explicitly disables it from the dashboard.
  if (notificationType === "reminder_24h") {
    const settings = await getNotificationSettings();
    if (!settings.reminder_24h_enabled) return result;
  }

  checkpoint(batchId, CP.REMINDER_BATCH_START, { notificationType, targetDate, dryRun: isDryRun, emailsEnabled: isEmailsEnabled });
  if (isDryRun) {
    logger.info("reminder.batch.dry_run_mode", { batchId, notificationType, targetDate });
  }
  if (!isEmailsEnabled) {
    logger.warn("reminder.batch.emails_disabled", { batchId, notificationType });
  }

  try {
    // Fetch appointments scheduled for targetDate that are not canceled/completed
    const { data: appointments, error } = await db
      .from("appointments")
      .select(`
        id,
        user_id,
        property_id,
        scheduled_date,
        window_label,
        service_type,
        status
      `)
      .eq("scheduled_date", targetDate)
      .not("status", "in", `(${SKIP_STATUSES.map(s => `"${s}"`).join(",")})`)
      .not("user_id", "is", null);

    if (error) {
      result.errors.push(`DB query error: ${error.message}`);
      return result;
    }

    result.checked = appointments?.length ?? 0;
    checkpoint(batchId, CP.REMINDER_APPOINTMENTS_FOUND, { count: result.checked, targetDate });
    if (!result.checked) return result;

    // Batch-fetch profiles and properties for all appointments
    const userIds     = [...new Set((appointments ?? []).map((a: any) => a.user_id).filter(Boolean))];
    const propertyIds = [...new Set((appointments ?? []).map((a: any) => a.property_id).filter(Boolean))];

    const [profilesResult, propertiesResult] = await Promise.all([
      db.from("profiles").select("id, name, email, phone, notification_preferences").in("id", userIds),
      db.from("properties").select("id, address, city, state").in("id", propertyIds),
    ]);

    const profileMap: Record<string, { name: string; email: string; phone: string | null; smsReminders: boolean; smsOptedOut: boolean; emailReminders: boolean }> = {};
    (profilesResult.data ?? []).forEach((p: any) => {
      const prefs = p.notification_preferences ?? {};
      profileMap[p.id] = {
        name:          p.name,
        email:         p.email,
        phone:         p.phone ?? null,
        smsReminders:  prefs.smsReminders !== false,   // default true if not explicitly disabled
        smsOptedOut:   prefs.smsOptedOut === true,     // explicit STOP reply opt-out
        emailReminders: prefs.emailReminders !== false, // default true if not explicitly disabled
      };
    });

    const propertyMap: Record<string, { address: string; city?: string; state?: string }> = {};
    (propertiesResult.data ?? []).forEach((p: any) => { propertyMap[p.id] = { address: p.address, city: p.city, state: p.state }; });

    // Send reminders
    for (const appt of appointments ?? []) {
      const profile  = profileMap[appt.user_id];
      const property = propertyMap[appt.property_id];

      if (!profile?.email) {
        result.skipped++;
        continue;
      }

      if (!appt.scheduled_date || !appt.window_label) {
        // Legacy appointment without window fields — skip gracefully
        result.skipped++;
        continue;
      }

      // Check email reminder preference before sending email
      if (!profile.emailReminders) {
        console.log(`[Reminders] emailReminders=false for user ${appt.user_id} — skipping email reminder`);
        // Log skipped to notification_log
        void logNotification({
          appointmentId:    appt.id,
          profileId:        appt.user_id,
          recipientEmail:   profile.email,
          channel:          "email",
          notificationType: notificationType,
          status:           "skipped",
          provider:         "resend",
          errorMessage:     "emailReminders preference is false",
        });
        result.skipped++;
        continue;
      }

      const addressParts = [property?.address, property?.city, property?.state].filter(Boolean);

      if (!isEmailsEnabled || isDryRun) {
        logger.info("reminder.dry_run_or_disabled", {
          batchId, notificationType, appointmentId: appt.id,
          email: profile.email.replace(/(.{2}).+(@.+)/, "$1***$2"),
          dryRun: isDryRun, emailsEnabled: isEmailsEnabled,
        });
        checkpoint(batchId, CP.REMINDER_DUPLICATE_SKIPPED, { appointmentId: appt.id, reason: isDryRun ? "dry_run" : "emails_disabled" });
        result.sent++;
        continue;
      }

      try {
        await sendAppointmentReminder({
          appointmentId:    appt.id,
          userId:           appt.user_id,
          recipientEmail:   profile.email,
          recipientName:    profile.name || profile.email.split("@")[0],
          propertyAddress:  addressParts.join(", ") || "your property",
          scheduledDate:    appt.scheduled_date,
          windowLabel:      appt.window_label,
          serviceType:      appt.service_type ?? null,
          notificationType,
        });
        result.sent++;
      } catch (err: any) {
        result.failed++;
        result.errors.push(`appointment ${appt.id}: ${err.message}`);
      }

      // Log SMS skipped when opted out or reminders disabled
      if (profile.phone && (!profile.smsReminders || profile.smsOptedOut)) {
        const skipReason = profile.smsOptedOut ? "smsOptedOut=true (STOP received)" : "smsReminders=false";
        const smsSkipType = notificationType === "reminder_24h"
          ? "appointment_reminder_24h" as const
          : "appointment_reminder_same_day" as const;
        console.log(`[Reminders] Skipping SMS for user ${appt.user_id}: ${skipReason}`);
        void logNotification({
          appointmentId:    appt.id,
          profileId:        appt.user_id,
          recipientPhone:   profile.phone,
          channel:          "sms",
          notificationType: smsSkipType,
          status:           "skipped",
          provider:         "twilio",
          errorMessage:     skipReason,
        });
      }

      // SMS reminder — only if customer opted in (not opted out via STOP), has a phone number, and Twilio is configured
      if (profile.smsReminders && !profile.smsOptedOut && profile.phone && isSmsConfigured()) {
        const smsNotificationType = notificationType === "reminder_24h"
          ? "appointment_reminder_24h" as const
          : "appointment_reminder_same_day" as const;

        let smsSent = false;
        let smsSid: string | null = null;
        let smsError: string | null = null;

        try {
          const twilioClient = getTwilioClient();
          const fromNumber   = getTwilioFromNumber();
          if (twilioClient && fromNumber) {
            const dateLabel = new Date(appt.scheduled_date + "T00:00:00Z").toLocaleDateString("en-US", {
              weekday: "long", year: "numeric", month: "long", day: "numeric",
            });
            const message = await twilioClient.messages.create({
              to:   profile.phone,
              from: fromNumber,
              body: buildReminderSms({
                customerName:    profile.name || "",
                windowLabel:     appt.window_label,
                propertyAddress: addressParts.join(", ") || "your property",
                scheduledDate:   dateLabel,
                notificationType,
              }),
            });
            smsSent = true;
            smsSid  = message.sid ?? null;
          }
        } catch (smsErr: any) {
          // Non-fatal — email already sent, log SMS failure separately
          smsError = smsErr.message;
          result.errors.push(`SMS for appointment ${appt.id}: ${smsErr.message}`);
        }

        // Log SMS result to notification_log
        await logNotification({
          appointmentId:      appt.id,
          profileId:          appt.user_id,
          recipientPhone:     profile.phone,
          channel:            "sms",
          notificationType:   smsNotificationType,
          status:             smsSent ? "sent" : (smsError ? "failed" : "skipped"),
          provider:           "twilio",
          providerMessageId:  smsSid,
          errorMessage:       smsError,
          sentAt:             smsSent ? new Date().toISOString() : null,
        });
      }
    }
  } catch (err: any) {
    result.errors.push(`Unexpected error: ${err.message}`);
    logger.error("reminder.batch.crashed", err, { batchId, notificationType, targetDate });
    captureException(err, { tags: { flow: "reminder_batch", notificationType } });
  }

  checkpoint(batchId, CP.REMINDER_BATCH_COMPLETE, {
    checked: result.checked, sent: result.sent,
    skipped: result.skipped, failed: result.failed,
    dryRun: isDryRun,
  });
  logger.info("reminder.batch.complete", { batchId, notificationType, ...result });
  return result;
}

/**
 * Sends the optional, admin-toggled 2-hour-before reminder — email only, no
 * SMS. Unlike runReminderBatch (which scans a whole day), this scans a
 * rolling window 1h45m–2h15m from now, since "2 hours before" needs
 * clock-time precision rather than a date match. Disabled by default —
 * gated by customer_notification_settings.reminder_2h_enabled (in addition
 * to the existing ENABLE_REMINDER_EMAILS / REMINDER_DRY_RUN env gates that
 * runReminderBatch already respects).
 */
export async function run2hReminderBatch(): Promise<ReminderRunResult> {
  const result: ReminderRunResult = { checked: 0, sent: 0, skipped: 0, failed: 0, errors: [] };

  const settings = await getNotificationSettings();
  if (!settings.reminder_2h_enabled) return result;

  const isDryRun = DRY_RUN();
  const isEmailsEnabled = EMAILS_ENABLED();
  result.dryRun = isDryRun;

  const batchId = `reminder_2h-${new Date().toISOString()}`;
  checkpoint(batchId, CP.REMINDER_BATCH_START, { notificationType: "reminder_2h", dryRun: isDryRun, emailsEnabled: isEmailsEnabled });

  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 105 * 60000); // 1h45m out
    const windowEnd = new Date(now.getTime() + 135 * 60000); // 2h15m out

    const { data: appointments, error } = await db
      .from("appointments")
      .select(`id, user_id, property_id, scheduled_date, window_label, service_type, status`)
      .gte("scheduled_at", windowStart.toISOString())
      .lt("scheduled_at", windowEnd.toISOString())
      .not("status", "in", `(${SKIP_STATUSES.map(s => `"${s}"`).join(",")})`)
      .not("user_id", "is", null);

    if (error) {
      result.errors.push(`DB query error: ${error.message}`);
      return result;
    }

    result.checked = appointments?.length ?? 0;
    if (!result.checked) return result;

    const userIds = [...new Set((appointments ?? []).map((a: any) => a.user_id).filter(Boolean))];
    const propertyIds = [...new Set((appointments ?? []).map((a: any) => a.property_id).filter(Boolean))];

    const [profilesResult, propertiesResult] = await Promise.all([
      db.from("profiles").select("id, name, email, notification_preferences").in("id", userIds),
      db.from("properties").select("id, address, city, state").in("id", propertyIds),
    ]);

    const profileMap: Record<string, { name: string; email: string; emailReminders: boolean }> = {};
    (profilesResult.data ?? []).forEach((p: any) => {
      const prefs = p.notification_preferences ?? {};
      profileMap[p.id] = { name: p.name, email: p.email, emailReminders: prefs.emailReminders !== false };
    });

    const propertyMap: Record<string, { address: string; city?: string; state?: string }> = {};
    (propertiesResult.data ?? []).forEach((p: any) => { propertyMap[p.id] = { address: p.address, city: p.city, state: p.state }; });

    for (const appt of appointments ?? []) {
      const profile = profileMap[appt.user_id];
      const property = propertyMap[appt.property_id];

      if (!profile?.email || !appt.scheduled_date || !appt.window_label) {
        result.skipped++;
        continue;
      }
      if (!profile.emailReminders) {
        void logNotification({
          appointmentId: appt.id, profileId: appt.user_id, recipientEmail: profile.email,
          channel: "email", notificationType: "reminder_2h", status: "skipped",
          provider: "resend", errorMessage: "emailReminders preference is false",
        });
        result.skipped++;
        continue;
      }

      const addressParts = [property?.address, property?.city, property?.state].filter(Boolean);

      if (!isEmailsEnabled || isDryRun) {
        result.sent++;
        continue;
      }

      try {
        await sendAppointmentReminder({
          appointmentId: appt.id,
          userId: appt.user_id,
          recipientEmail: profile.email,
          recipientName: profile.name || profile.email.split("@")[0],
          propertyAddress: addressParts.join(", ") || "your property",
          scheduledDate: appt.scheduled_date,
          windowLabel: appt.window_label,
          serviceType: appt.service_type ?? null,
          notificationType: "reminder_2h",
        });
        result.sent++;
      } catch (err: any) {
        result.failed++;
        result.errors.push(`appointment ${appt.id}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors.push(`Unexpected error: ${err.message}`);
    logger.error("reminder.2h_batch.crashed", err, { batchId });
    captureException(err, { tags: { flow: "reminder_2h_batch" } });
  }

  checkpoint(batchId, CP.REMINDER_BATCH_COMPLETE, { ...result });
  logger.info("reminder.2h_batch.complete", { batchId, ...result });
  return result;
}

/** Returns YYYY-MM-DD for today (UTC) */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Returns YYYY-MM-DD for tomorrow (UTC) */
export function tomorrowUtc(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
