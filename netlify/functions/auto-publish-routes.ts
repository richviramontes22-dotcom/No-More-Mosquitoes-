/**
 * Netlify Scheduled Function — auto-publish-routes
 *
 * Runs every 15 minutes. For today and tomorrow's dates:
 *   1. autoGenerateAndOptimizeDayPlans() — no-op unless an admin has enabled
 *      auto_generate_enabled (optionally auto_optimize_enabled too).
 *   2. autoPublishEligibleRoutes() — no-op unless an admin has enabled
 *      routing automation (review_window or fully_automatic mode), and even
 *      then only actually publishes if require_admin_review_before_publish
 *      is false AND allow_full_auto_publish is true.
 *
 * Every one of these is independently disabled by default — see
 * server/services/routing/routeAutomationPolicy.ts for the full safety
 * rules (status guards, confidence/mock-geo/drive-cap blockers, day/time
 * restrictions, audit logging).
 *
 * Environment variables required:
 *   VITE_SUPABASE_URL (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY as fallback)
 */

import "dotenv/config";
import { autoPublishEligibleRoutes, autoGenerateAndOptimizeDayPlans } from "../../server/services/routing/routeAutomationPolicy";

export const handler = async () => {
  const startedAt = new Date().toISOString();
  console.log(`[auto-publish-routes] Starting at ${startedAt}`);

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dates = [today.toISOString().slice(0, 10), tomorrow.toISOString().slice(0, 10)];

  let generateResult: unknown = null;
  try {
    generateResult = await autoGenerateAndOptimizeDayPlans(dates);
  } catch (err: any) {
    console.error("[auto-publish-routes] auto-generate failed:", err.message);
    generateResult = { error: err.message };
  }

  const publishResults: Record<string, unknown> = {};
  for (const date of dates) {
    try {
      publishResults[date] = await autoPublishEligibleRoutes(date);
    } catch (err: any) {
      console.error(`[auto-publish-routes] auto-publish failed for date ${date}:`, err.message);
      publishResults[date] = { error: err.message };
    }
  }

  const results = { generate: generateResult, publish: publishResults };
  console.log("[auto-publish-routes] Complete:", JSON.stringify(results, null, 2));

  return {
    statusCode: 200,
    body: JSON.stringify({ startedAt, results }),
  };
};
