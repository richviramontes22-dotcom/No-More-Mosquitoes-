# Error Handling Audit
**Date:** 2026-06-08
**Basis:** Source code inspection — apiErrors.ts, billingStripe.ts, employeeAssignments.ts, adminAppointments.ts, adminRoutes.ts, webhooksStripe.ts, health.ts, all Netlify functions

---

## Standard Error Response Format

The system defines a standard `ApiErrorResponse` interface in `server/lib/apiErrors.ts`:

```json
{
  "ok": false,
  "errorCode": "STRIPE_PAYMENT_FAILED",
  "message": "User-safe message",
  "requestId": "req_abc123",
  "checkpoint": "billing.payment.verified",
  "details": {}
}
```

**Predefined error codes:**
- UNAUTHORIZED, FORBIDDEN
- INVALID_INPUT, MISSING_REQUIRED_FIELD, INVALID_ADDRESS
- STRIPE_NOT_CONFIGURED, STRIPE_PAYMENT_FAILED, STRIPE_CUSTOMER_ERROR, STRIPE_PRICE_NOT_FOUND, BOOKING_FAILED
- PARCEL_LOOKUP_FAILED, MANUAL_REVIEW_REQUIRED, RATE_LIMITED
- ROUTE_VALIDATION_FAILED, TECHNICIAN_UNAVAILABLE, CAPACITY_EXCEEDED, BLACKOUT_CONFLICT, WORKFORCE_BLOCKED
- INTERNAL_ERROR, NOT_FOUND, FEATURE_DISABLED

---

## Request ID Tracing

| Check | Status | Evidence |
|-------|--------|---------|
| requestIdMiddleware assigns UUID per request | ✅ | server/middleware/requestId.ts |
| x-request-id response header included | ✅ | requestIdMiddleware sets header |
| requestId flows into structured log events | ✅ | logger.info/error uses requestId |
| requestId included in error responses | ✅ | apiErrors.ts createApiError() |
| Billing flow uses requestId in checkpoints | ✅ | billingStripe.ts checkpoint() calls |
| Routing flow uses requestId | ✅ | adminRoutes.ts checkpoint() calls |

---

## Critical Path Error Handling — Billing

| Scenario | Handled | HTTP Status | Evidence |
|----------|---------|-------------|---------|
| Missing propertyId | ✅ | 400 | billingStripe.ts validation |
| Zero or NaN acreage | ✅ | 400 | create-payment-intent validation |
| Stripe not configured | ✅ | 503 | STRIPE_NOT_CONFIGURED check |
| Stripe price not found | ✅ | 400 | findStripePriceAsync error |
| Stripe API timeout | ✅ | 504/500 | 6s timeout per Stripe API call |
| PaymentIntent not succeeded | ✅ | 402 | confirm-booking status check |
| Appointment creation failed | ✅ | 500 | DB error returned |
| Annual plan rejected at billing | ✅ | 400 | Explicit rejection with message |
| Stripe key test-in-production | ✅ | Warning (non-fatal) | assertStripeKeyNotTestInProduction() |

---

## Critical Path Error Handling — Webhooks

| Scenario | Handled | Evidence |
|----------|---------|---------|
| Invalid signature | ✅ | 400 + notifyAdminCritical() |
| Unknown event type | ✅ | Ignored gracefully (no crash) |
| DB error on invoice.paid | ✅ | Error logged, 200 returned to Stripe (prevents retry storm) |
| Missing payment data | ✅ | Guard clauses before DB writes |

---

## Critical Path Error Handling — Parcel / Acreage

| Scenario | Handled | Evidence |
|----------|---------|---------|
| Unknown ZIP / county | ✅ | MANUAL_REVIEW_REQUIRED response |
| GIS API timeout | ✅ | Timeout + fallback chain |
| County lookup disabled | ✅ | Feature flag gate → fallback path |
| Regrid disabled | ✅ | ENABLE_REGRID_FALLBACK=false default |
| Rate limit hit | ✅ | RATE_LIMITED error code |

---

## Critical Path Error Handling — Employee Assignments

| Scenario | Handled | Evidence |
|----------|---------|---------|
| Unauthenticated request | ✅ | 401 via getAuthenticatedEmployee() |
| Assignment not found | ✅ | 404 |
| Employee doesn't own assignment | ✅ | 403 ownership check |
| Invalid status value | ✅ | 400 VALID_STATUSES check |
| DB write failure | ✅ | 500 with error message |
| Email/SMS failure | ✅ | Fire-and-forget; never blocks response |
| GPS snapshot failure | ✅ | Fire-and-forget; caught + logged |
| Route sync failure | ✅ | Fire-and-forget; caught + logged |

---

## Non-Fatal Patterns (Fire-and-Forget)

These operations are wrapped in async fire-and-forget blocks and **never block the response or propagate errors:**

- All email sends (customer notifications, employee notifications)
- All SMS sends
- GPS snapshot storage
- Route stop synchronization
- Admin alert notifications
- Notification log writes

This is the correct pattern: business operations succeed even if observability or notification systems fail.

---

## Error Message Safety

`safeErrorMessage()` in apiErrors.ts:
- Strips stack traces (detects `.ts:` lines)
- Strips anything matching `sk_|service_role|secret|password|token|key=`
- Truncates to 200 chars
- Falls back to generic message

Used in: billing routes, parcel routes, Stripe error handling.

---

## Structured Logging Coverage

| Area | Coverage |
|------|---------|
| Billing flow | ✅ checkpoint() at each step |
| Parcel lookup | ✅ checkpoint() + logger.info/error |
| Route generation | ✅ checkpoint() + logger.info/warn/error |
| Reminder batch | ✅ checkpoint() + logger.info |
| Webhook processing | ✅ console.log/error (not structured logger) |
| Employee assignments | ✅ console.log/error (not structured logger) |

**Gap:** Employee assignment routes and webhook routes use `console.log/error` rather than the structured `logger` module. These will appear in Netlify logs but without the structured JSON format used by other routes.

---

## React Error Boundaries (Frontend)

| Check | Status |
|-------|--------|
| Error boundary in app shell | ✅ Implemented (REACT_ERROR_BOUNDARY_REPORT.md) |
| Loading states on all async data | ✅ React Query patterns |
| Stripe payment errors surfaced to user | ✅ PaymentElement shows card errors inline |
| Onboarding error states | ✅ ScheduleFlow error handling |

---

## Netlify Function Error Handling

| Function | Fatal Crash Handled | Returns 500 |
|----------|--------------------|-----------| 
| send-reminders | ✅ try/catch wrapper | ✅ |
| generate-appointments | ✅ try/catch wrapper | ✅ |
| expire-annual-plans | ✅ try/catch wrapper | ✅ |
| send-annual-warnings | ✅ try/catch wrapper | ✅ |

---

## Missing / Gaps

| Gap | Severity | Notes |
|-----|----------|-------|
| Webhook routes use console.log not structured logger | LOW | Works; just inconsistent format in logs |
| Employee assignment routes use console.log not logger | LOW | Same as above |
| No global Express error handler middleware | MEDIUM | Uncaught errors in async route handlers will crash with unhandled promise rejection; most are caught but not all |
| Sentry disabled by default | LOW | ENABLE_SENTRY=true + SENTRY_DSN required; not yet configured for production |
| Admin not alerted when scheduled functions fail | LOW | Netlify email alerts cover this but no in-app admin_alert record |
| safeErrorMessage() not consistently used in all 500 responses | LOW | Most routes return raw error.message which may leak DB error details |
