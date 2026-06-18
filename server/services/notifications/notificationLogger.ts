import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { supabase } from "../../lib/supabase";

const db = supabaseAdmin ?? supabase;

export type NotificationChannel = "email" | "sms" | "push";

export type NotificationType =
  | "appointment_confirmation"
  | "reminder_24h"
  | "reminder_same_day"
  | "reminder_2h"
  | "review_request"
  | "appointment_canceled"
  | "appointment_rescheduled"
  | "technician_enroute"
  | "technician_en_route"
  | "service_completed"
  | "appointment_canceled_employee"
  | "appointment_canceled_customer"
  | "scheduling_failure"
  | "payment_failed"
  | "subscription_activated"
  | "subscription_renewed"
  | "subscription_canceled"
  | "annual_expiring_30d"
  | "annual_expiring_7d"
  | "annual_expired"
  | "appointment_reminder_24h"
  | "appointment_reminder_same_day"
  | "lead_acknowledgement"
  | "sms_opt_out"
  | "sms_opt_in"
  | "email_opted_out"
  | "employee_assignment_created"
  | "employee_assignment_cancelled"
  | "employee_assignment_updated"
  | "logged";

export type NotificationStatus = "pending" | "sent" | "failed" | "skipped";

export interface LogNotificationParams {
  appointmentId?: string | null;
  profileId?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  channel: NotificationChannel;
  notificationType: NotificationType;
  subject?: string | null;
  status: NotificationStatus;
  provider?: string | null;
  providerMessageId?: string | null;
  payload?: Record<string, unknown> | null;
  errorMessage?: string | null;
  sentAt?: string | null;
}

/**
 * Writes a row to notification_log.
 * Non-throwing — logs errors to console but never propagates them.
 */
export async function logNotification(params: LogNotificationParams): Promise<string | null> {
  try {
    const { data, error } = await db
      .from("notification_log")
      .insert({
        appointment_id:      params.appointmentId ?? null,
        profile_id:          params.profileId ?? null,
        recipient_email:     params.recipientEmail ?? null,
        recipient_phone:     params.recipientPhone ?? null,
        channel:             params.channel,
        notification_type:   params.notificationType,
        subject:             params.subject ?? null,
        status:              params.status,
        provider:            params.provider ?? null,
        provider_message_id: params.providerMessageId ?? null,
        payload:             params.payload ?? null,
        error_message:       params.errorMessage ?? null,
        sent_at:             params.sentAt ?? (params.status === "sent" ? new Date().toISOString() : null),
      })
      .select("id")
      .single();

    if (error) {
      console.error("[NotificationLog] Insert failed:", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (err: any) {
    console.error("[NotificationLog] Unexpected error:", err.message);
    return null;
  }
}

/**
 * Checks whether a notification of this type has already been sent
 * for this appointment. Uses the unique index on (appointment_id, notification_type)
 * where status='sent' as the source of truth.
 *
 * Returns true if a duplicate would be created (i.e., already sent).
 */
export async function isDuplicateNotification(
  appointmentId: string,
  notificationType: NotificationType,
): Promise<boolean> {
  try {
    const { count } = await db
      .from("notification_log")
      .select("id", { count: "exact", head: true })
      .eq("appointment_id", appointmentId)
      .eq("notification_type", notificationType)
      .eq("status", "sent");

    return (count ?? 0) > 0;
  } catch {
    return false; // On error, allow the send (fail open)
  }
}

/**
 * Checks whether a notification of this type has already been sent
 * for this profile within the last `withinHours` hours.
 * Used for non-appointment-based notifications (e.g. payment_failed, subscription events).
 *
 * Returns true if a sent notification already exists within the window (duplicate).
 */
export async function isDuplicateProfileNotification(
  profileId: string,
  notificationType: NotificationType,
  withinHours = 24,
): Promise<boolean> {
  try {
    const cutoff = new Date(Date.now() - withinHours * 60 * 60 * 1000).toISOString();
    const { count } = await db
      .from("notification_log")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .eq("notification_type", notificationType)
      .eq("status", "sent")
      .gte("created_at", cutoff);

    return (count ?? 0) > 0;
  } catch {
    return false; // fail open
  }
}

/**
 * Checks whether a notification of this type has already been sent
 * with a specific payload key matching a value, within the last N hours.
 * Used to deduplicate payment/invoice webhooks that may fire multiple times.
 *
 * Falls back to a simple type + time window check if the JSONB filter is unavailable.
 */
export async function isDuplicateByPayload(
  notificationType: NotificationType,
  payloadKey: string,
  payloadValue: string,
  withinHours = 24,
): Promise<boolean> {
  try {
    const cutoff = new Date(Date.now() - withinHours * 60 * 60 * 1000).toISOString();
    // Supabase JSONB filter: payload->>'invoice_id' = 'inv_xxx'
    const { data } = await db
      .from("notification_log")
      .select("id, payload")
      .eq("notification_type", notificationType)
      .eq("status", "sent")
      .gte("created_at", cutoff)
      .limit(100);

    if (!data) return false;
    return data.some((row: any) => {
      const p = row.payload as Record<string, unknown> | null;
      return p != null && p[payloadKey] === payloadValue;
    });
  } catch {
    return false;
  }
}
