# Frontend vs Backend Amount Mismatch Report

## The root cause, in one sentence

The frontend's display-formatting function (`fmtCents`) rounds to the nearest whole dollar with no cents
precision; 50 cents rounds up to exactly "$1" — so the UI displayed the *literal, correct rounding* of an
amount it never miscalculated, while the *actual unrounded* amount of 50 cents was what was really sent to
Stripe and charged. There is no calculation mismatch. There is a **display-precision bug**.

## Step-by-step trace

| Step | Code | Value | Computed where |
|---|---|---|---|
| 1. Base one-time price | `lookupOneTimeCents(acreage)` | **17500** cents ($175.00) | Backend, `shared/pricing.ts` tier table — confirmed live: this is the exact amount of the abandoned "Incomplete" PaymentIntent in the Stripe Dashboard |
| 2. Promo discount, 100% off | `Math.floor(order_total_cents * 1.00)` | **17500** cents (100% of $175) | Backend, `adminPromos.ts` `/promos/validate` |
| 3. Discount capped to the order total | `Math.min(appliedPromo.discount_cents, paymentCents)` | **17500** cents | Frontend, `ScheduleFlow.tsx:1498` |
| 4. Discounted total, floored at Stripe's minimum | `Math.max(50, 17500 - 17500)` = `Math.max(50, 0)` | **50** cents ($0.50) | **Identical formula, both sides**: frontend `ScheduleFlow.tsx:1499`, backend `billingStripe.ts:405` |
| 5. **Frontend display string** | `fmtCents(50)` = `` `$${(50/100).toFixed(0)}` `` = `` `$${(0.5).toFixed(0)}` `` | **`"$1"`** | Frontend only — `ScheduleFlow.tsx:593-596` |
| 6. **Backend → Stripe** | `body.append("amount", String(50))` (the raw integer, never formatted/rounded) | **50** (cents, as Stripe expects) | Backend — sent directly to Stripe's `/v1/payment_intents` |
| 7. Stripe charges | — | **$0.50, succeeded** | Confirmed live in the Stripe Dashboard |

Steps 1-4 are **identical on both sides** — there is no discrepancy in the actual discount/floor math.
Step 5 is where the two sides diverge: the backend never formats the amount for display at all (it only
ever handles the raw integer cents value); the frontend does format it for display, and that formatting
function loses all sub-dollar precision.

## Where this is displayed

`amountLabel = fmtCents(discountedCents)` (`ScheduleFlow.tsx:1500`) feeds **two** visible UI elements:

1. The "Due Today" summary figure (`ScheduleFlow.tsx:1610`).
2. The payment button's own label — "Pay {amountLabel} — Confirm Service" (`PaymentStep.tsx`, passed via the
   `amountLabel` prop).

So the user would have seen "$1" twice — once in the order summary, once on the button they tapped to pay —
both showing the same wrong rounding of the same correct underlying 50-cent figure.

## Does this affect one-time only, or other flows too?

**Affects one-time and annual identically** — both go through the exact same `paymentCents` →
`discountCents` → `discountedCents` → `fmtCents` chain in `ScheduleFlow.tsx`. Any annual-plan checkout with
a discount steep enough to hit the 50-cent floor would show the identical "$1" bug.

**Does not affect subscriptions** the same way for this *specific* trigger — `ScheduleFlow.tsx`'s
subscription branch doesn't apply the cents-based discount/floor logic shown above (subscriptions use
Stripe-native promotion codes, calculated entirely on Stripe's side, not this app's own
`Math.max(50, ...)` arithmetic) — see `STRIPE_PROMO_MINIMUM_CHARGE_CODE_AUDIT.md`. However, `fmtCents` itself
is used for *other* subscription-related displays too (e.g. `fmtCents(subPriceCents)`), so any subscription
price that happened to be a sub-$1.50 amount would hit the same display bug — unlikely in practice (real
subscription prices are tens of dollars), but the formatting function itself is the shared root cause,
wherever a sub-$1.50 amount reaches it.

**Marketplace checkout** (`CheckoutReview.tsx`) is a *separate* bug, not this one — it uses
`Math.max(0, ...)` for its own display (no floor at all displayed), which is inconsistent with its own
backend's `Math.max(50, ...)`, but that's a calculation-floor mismatch, not the `fmtCents` rounding bug
described here. Both are real, both are documented, neither is fixed in this investigation.

## Is this a "frontend uses a different minimum than backend"?

**No.** Both sides compute the identical 50-cent minimum. The bug is entirely in how the frontend *displays*
a number it calculated correctly — a cents-aware amount run through a dollars-only, zero-decimal formatter.
