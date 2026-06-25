# Promo Code / Discount System Audit
**Date:** 2026-06-17
**Trigger:** A customer reported there's no place to enter a promo code during checkout.

---

## Answers

### Does promo support already exist?
Yes — but only on one of the two checkout paths in the app, and the customer's report was accurate for the path they were on.

| Checkout path | Promo UI present? | Backend wired? |
|---|---|---|
| **Marketplace add-ons** (`client/components/marketplace/CheckoutReview.tsx`, used from `client/pages/dashboard/Marketplace.tsx`) | ✅ Yes — input, Apply button, discount display, updated total | ✅ Yes — `server/routes/marketplaceStripe.ts` applies the discount to the PaymentIntent amount and records `promo_code_id`/`stripe_promotion_code_id` in metadata |
| **Main onboarding checkout** (`client/components/schedule/ScheduleFlow.tsx`, used from `client/pages/Onboarding.tsx` for one-time/annual/subscription signup — the flow that handles the actual mosquito-treatment plans) | ❌ **No promo input existed before this sprint** | ❌ **`server/routes/billingStripe.ts`'s `create-payment-intent` had no promo parameters before this sprint** |

The customer was checking out a service plan (one-time, annual, or subscription) — the main flow, which had zero promo support. That's the gap this sprint closes.

### Is Stripe coupon functionality already configured?
Partially, and with a bug. `server/routes/adminPromos.ts` creates a Stripe Coupon + Promotion Code whenever an admin creates a promo code in the internal UI — but the coupon-creation call was missing the `duration` parameter, which Stripe requires on every coupon. Without it, the Stripe API call would fail, the failure is caught and logged as a non-fatal warning, and `stripe_coupon_id`/`stripe_promotion_code_id` are left `null` on the saved row. In practice this means **every promo code created through the admin UI was "local only"** — visible in the `Promos.tsx` admin page's "Stripe" column as "Local only" rather than "Synced" — and could never be applied to a Stripe Subscription (which requires a real Stripe promotion code object). This bug is fixed in this sprint (`duration: "once"` added).

### Is the checkout flow missing a promo-code UI?
Yes, for the main flow — confirmed above. Built this sprint.

### Is a custom discount engine required?
No. Everything needed — percent/fixed discounts, min-order thresholds, usage limits, expiry — is already modeled in the `promo_codes` table and already calculated server-side in `/api/promos/validate`. For one-time/annual PaymentIntents, the discount is applied by directly reducing the charge amount (mirroring the existing marketplace pattern). For subscriptions, the discount is applied via Stripe's own `discounts[0][promotion_code]` parameter at subscription creation — Stripe computes the discounted invoice itself. No custom math for recurring billing was written.

### What is the safest implementation?
Reuse the exact pattern already proven in the marketplace checkout (client validates via `/api/promos/validate`, then passes `discount_cents`/`stripe_promotion_code_id`/`promo_code_id` to the PaymentIntent-creation endpoint) for one-time/annual, and use Stripe's native subscription discount mechanism for recurring plans — never hand-roll recurring discount math. This is what was implemented (see `PROMO_CODE_IMPLEMENTATION_REPORT.md`).

---

## Additional Findings

### `promo_codes` / `campaigns` schema has no tracked migration
`db/migrations/` contains no file creating `promo_codes`, `campaigns`, or the `increment_promo_used_count` Postgres function referenced in `server/routes/webhooksStripe.ts`. The admin UI even has a leftover hint reading "Run the Phase 6 SQL in Supabase first" — confirming a SQL script was run directly against Supabase outside this project's documented migration convention ("applied manually via the Supabase SQL Editor in filename (chronological) order"). A backfill migration, `db/migrations/2026-06-17_promo_codes_and_campaigns.sql`, was added this sprint (idempotent — safe whether or not the tables already exist in a given environment) to close this tracking gap.

### Usage-counter redemption already exists for the marketplace flow, not the main flow
`server/routes/webhooksStripe.ts`'s `payment_intent.succeeded` handler increments `promo_codes.used_count` after a confirmed payment — but only inside a block gated by `purchase_type === "marketplace"`. The main onboarding flow had no equivalent increment anywhere, meaning **even if a promo code had been wired into the main checkout, its usage count would never have updated** — `max_uses` limits would have been silently unenforceable for that flow. Addressed in this sprint (see implementation report).

### `create-checkout-session` endpoint is unused dead code
`server/routes/billingStripe.ts`'s `POST /create-checkout-session` (a Stripe-hosted-redirect flow) is only referenced by `client/hooks/checkout/useCheckoutFlow.ts`, which itself is not imported anywhere in the client. It was left untouched this sprint — adding promo support to dead code would be wasted surface area.
