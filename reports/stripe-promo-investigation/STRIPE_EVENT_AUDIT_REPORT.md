# Stripe Event Audit Report

## Access situation

Local `.env`'s `STRIPE_SECRET_KEY` is **test-mode** (`sk_test_...`). The transaction in question happened in
**live mode** (real bank activity), which a test-mode key cannot see — confirmed by querying the test-mode
API directly (`GET /v1/payment_intents`): 34 total PaymentIntents exist in test mode, none under $2.00, none
matching this test. Given the choice between documenting Dashboard-lookup steps, having the user paste data,
or temporarily handling a live secret key, **the user provided a live-mode Dashboard screenshot directly**,
which is the source for everything below. No live Stripe credentials were requested, viewed, or handled by
the assistant at any point in this investigation.

## Confirmed from the Stripe Dashboard (Transactions list view)

| Field | Value |
|---|---|
| Account | `acct_1T8zGo1GVLFt2O88` ("No More Mosquitoes," live mode — the dashboard URL has no `/test/` segment) |
| Customer email | `elijahnobledev@gmail.com` |
| Payment method | card ending `7908` |
| Description | "One-Time Mosquito Treatment" |
| Succeeded transaction | **$0.50 USD**, Jun 19, 9:33 AM, status **Succeeded** |
| Immediately preceding transaction | **$175.00 USD**, Jun 19, 9:32 AM, status **Incomplete** (no payment method ever attached — abandoned, not declined) |
| Earlier same-day transaction | **$0.50 USD**, Jun 19, 8:30 AM, status **Failed**, decline reason **"Generic decline"** |
| A PaymentIntent ID visible in-browser | `pi_3Tk4LJ1GVLFt2O88mHcVT8z` (exact corresponding row not confirmed) |

Account-wide context visible in the same view: 9 total transactions, 1 succeeded, 0 refunded, 0 disputed, 1
failed, 0 uncaptured. Several unrelated `$95.00`/`$125.00` "Subscription creation" entries are visible
(Incomplete/Canceled) — these belong to separate subscription-flow testing, not this one-time-service test,
and are out of scope for this investigation.

## Determination: what is the $0.50?

Based on the confirmed data above plus the code audit in `STRIPE_PROMO_MINIMUM_CHARGE_CODE_AUDIT.md`:

- **Not an authorization hold** — the Dashboard shows status **Succeeded**, not "Uncaptured" (the
  account's own status filters distinguish these, and "Uncaptured: 0" is shown account-wide).
- **A fully captured charge** — Stripe's default `capture_method` for a PaymentIntent is `automatic`
  (this codebase's `create-payment-intent` handler never overrides `capture_method` for the one_time/annual
  branches — confirmed by its absence from the request body construction in `billingStripe.ts`), so the
  $0.50 was captured immediately on success, not left pending.
- **The application's own coded minimum**, not a Stripe-imposed surprise — $0.50 is exactly what
  `Math.max(50, cents - Math.min(promoDiscountCents, cents))` produces for a 100%-off code, and it is also
  Stripe's own platform-wide minimum chargeable amount for a USD PaymentIntent. The two facts coincide
  because the code was deliberately written to float at exactly Stripe's minimum (see the inline comment
  in `billingStripe.ts`: "Stripe minimum charge is 50 cents").
- **Not a tax-related residual** — `STRIPE_AUTO_TAX` is unset in both local and production environments
  (confirmed via `netlify env:get STRIPE_AUTO_TAX --context production`), so no automatic tax calculation
  ran on this PaymentIntent.
- **Not live/test mode confusion** — the Dashboard screenshot is unambiguously live mode, and the charge
  amount matches live-mode bank activity as reported.

## What remains unconfirmed without a deeper Dashboard drill-down

The list view does not show, and would require opening the specific PaymentIntent/Charge detail page to
confirm:
- Exact `amount` vs `amount_received` on the PaymentIntent object (expected to be identical — 50/50 — for
  a normal automatic-capture success, but not directly observed).
- The linked Charge ID and its `balance_transaction` status (pending settlement vs. already settled to the
  connected bank account).
- The PaymentIntent's `metadata` object (expected fields per code: `user_id`, `property_id`, `tier_key`,
  `cadence_days`, `promo_code_id`, `stripe_promotion_code_id`, `program: "one_time"`).
- Whether any `refunds` array is non-empty (the account-wide "Refunded: 0" counter strongly suggests not,
  but this is account-wide, not PaymentIntent-specific confirmation).

None of these are required to answer the investigation's core questions — they would only add precision to
already-confident conclusions. If sharper numbers are wanted later, opening
`pi_3Tk4LJ1GVLFt2O88mHcVT8z` directly in the Dashboard (or the actual succeeded row, if that ID corresponds
to a different row) would supply them.
