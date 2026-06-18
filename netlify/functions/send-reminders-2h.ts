/**
 * Netlify Scheduled Function — send-reminders-2h
 *
 * Runs every 30 minutes. No-op unless an admin has enabled the 2-hour
 * reminder from the customer notification settings (disabled by default —
 * this is a brand new send, unlike the 24h/same-day reminders which already
 * ship live). Scans a rolling 1h45m-2h15m window rather than a whole day,
 * since "2 hours before" needs clock-time precision.
 *
 * Environment variables required:
 *   RESEND_API_KEY
 *   RESEND_FROM_EMAIL
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY as fallback)
 *   APP_BASE_URL
 */

import "dotenv/config";
import { run2hReminderBatch } from "../../server/services/notifications/reminderScheduler";

export const handler = async () => {
  const startedAt = new Date().toISOString();
  console.log(`[send-reminders-2h] Starting at ${startedAt}`);

  let result;
  try {
    result = await run2hReminderBatch();
    console.log(`[send-reminders-2h] checked: ${result.checked}, sent: ${result.sent}, skipped: ${result.skipped}, failed: ${result.failed}`);
    if (result.errors.length) console.error("[send-reminders-2h] errors:", result.errors);
  } catch (err: any) {
    console.error("[send-reminders-2h] crashed:", err.message);
    result = { error: err.message };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ startedAt, result }),
  };
};
