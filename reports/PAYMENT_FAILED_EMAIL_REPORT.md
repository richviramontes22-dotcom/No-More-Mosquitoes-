# Payment Failed Email Report

**Date:** 2026-05-30

## Implementation
**File:** `server/routes/webhooksStripe.ts`
**Trigger:** `invoice.payment_failed` Stripe webhook event

## What Was Implemented
1. After marking subscription as `past_due`, a fire-and-forget async block sends a payment failure email.
2. Customer email is looked up from `subscriptions` → `profiles` tables using the subscription ID.
3. Amount formatted from `invoice.amount_due` in cents → display string (e.g. "$49.99").
4. Duplicate prevention: checks `notification_log` for existing `payment_failed` notification with same `invoice_id` payload within 24 hours before sending.
5. Logs to `notification_log` with `type='payment_failed'` and `payload: { invoice_id }`.

## Template Used
`buildPaymentFailedEmail` from `emailTemplates.ts`
- Red warning header
- Amount and action steps
- CTA button to billing portal
- Support email contact

## Duplicate Prevention
- `isDuplicateByPayload("payment_failed", "invoice_id", invoiceId, 24)` — prevents re-sending if Stripe retries the webhook for the same invoice within 24h.

## Logging
- `notification_log.notification_type = 'payment_failed'`
- `notification_log.payload = { invoice_id: "inv_xxx" }`
- `notification_log.status = 'sent'` on success

## Provider
Uses `getEmailProvider()` (ResendEmailProvider when RESEND_API_KEY set, NullEmailProvider otherwise).
