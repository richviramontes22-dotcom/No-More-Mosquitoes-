/**
 * Standard API error utilities.
 *
 * Every error response from a critical route should use this format so that:
 * - Frontend can reliably parse errors
 * - Logs include requestId + checkpoint for tracing
 * - User-facing messages are safe (no secrets, no stack traces)
 */

export interface ApiErrorResponse {
  ok: false;
  errorCode: string;
  message: string;         // safe, user-facing
  requestId: string;
  checkpoint?: string;     // where in the flow did this fail
  details?: Record<string, unknown>;  // admin/debug details — never include secrets
}

export interface ApiSuccessEnvelope<T = unknown> {
  ok: true;
  requestId: string;
  data: T;
}

// ─── Predefined error codes ───────────────────────────────────────────────────

export const ERROR_CODES = {
  // Auth
  UNAUTHORIZED:            "UNAUTHORIZED",
  FORBIDDEN:               "FORBIDDEN",

  // Validation
  INVALID_INPUT:           "INVALID_INPUT",
  INVALID_ADDRESS:         "INVALID_ADDRESS",
  MISSING_REQUIRED_FIELD:  "MISSING_REQUIRED_FIELD",

  // Billing / Stripe
  STRIPE_NOT_CONFIGURED:   "STRIPE_NOT_CONFIGURED",
  STRIPE_PAYMENT_FAILED:   "STRIPE_PAYMENT_FAILED",
  STRIPE_CUSTOMER_ERROR:   "STRIPE_CUSTOMER_ERROR",
  STRIPE_PRICE_NOT_FOUND:  "STRIPE_PRICE_NOT_FOUND",
  BOOKING_FAILED:          "BOOKING_FAILED",

  // Parcel
  PARCEL_LOOKUP_FAILED:    "PARCEL_LOOKUP_FAILED",
  MANUAL_REVIEW_REQUIRED:  "MANUAL_REVIEW_REQUIRED",
  RATE_LIMITED:            "RATE_LIMITED",

  // Routing / Workforce
  ROUTE_VALIDATION_FAILED: "ROUTE_VALIDATION_FAILED",
  TECHNICIAN_UNAVAILABLE:  "TECHNICIAN_UNAVAILABLE",
  CAPACITY_EXCEEDED:       "CAPACITY_EXCEEDED",
  BLACKOUT_CONFLICT:       "BLACKOUT_CONFLICT",
  WORKFORCE_BLOCKED:       "WORKFORCE_BLOCKED",

  // Reminder
  REMINDER_BATCH_FAILED:   "REMINDER_BATCH_FAILED",

  // General
  INTERNAL_ERROR:          "INTERNAL_ERROR",
  NOT_FOUND:               "NOT_FOUND",
  FEATURE_DISABLED:        "FEATURE_DISABLED",
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function createApiError(
  errorCode: string,
  message: string,
  requestId: string,
  opts?: { checkpoint?: string; details?: Record<string, unknown> }
): ApiErrorResponse {
  return {
    ok: false,
    errorCode,
    message,
    requestId,
    ...(opts?.checkpoint ? { checkpoint: opts.checkpoint } : {}),
    ...(opts?.details ? { details: opts.details } : {}),
  };
}

export function sendApiError(
  res: any,
  statusCode: number,
  errorCode: string,
  message: string,
  requestId: string,
  opts?: { checkpoint?: string; details?: Record<string, unknown> }
): void {
  res.status(statusCode).json(createApiError(errorCode, message, requestId, opts));
}

/** Extracts a safe user-facing message from any thrown value. Never includes stack traces. */
export function safeErrorMessage(err: unknown, fallback = "An unexpected error occurred. Please try again."): string {
  if (!err) return fallback;
  if (typeof err === "string") return err.slice(0, 200);
  if (err instanceof Error) {
    const msg = err.message || fallback;
    // Strip anything that looks like a secret, stack trace, or internal path
    if (/sk_|service_role|secret|password|token|key\s*=/i.test(msg)) return fallback;
    if (msg.includes("at ") && msg.includes(".ts:")) return fallback;  // stack trace
    return msg.slice(0, 200);
  }
  return fallback;
}

/** Normalizes any caught value into { message, internalDetail } for structured logging. */
export function normalizeUnknownError(err: unknown): { message: string; internalDetail: string } {
  if (err instanceof Error) {
    return { message: err.message, internalDetail: err.stack || err.message };
  }
  const str = String(err);
  return { message: str.slice(0, 200), internalDetail: str };
}
