/**
 * Netlify Scheduled Function — send-reminders
 *
 * Runs daily at 7:00 AM UTC (configured in netlify.toml).
 * Sends 24-hour and same-day appointment reminder emails via Resend.
 *
 * Environment variables required:
 *   RESEND_API_KEY
 *   RESEND_FROM_EMAIL
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY as fallback)
 *   APP_BASE_URL
 */

import "dotenv/config";
import { runReminderBatch, todayUtc, tomorrowUtc } from "../../server/services/notifications/reminderScheduler";

export const handler = async () => {
  const startedAt = new Date().toISOString();
  console.log(`[send-reminders] Starting at ${startedAt}`);

  const today    = todayUtc();
  const tomorrow = tomorrowUtc();

  console.log(`[send-reminders] Checking 24h reminders for: ${tomorrow}`);
  console.log(`[send-reminders] Checking same-day reminders for: ${today}`);

  const [result24h, resultSameDay] = await Promise.allSettled([
    runReminderBatch(tomorrow, "reminder_24h"),
    runReminderBatch(today,    "reminder_same_day"),
  ]);

  const summary: Record<string, unknown> = { startedAt };

  if (result24h.status === "fulfilled") {
    const r = result24h.value;
    console.log(`[send-reminders] 24h — checked: ${r.checked}, sent: ${r.sent}, skipped: ${r.skipped}, failed: ${r.failed}`);
    if (r.errors.length) console.error("[send-reminders] 24h errors:", r.errors);
    summary.reminder_24h = r;
  } else {
    console.error("[send-reminders] 24h batch crashed:", result24h.reason);
    summary.reminder_24h = { error: String(result24h.reason) };
  }

  if (resultSameDay.status === "fulfilled") {
    const r = resultSameDay.value;
    console.log(`[send-reminders] same-day — checked: ${r.checked}, sent: ${r.sent}, skipped: ${r.skipped}, failed: ${r.failed}`);
    if (r.errors.length) console.error("[send-reminders] same-day errors:", r.errors);
    summary.reminder_same_day = r;
  } else {
    console.error("[send-reminders] same-day batch crashed:", resultSameDay.reason);
    summary.reminder_same_day = { error: String(resultSameDay.reason) };
  }

  console.log("[send-reminders] Complete:", JSON.stringify(summary, null, 2));

  return {
    statusCode: 200,
    body: JSON.stringify(summary),
  };
};
