# Stripe Promo Test Reconstruction Report

**Source of ground truth**: live-mode Stripe Dashboard → Transactions, screenshot provided directly by the
user (not queried via API — see `STRIPE_EVENT_AUDIT_REPORT.md` for why API access wasn't available).

## Real transaction record (confirmed from the Dashboard)

| Time (Jun 19) | Amount | Status | Payment method | Description | Decline reason |
|---|---|---|---|---|---|
| 8:30 AM | $0.50 | **Failed** | card •••• 7908 | One-Time Mosquito Treatment | Generic decline |
| 9:32 AM | $175.00 | **Incomplete** | — (none attempted) | One-Time Mosquito Treatment | — |
| 9:33 AM | $0.50 | **Succeeded** | card •••• 7908 | One-Time Mosquito Treatment | — |

Customer on all three: `elijahnobledev@gmail.com`. A PaymentIntent ID was visible in-browser for one of
these rows: `pi_3Tk4LJ1GVLFt2O88mHcVT8z` (exact row not confirmed — likely the succeeded $0.50 charge).
**No $1.00 amount appears anywhere in the account's transaction history.**

## Reconstructed sequence of events

1. **8:30 AM — first attempt, $0.50, declined.** This lines up with the checkout-stability bug reported
   and fixed earlier in this same session: at this time, `ScheduleFlow.tsx`'s "Retry" button was still
   broken (it nulled `paymentClientSecret` to force a fresh PaymentIntent fetch, but the `useEffect`
   computing that fetch never re-ran because `paymentClientSecret` wasn't in its dependency array — see that
   session's checkout-stability work). The fix for this shipped at commit `e5a1348`, deployed ~8:58 AM. **This
   8:30 AM decline is almost certainly the exact incident that originally surfaced that bug** — the user's
   card was declined, they likely clicked Retry, and the payment module would have vanished with no way to
   recover short of restarting the checkout.
2. **9:32 AM — second attempt, fresh checkout, $175.00, never completed ("Incomplete").** This is the
   **full, undiscounted one-time price** — no promo code had been applied yet at the point this PaymentIntent
   was created. This matches `applyPromoDiscount`'s behavior exactly: with `promoDiscountCents` absent/zero,
   `Math.max(50, cents - 0) = cents` — i.e., the full price, unmodified.
3. **One minute later, 9:33 AM — third PaymentIntent, $0.50, succeeded.** This is the **same checkout
   session, after the 100%-off promo code was applied**. Applying a promo in `ScheduleFlow.tsx` calls
   `setPaymentClientSecret(null); setPaymentIntentId(null);`, which (after today's earlier dependency-array
   fix) correctly re-triggers `/api/billing/create-payment-intent` — but **as a brand-new PaymentIntent**,
   not a re-use of the $175 one. The $175 PaymentIntent was simply abandoned, not cancelled, which is why it
   sits as "Incomplete" forever in the Dashboard.

## A newly-confirmed, related finding: orphaned one-time/annual PaymentIntents on promo reapplication

This is the same class of problem fixed earlier today for **subscriptions** (see that session's
"Reuse incomplete subscriptions on checkout retry" fix) — but that fix only covers the subscription branch
of `create-payment-intent`. The **one_time and annual branches have no equivalent reuse/cleanup logic**, and
this $175 "Incomplete" PaymentIntent is live, current, Dashboard-visible proof that the same gap exists
there: applying a promo code (or retrying after a decline) on a one_time/annual checkout abandons the
previous PaymentIntent rather than reusing or cancelling it. Not in scope to fix under this investigation's
"do not change checkout behavior yet" constraint — flagged for a future pass.

## Reconstructed amounts at each stage

| Stage | Amount | Source |
|---|---|---|
| Original one-time service price | **$175.00** | Directly observed — the 9:32 AM "Incomplete" PaymentIntent, created before any promo was applied |
| Promo discount (100% off) | **$175.00** (i.e. the full price) | Computed: `adminPromos.ts`'s `/promos/validate` returns `discount_cents = Math.floor(order_total_cents * 1.00)` = `order_total_cents` exactly, for any 100%-off code |
| Tax | **Not applicable** — `STRIPE_AUTO_TAX` is unset in both the local and Netlify production environment (confirmed via `netlify env:get --context production`), so `automatic_tax` was never enabled on this PaymentIntent | Confirmed via direct environment check, not inferred |
| Frontend-computed "Due Today" display | Per code: `Math.max(50, paymentCents - discountCents)` = `Math.max(50, 17500 - 17500)` = **$0.50** | Code-derived — see `FRONTEND_BACKEND_AMOUNT_MISMATCH_REPORT.md` for why this should have displayed $0.50, not $1, and why the user's "~$1" recollection couldn't be reproduced from any code path found |
| Backend PaymentIntent amount sent to Stripe | `Math.max(50, cents - Math.min(promoDiscountCents, cents))` = same formula, same result = **$0.50** | Code-derived, matches the Dashboard-observed $0.50 exactly |
| Stripe actual charge | **$0.50, succeeded** | Directly observed in the Dashboard |

## What this reconstruction confirms with direct evidence

- The backend's $0.50 floor behaved exactly as the code predicts — the live, real charge is $0.50, matching
  `Math.max(50, ...)` for a 100%-off code on a $175 base price.
- The full, pre-discount one-time price for this test was $175.00, not some smaller amount that might have
  made a "$1ish" display more plausible through a different calculation path.
- No tax was added (confirmed via environment check, not assumption).
- There is no Stripe-side trace of a $1.00 amount ever being created, attempted, or charged for this
  customer on this date.

## What remains unconfirmed (would need the PaymentIntent detail page, not just the list view)

- Exact `metadata` fields on the succeeded PaymentIntent (expected, per code: `user_id`, `property_id`,
  `tier_key`, `cadence_days`, `promo_code_id`, `stripe_promotion_code_id`, `program: "one_time"`).
- The linked Charge ID, `amount_received` vs `amount`, `capture_method`, and balance transaction status.
- Whether `promo_codes.used_count` was actually incremented for this transaction (a DB check, not a Stripe
  check — see `STRIPE_100_PERCENT_PROMO_INVESTIGATION_FINAL_REPORT.md` Q8).

These would sharpen `STRIPE_EVENT_AUDIT_REPORT.md` further but are not required to answer this
investigation's core question (why $0.50 was charged, and whether "$1" is explainable) — both are already
answered with high confidence from what's confirmed above.
