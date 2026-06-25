# Annual Plan Lifecycle Report
**Sprint 1B — No More Mosquitoes**
**Date:** 2026-05-28

---

## Problem

Annual plans use a Stripe PaymentIntent (one-time charge), not a Stripe Subscription. This means:

1. `invoice.paid` webhook never fires for annual plans
2. No `subscriptions` row was written after purchase
3. Year 2 renewal had no trigger — customers would silently lose service after 12 months
4. Admin dashboard showed no subscription record for annual plan customers

---

## Solution

Write a `subscriptions` row immediately after annual plan payment, using the PaymentIntent ID as the key and setting `current_period_end = now + 1 year`.

### Database Migration

**`db/migrations/2026-05-28_annual_plan_tracking.sql`**

Added columns to `subscriptions`:
- `cadence_days INTEGER` — treatment interval (e.g. 21 days)
- `program TEXT` — `'subscription'` or `'annual'`
- `last_invoice_id TEXT` — for deduplication
- `last_payment_at TIMESTAMPTZ` — when last payment was received
- `current_period_start TIMESTAMPTZ`
- `amount_cents INTEGER`
- `currency TEXT DEFAULT 'usd'`

Backfills `program = 'subscription'` for all existing `sub_` rows.

### Payment Confirmation (`server/routes/billingStripe.ts`)

**Guard change:** The existing recurring subscription upsert now excludes `program === 'annual'`.

**New annual plan block** (runs when `program === 'annual' && paymentIntentId`):
```typescript
const periodEnd = new Date();
periodEnd.setFullYear(periodEnd.getFullYear() + 1);
await supabaseAdmin.from("subscriptions").upsert({
  stripe_subscription_id: paymentIntentId,   // PI ID as unique key
  user_id, property_id, status: "active",
  program: "annual",
  cadence_days,
  current_period_end: periodEnd.toISOString(),
  last_payment_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}, { onConflict: "stripe_subscription_id" });
```

### Webhook Fallback (`server/routes/webhooksStripe.ts`)

`payment_intent.succeeded` now also writes the annual subscription row, covering cases where the client confirmation call fails or is retried. Destructures `program`, `user_id`, `property_id`, `cadence_days` from PI metadata.

---

## Year 2 Renewal Path

With `current_period_end` now stored, the admin dashboard can surface expiring annual plans. A future cron job or webhook can check `current_period_end < now + 30 days` and trigger renewal outreach.

---

## Verification

- `pnpm typecheck` — no errors
- Upsert uses `onConflict: "stripe_subscription_id"` — idempotent on retry
- Existing recurring subscription logic (`sub_` IDs) unaffected by the new guard
