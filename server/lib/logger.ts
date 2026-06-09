/**
 * Centralized structured logger.
 *
 * Outputs JSON lines — compatible with Netlify log drains, Datadog, and any
 * log aggregator. Never logs secrets, API keys, or raw provider payloads.
 *
 * Usage:
 *   import { logger } from "../lib/logger";
 *   logger.info("billing.payment_intent.created", { requestId, userId, amountCents });
 *   logger.error("parcel.lookup.failed", err, { requestId, address });
 */

const SENSITIVE_KEYS = new Set([
  "password", "token", "secret", "apiKey", "api_key", "key",
  "authorization", "stripe_secret", "service_role", "access_token",
  "refresh_token", "card_number", "cvc", "cvv", "ssn",
]);

function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase()) || k.toLowerCase().includes("secret") || k.toLowerCase().includes("_key")) {
      out[k] = "[REDACTED]";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = sanitize(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function buildEntry(level: string, event: string, context?: Record<string, unknown>, err?: unknown) {
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    event,
  };
  if (context) Object.assign(entry, sanitize(context));
  if (err instanceof Error) {
    entry.error_message = err.message;
    if (process.env.NODE_ENV !== "production") {
      entry.error_stack = err.stack;
    }
  } else if (err !== undefined) {
    entry.error_message = String(err).slice(0, 400);
  }
  return entry;
}

function emit(entry: Record<string, unknown>) {
  // Use process.stdout directly so output is never buffered or intercepted
  try {
    process.stdout.write(JSON.stringify(entry) + "\n");
  } catch {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  info(event: string, context?: Record<string, unknown>) {
    emit(buildEntry("info", event, context));
  },
  warn(event: string, context?: Record<string, unknown>) {
    emit(buildEntry("warn", event, context));
  },
  error(event: string, err: unknown, context?: Record<string, unknown>) {
    emit(buildEntry("error", event, context, err));
  },
  debug(event: string, context?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== "production" || process.env.ENABLE_VERBOSE_CHECKPOINTS === "true") {
      emit(buildEntry("debug", event, context));
    }
  },
};
