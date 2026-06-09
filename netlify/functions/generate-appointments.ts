/**
 * Netlify Scheduled Function — generate-appointments
 *
 * Runs daily at 8:00 AM UTC (1 hour after send-reminders, configured in netlify.toml).
 * Scans active recurring subscriptions and generates the next appointment for any
 * whose next due date falls within the 7-day advance window.
 *
 * Environment variables required:
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY as fallback)
 *
 * Set APPOINTMENT_GEN_DRY_RUN=true to log what would be created without writing.
 */

import "dotenv/config";
import { runRecurringGeneration } from "../../server/services/appointments/generateRecurring";

export const handler = async () => {
  const startedAt = new Date().toISOString();
  console.log(`[generate-appointments] Starting at ${startedAt}`);

  let result;
  try {
    result = await runRecurringGeneration();
  } catch (err: any) {
    console.error("[generate-appointments] Fatal crash:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message, startedAt }),
    };
  }

  console.log(
    `[generate-appointments] checked=${result.checked} generated=${result.generated}` +
    ` skipped=${result.skipped} failed=${result.failed} noSlotFound=${result.noSlotFound}` +
    (result.dryRun ? " [DRY RUN]" : ""),
  );

  if (result.errors.length) {
    console.warn("[generate-appointments] Errors:", result.errors);
  }

  console.log("[generate-appointments] Complete:", JSON.stringify({ startedAt, ...result }, null, 2));

  return {
    statusCode: 200,
    body: JSON.stringify({ startedAt, ...result }),
  };
};
