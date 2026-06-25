# Promo Code Validation Report
**Date:** 2026-06-17

## Commands Run

| Command | Result |
|---|---|
| `pnpm typecheck` | ✅ Pass — 0 errors |
| `pnpm test` | ✅ Pass — 7 test files, 68 tests, 0 failures |
| `pnpm build` | ✅ Pass — client + server builds succeeded; warnings present are pre-existing (chunk size, dynamic/static import notices unrelated to files touched this sprint) |

No automated test infrastructure exists for live Stripe API calls in this repo (no Stripe test-mode integration tests), so the checks below are logic/code-path verification, not live-charge verification — consistent with how the marketplace promo flow (the precedent this sprint follows) was also never covered by automated Stripe tests.

## Logic Verification

| Check | Result |
|---|---|
| Promo code field visible on the main checkout (one-time/annual/subscription) | ✅ Added to `ScheduleFlow.tsx`'s payment-step Order Summary card |
| Stripe promotion codes supported | ✅ `discounts[0][promotion_code]` wired into subscription creation; `stripe_coupon_id`/`stripe_promotion_code_id` sync bug fixed in `adminPromos.ts` |
| One-time plan: valid code reduces total, invalid code rejected | ✅ `applyPromoDiscount()` reduces PaymentIntent `amount`; `/api/promos/validate` (unchanged, pre-existing) rejects invalid/expired/exhausted/below-minimum codes with specific messages |
| Annual plan: same as one-time | ✅ Same `applyPromoDiscount()` helper used for both branches |
| Subscription: valid code applies Stripe-native discount, invalid/unsynced code rejected with a clear message | ✅ Confirmed via code path — `create-payment-intent` 400s if a subscription promo lacks `stripe_promotion_code_id`; client also pre-checks this in `handleApplyPromo` before ever calling the endpoint |
| Stripe checkout session/PaymentIntent receives the promotion code | ✅ Subscription branch passes `discounts[0][promotion_code]`; PI branches store it in metadata for record-keeping (Stripe doesn't accept a promotion code directly on a manually-priced PaymentIntent — the discount is applied to `amount` instead, matching the existing marketplace precedent) |
| Final Stripe amount matches UI | ✅ For one-time/annual, the client's displayed total uses the identical `Math.max(50, cents - discount)` formula as the server; for subscriptions, the client shows an estimate but the true amount is whatever Stripe's PaymentElement renders from the real discounted clientSecret — there's no path where the customer is charged more than what the payment form displays at confirm time |
| Taxes calculated correctly | ✅ Unchanged — `automatic_tax[enabled]` (when `STRIPE_AUTO_TAX=true`) is computed by Stripe on the post-discount amount in all branches, same as before this sprint |
| No negative totals possible | ✅ One-time/annual floored at Stripe's 50-cent minimum via `Math.max(50, ...)`; Stripe itself rejects/clamps any subscription discount that would exceed the invoice total |
| Stripe remains source of truth | ✅ No discount math was duplicated for the recurring case — Stripe computes the subscription's discounted invoice independently of any client-side estimate |
| `used_count` increments only after confirmed payment | ✅ `confirm-booking` reads the promo ID back from **Stripe-confirmed metadata** (not client-supplied request fields) after verifying `pi.status === "succeeded"` via a live Stripe API call |

## Regression Check

| Area | Result |
|---|---|
| Marketplace checkout (`CheckoutReview.tsx`, `marketplaceStripe.ts`) | ✅ Untouched this sprint |
| Existing webhook promo increment (`webhooksStripe.ts`) | ✅ Untouched — new increment logic for the main flow lives entirely in `billingStripe.ts`, no shared code path was modified |
| `create-checkout-session` (unused legacy endpoint) | ✅ Untouched — confirmed dead code (no client import) before leaving it alone |
| Existing one-time/annual/subscription checkout behavior with no promo applied | ✅ All new fields are optional with safe defaults (`promoDiscountCents` defaults to 0 via `|| 0`, `stripePromotionCodeId`/`promoDatabaseId` default to absent) — a customer who never touches the promo input gets byte-identical behavior to before this sprint |
| Routing sprint changes from earlier this session | ✅ No files from `server/routes/adminRoutes.ts`, `RoutePlanning.tsx`, or `WorkforceCapacity.tsx` were touched again during the promo sprint |

## Files Changed This Sprint

- `db/migrations/2026-06-17_promo_codes_and_campaigns.sql` (new)
- `server/routes/adminPromos.ts`
- `server/routes/billingStripe.ts`
- `client/components/schedule/ScheduleFlow.tsx`
