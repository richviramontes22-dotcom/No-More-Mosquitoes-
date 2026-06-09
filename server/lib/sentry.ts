/**
 * Optional Sentry server-side error monitoring.
 *
 * Sentry is NOT a required dependency. This module initializes it only when:
 *   1. ENABLE_SENTRY=true
 *   2. SENTRY_DSN is set
 *   3. @sentry/node package is installed
 *
 * If any condition is false, all exports are safe no-ops.
 * The build will NOT fail if @sentry/node is absent.
 *
 * To enable:
 *   npm install @sentry/node
 *   ENABLE_SENTRY=true
 *   SENTRY_DSN=https://xxx@sentry.io/xxx
 */

const SENTRY_ENABLED = process.env.ENABLE_SENTRY === "true" && !!process.env.SENTRY_DSN;

let Sentry: any = null;

if (SENTRY_ENABLED) {
  try {
    Sentry = require("@sentry/node");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || "unknown",
      release: process.env.APP_VERSION || process.env.npm_package_version,
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1"),
      beforeSend(event: any) {
        // Strip sensitive fields before sending to Sentry
        if (event.request?.headers) {
          delete event.request.headers["authorization"];
          delete event.request.headers["x-service-role"];
        }
        return event;
      },
    });
    console.log("[Sentry] Server-side monitoring initialized");
  } catch (err: any) {
    console.warn("[Sentry] Failed to initialize — @sentry/node may not be installed:", err.message);
    Sentry = null;
  }
}

/**
 * Capture an exception in Sentry (no-op if Sentry is disabled or missing).
 * Always include requestId as a tag.
 */
export function captureException(err: unknown, context?: { requestId?: string; tags?: Record<string, string> }): void {
  if (!Sentry) return;
  try {
    Sentry.withScope((scope: any) => {
      if (context?.requestId) scope.setTag("request_id", context.requestId);
      if (context?.tags) {
        Object.entries(context.tags).forEach(([k, v]) => scope.setTag(k, v));
      }
      Sentry.captureException(err);
    });
  } catch { /* never let Sentry crash the app */ }
}

export function captureMessage(message: string, level: "info" | "warning" | "error" = "info"): void {
  if (!Sentry) return;
  try { Sentry.captureMessage(message, level); } catch { /* safe */ }
}

export const sentryEnabled = SENTRY_ENABLED && Sentry !== null;
