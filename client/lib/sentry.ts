/**
 * Optional Sentry client-side error monitoring.
 *
 * Initializes only when:
 *   1. VITE_ENABLE_SENTRY=true
 *   2. VITE_SENTRY_DSN is set
 *   3. @sentry/react package is installed
 *
 * All exports are safe no-ops if Sentry is absent.
 * Build never fails if @sentry/react is not installed.
 */

const SENTRY_ENABLED =
  (import.meta.env.VITE_ENABLE_SENTRY === "true") &&
  !!import.meta.env.VITE_SENTRY_DSN;

let initialized = false;

async function loadSentry(): Promise<any | null> {
  try {
    // Indirect string prevents TypeScript from resolving @sentry/react as a static dependency
    const pkg = "@sentry" + "/react";
    return await import(/* @vite-ignore */ pkg);
  } catch { return null; }
}

export function initSentry(): void {
  if (!SENTRY_ENABLED || initialized) return;
  loadSentry().then((SentryReact) => {
    if (!SentryReact) return;
    SentryReact.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE || "unknown",
      tracesSampleRate: parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || "0.1"),
      beforeSend(event: any) {
        if (event.request?.headers) delete event.request.headers["authorization"];
        return event;
      },
    });
    initialized = true;
  }).catch(() => { /* safe */ });
}

export function captureClientException(err: unknown, context?: Record<string, unknown>): void {
  if (!SENTRY_ENABLED) return;
  loadSentry().then((SentryReact) => {
    if (!SentryReact) return;
    SentryReact.withScope((scope: any) => {
      if (context) Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
      SentryReact.captureException(err);
    });
  }).catch(() => { /* safe */ });
}

export const clientSentryEnabled = SENTRY_ENABLED;
