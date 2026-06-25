# Error Handling Standard
**Date:** 2026-06-02

---

## Standard Response Format

### Error Response

```typescript
{
  ok: false,
  errorCode: string,    // machine-readable code from ERROR_CODES
  message: string,      // safe, user-facing message (max 200 chars)
  requestId: string,    // UUID for log tracing
  checkpoint?: string,  // where in the flow this failed (optional)
  details?: Record<string, unknown>  // admin/debug context — never include secrets
}
```

### Success Response (optional wrapper)

```typescript
{
  ok: true,
  requestId: string,
  data: T
}
```

---

## Error Code Conventions

**File:** `server/lib/apiErrors.ts`

| Code | HTTP Status | When to use |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid auth token |
| `FORBIDDEN` | 403 | Valid auth but insufficient role |
| `INVALID_INPUT` | 400 | Generic validation failure |
| `INVALID_ADDRESS` | 400 | Parcel / address validation |
| `STRIPE_NOT_CONFIGURED` | 501 | Stripe key missing |
| `STRIPE_PAYMENT_FAILED` | 402 | Payment not succeeded |
| `BOOKING_FAILED` | 500 | confirm-booking crash |
| `PARCEL_LOOKUP_FAILED` | 503 | GIS lookup failed |
| `MANUAL_REVIEW_REQUIRED` | 422 | Parcel needs human review |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `ROUTE_VALIDATION_FAILED` | 400 | Workforce validation blocked |
| `WORKFORCE_BLOCKED` | 400 | Publish gate active |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `FEATURE_DISABLED` | 503 | Feature flag is off |

---

## Safe Message Rules

1. **Never include stack traces** in `message`. Strip anything matching `at .*\.ts:\d+`.
2. **Never include secrets** — no `sk_`, `service_role`, `password`, `token`, `key=`.
3. **Length limit** — `safeErrorMessage()` caps at 200 characters.
4. **Provider error passthrough** — Stripe/Twilio/Resend errors must be sanitized before passing to the client.
5. **Fallback message** — `safeErrorMessage(err, "An unexpected error occurred. Please try again.")` for any catch block.

---

## Helper Functions

### `createApiError(errorCode, message, requestId, opts?)`
Creates the error object without sending it. Use when you need to log before responding.

### `sendApiError(res, statusCode, errorCode, message, requestId, opts?)`
Creates and sends the error response in one call.

### `safeErrorMessage(err, fallback?)`
Extracts a user-safe message from any thrown value. Strips secrets and stack traces.

### `normalizeUnknownError(err)`
Returns `{ message, internalDetail }` — use `message` for logs, `internalDetail` for structured logger.

---

## Examples

### Billing error (confirm-booking)
```json
{
  "ok": false,
  "errorCode": "BOOKING_FAILED",
  "message": "Failed to confirm booking",
  "requestId": "a1b2c3d4-...",
  "checkpoint": "billing.error"
}
```

### Route publish blocked
```json
{
  "ok": false,
  "requestId": "a1b2c3d4-...",
  "checkpoint": "route.publish.blocked",
  "errorCode": "WORKFORCE_BLOCKED",
  "error": "Workforce validation failed — cannot publish",
  "validation": { ... }
}
```

### Parcel lookup failure
```json
{
  "ok": false,
  "code": "PARCEL_LOOKUP_FAILED",
  "message": "Unable to look up parcel data. Please try again.",
  "requestId": "a1b2c3d4-..."
}
```

---

## Applied To

| Route | Status |
|-------|--------|
| `POST /api/billing/confirm-booking` | DONE |
| `POST /api/admin/routes/day/publish` | DONE (validation gate) |
| `POST /api/admin/debug/system-status` | DONE |
| `POST /api/parcel/quote` | Pre-existing structured errors |
| All future new routes | Use `sendApiError()` from apiErrors.ts |
