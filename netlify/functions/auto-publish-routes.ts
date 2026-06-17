/**
 * Netlify Scheduled Function — auto-publish-routes
 *
 * Runs every 15 minutes. Calls autoPublishEligibleRoutes() for today and
 * tomorrow's dates — a no-op unless an admin has explicitly enabled routing
 * automation (review_window or fully_automatic mode) via Route Planning
 * settings. See server/services/routing/routeAutomationPolicy.ts for the
 * full safety rules (status guards, confidence/mock-geo/drive-cap blockers,
 * audit logging).
 *
 * Environment variables required:
 *   VITE_SUPABASE_URL (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY as fallback)
 */

import "dotenv/config";
import { autoPublishEligibleRoutes } from "../../server/services/routing/routeAutomationPolicy";

export const handler = async () => {
  const startedAt = new Date().toISOString();
  console.log(`[auto-publish-routes] Starting at ${startedAt}`);

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dates = [today.toISOString().slice(0, 10), tomorrow.toISOString().slice(0, 10)];
  const results: Record<string, unknown> = {};

  for (const date of dates) {
    try {
      results[date] = await autoPublishEligibleRoutes(date);
    } catch (err: any) {
      console.error(`[auto-publish-routes] Failed for date ${date}:`, err.message);
      results[date] = { error: err.message };
    }
  }

  console.log("[auto-publish-routes] Complete:", JSON.stringify(results, null, 2));

  return {
    statusCode: 200,
    body: JSON.stringify({ startedAt, results }),
  };
};
