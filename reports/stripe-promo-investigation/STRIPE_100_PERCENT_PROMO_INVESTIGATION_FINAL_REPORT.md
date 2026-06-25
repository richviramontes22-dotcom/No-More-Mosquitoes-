# Stripe 100%-Off Promo Investigation — Final Report

**Investigation only. No checkout behavior was changed, no refund was issued, no live Stripe settings were
touched, no promo logic was edited.**

## 1. Why was the customer charged?

Because this codebase has no code path that allows a true $0.00 checkout. Every one-time/annual
PaymentIntent is created via `Math.max(50, cents - discount)` (`billingStripe.ts:404-405`) — a deliberate
floor at Stripe's own $0.50 USD minimum chargeable amount. A 100%-off code reduces the discount-adjusted
amount to exactly $0, and `Math.max(50, 0)` always resolves to 50 cents. This is not a bug in the discount
math — it's an intentional design choice (with no $0-checkout alternative built) that guarantees *every*
100%-off code produces a 50-cent charge, every time.

## 2. Was the $0.50 charge intentional?

The **floor itself** is intentional (the code comments say so explicitly, on both the backend and the
frontend). Whether **charging anything at all on a "100% off" code** is the intended business outcome is a
separate question — almost certainly not what a customer expects "100% off" to mean, and worth a real
decision (see `ZERO_DOLLAR_CHECKOUT_OPTIONS_REPORT.md`).

## 3. Why did the UI say $1?

**Confirmed root cause, verified by direct execution, not inferred**: `ScheduleFlow.tsx`'s `fmtCents()`
display formatter uses `.toFixed(0)` — zero decimal places. `(50 cents / 100).toFixed(0)` evaluates to the
string `"1"`, so the UI displayed `"$1"` literally. This is not an approximation the user made when
recalling the test — it's the exact string the code produces for a 50-cent amount. The same bug shows on
both the "Due Today" summary and the payment button's own label.

## 4. Is this a frontend/backend mismatch?

**No — both sides compute the identical 50-cent amount.** The mismatch is not in the math; it's that the
backend sends Stripe the raw, unformatted integer (50), while the frontend runs that same number through a
*display* formatter built for whole-dollar prices, which silently destroys sub-dollar precision. See
`FRONTEND_BACKEND_AMOUNT_MISMATCH_REPORT.md` for the full step-by-step trace.

## 5. Is this caused by Stripe minimum-charge requirements?

Yes, indirectly — the $0.50 *value itself* is Stripe's own platform-wide minimum for a USD PaymentIntent
(this app's code floors at exactly that number, deliberately). But Stripe's minimum-charge rule is not what
caused the "$1" display — that's a separate, local formatting bug (see Q3).

## 6. Is the $0.50 pending or captured?

**Captured.** Confirmed live in the Stripe Dashboard: status "Succeeded," not "Uncaptured" (the account's
own status filter for this transaction shows 0 uncaptured payments). This codebase never overrides Stripe's
default `capture_method` (`automatic`), so success means captured, not authorized-and-held.

## 7. Does the booking still work correctly?

**Yes, confirmed directly from the database**: an appointment was created
(`status: "scheduled"`, `service_type: "Mosquito Service"`, `scheduled_date: 2026-06-20`,
`created_at: 2026-06-19T16:33:06 UTC`) — one second after the promo code's usage counter incremented, both
landing within the same second as the Stripe Dashboard's "9:33 AM" succeeded charge. The confusing display
did not break the underlying booking flow.

## 8. Does promo usage count correctly?

**Yes, confirmed directly from the database**: the promo code used was **`100TEST`** (100% off, not the
expired `100` code referenced earlier this session) — its `used_count` is `1`, last updated
`2026-06-19T16:33:05 UTC`, one second before the appointment was created and matching the Stripe success
timestamp exactly (16:33 UTC = 9:33 AM Pacific). Usage tracking worked as designed.

## 9. Which checkout flows are affected?

- **One-time service**: confirmed affected — this is the exact flow tested.
- **Annual plan**: affected identically — same `Math.max(50, ...)` formula, same `fmtCents` display bug,
  same code path in `ScheduleFlow.tsx`.
- **Subscription plan**: not affected by *this specific* mechanism — subscriptions use Stripe-native
  promotion codes, calculated by Stripe itself, not this app's cents-math floor. (Stripe's own handling of a
  100%-off first invoice on a subscription was not verified in this investigation and may have its own
  separate behavior worth checking before assuming it's fine.)
- **Marketplace checkout**: has a *related but distinct* bug — its frontend display floors at $0 while its
  backend floors at $0.50 (a real calculation-level mismatch, unlike the one-time/annual case where both
  sides agree and only the *display formatting* is wrong). Documented in
  `STRIPE_PROMO_MINIMUM_CHARGE_CODE_AUDIT.md` and `FRONTEND_BACKEND_AMOUNT_MISMATCH_REPORT.md` for
  completeness; not the subject of this specific user-reported test.

## 10. What fix is recommended?

Two genuinely separate problems, two separate fixes, neither implemented in this investigation:

1. **The display bug** (`fmtCents` losing sub-dollar precision) — small, mechanical, low-risk fix whenever
   it's prioritized: show cents for amounts under some threshold (e.g. under $10), or simply never round to
   zero decimal places for sub-dollar amounts.
2. **The business-rule decision** (should 100%-off ever charge anything) — see
   `ZERO_DOLLAR_CHECKOUT_OPTIONS_REPORT.md`. Recommended: Option A (skip Stripe entirely) for one-time
   services; Option B (SetupIntent, no charge) for annual/subscription plans where a card needs to stay on
   file for renewal.

## 11. Should the system support true free checkout?

**Yes, for one-time services specifically** — there's no future billing relationship to protect by forcing
a token charge, so a genuine $0 experience (Option A) is both technically clean and matches what "100% off"
should mean to a customer. For annual/subscription plans, "true free" should still mean "no charge today,"
but a verified card on file (Option B) is the right middle ground given those plans bill again later.

## 12. Should fixes be implemented in a separate sprint?

**Yes.** This investigation's constraints explicitly excluded implementation, and that's the right call
here too even outside those constraints — the display-bug fix is trivial and low-risk, but the zero-dollar
business-rule decision (Option A vs. B, and whether to retrofit Option B onto the existing subscription
promo-code path too) deserves an explicit go-ahead and its own focused implementation/testing pass, not a
same-investigation drive-by fix.

## What this investigation did not change

- No refund was issued for the $0.50 charge.
- No live Stripe settings, promo codes, or coupons were modified.
- No checkout code was edited.
- The `100TEST` promo code, the test appointment, and the $0.50/$175.00/$0.50 Stripe transactions all remain
  exactly as they were before this investigation began.
