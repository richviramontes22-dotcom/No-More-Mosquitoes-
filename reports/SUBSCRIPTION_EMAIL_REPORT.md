# Subscription Email Report

**Date:** 2026-05-30

## Subscription Activated
**Trigger:** `checkout.session.completed` where `session.mode === 'subscription'`
**Template:** `buildSubscriptionActivatedEmail`
**Dedup:** `isDuplicateProfileNotification(user_id, 'subscription_activated', 48)` — 48h window to handle webhook replays
**Log type:** `subscription_activated`

## Subscription Renewed
**Trigger:** `invoice.paid` where `invoice.billing_reason === 'subscription_cycle'`
**Template:** `buildSubscriptionRenewedEmail`
**Dedup:** `isDuplicateByPayload('subscription_renewed', 'invoice_id', invoiceId, 24)` — per-invoice dedup
**Log type:** `subscription_renewed`
**Amount:** Formatted from `invoice.amount_paid` in cents

## Subscription Canceled
**Trigger:** `customer.subscription.deleted`
**Template:** `buildSubscriptionCancelledEmail`
**Dedup:** `isDuplicateProfileNotification(user_id, 'subscription_canceled', 24)`
**Log type:** `subscription_canceled`
**Plan name:** Derived from `subscriptions.program` column ('annual' → "Annual Plan", else "Monthly Subscription")

## Notes
- All emails are fire-and-forget (wrapped in async IIFE) — never block the HTTP response
- All use `getEmailProvider()` — NullEmailProvider is safe fallback when RESEND_API_KEY not set
- `subscription_canceled` was already in the DB constraint from the 2026-05-29 migration
- `subscription_activated` and `subscription_renewed` added in 2026-05-30 migration
