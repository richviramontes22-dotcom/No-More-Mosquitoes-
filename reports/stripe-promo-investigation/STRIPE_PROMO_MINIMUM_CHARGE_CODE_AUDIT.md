# Stripe Promo Minimum-Charge Code Audit

**Date**: 2026-06-19 | **Scope**: investigation only, no code changes made.

## Answers

### Is there a forced minimum charge?

**Yes, confirmed in three places**, all hardcoded:

| Location | Code | Applies to |
|---|---|---|
| `server/routes/billingStripe.ts:404-405` | `const applyPromoDiscount = (cents) => Math.max(50, cents - Math.min(promoDiscountCents \|\| 0, cents));` | one_time and annual PaymentIntent amounts (backend, authoritative) |
| `server/routes/marketplaceStripe.ts:300` | `const chargeAmount = Math.max(50, totalCents - discountCents);` | marketplace purchases (backend, authoritative) |
| `client/components/schedule/ScheduleFlow.tsx:1499` | `const discountedCents = paymentCents != null ? Math.max(50, paymentCents - discountCents) : null;` | one_time and annual **displayed** total (frontend, display-only — does not create the charge) |

### Is it $0.50 or $1.00?

**$0.50 (50 cents)**, everywhere it appears. There is **no $1.00 / 100-cent floor anywhere in this
codebase's history** — confirmed by searching the full git history (`git log --all -p -S`) for
`Math.max(100` and `Math.max(100,` across every branch and every commit: zero matches, ever. The 50-cent
value also isn't arbitrary — it's Stripe's own documented minimum chargeable amount for a USD PaymentIntent
($0.50), and the code comments at both backend sites say so explicitly ("Stripe minimum charge is 50
cents").

### Is the frontend using a different minimum than backend?

**No — for the ScheduleFlow.tsx (one_time/annual) path, frontend and backend use the identical `Math.max(50,
...)` formula**, and git history shows both were introduced in the same commit
(`6cbf3d9`, 2026-06-17) when the promo-code feature was first built — they have never diverged.

**However, a related, separate inconsistency exists in the marketplace checkout** (a different flow, not
the one_time *service* checkout this investigation is about, but worth flagging): the marketplace's
frontend display calculation, `client/components/marketplace/CheckoutReview.tsx:74`, uses
`Math.max(0, totalCents - appliedPromo.discount_cents)` — a **$0 floor**, not $0.50 — while its backend
(`marketplaceStripe.ts:300`) enforces the $0.50 floor. This means a 100%-off marketplace purchase would
display "$0.00" on screen but still attempt to charge $0.50 server-side. This is a real, separate frontend/
backend mismatch, but it is in a different code path than the one described in this investigation's
specific test (a "one-time **service**" checkout, which is `ScheduleFlow.tsx`, not the marketplace cart).
See `FRONTEND_BACKEND_AMOUNT_MISMATCH_REPORT.md` for the full comparison.

### Is Stripe minimum charge logic involved?

**Yes.** $0.50 USD is Stripe's actual platform-enforced minimum amount for a chargeable PaymentIntent — if
this application tried to create a PaymentIntent for $0.00 (or any amount below Stripe's minimum), Stripe's
API would reject the request outright. The `Math.max(50, ...)` floor exists specifically to avoid ever
sending Stripe an invalid sub-minimum amount.

### Does the system support true $0 checkout?

**No.** There is no code path anywhere in `billingStripe.ts` or `marketplaceStripe.ts` that skips
PaymentIntent creation when the discounted amount would be zero. Every one_time/annual/marketplace purchase
unconditionally creates a real PaymentIntent for at least 50 cents, regardless of discount size — including
a 100%-off code.

### Does the system fall back to a paid PaymentIntent for 100% discount?

**Yes — this is exactly what happens, by design, today.** A 100%-off promo code does not produce a $0
checkout; it produces the **minimum possible paid PaymentIntent (50 cents)**, because
`applyPromoDiscount(cents)` computes `Math.max(50, cents - cents)` = `Math.max(50, 0)` = `50`. The
combination of "100% off" + "floor at 50 cents" is mathematically guaranteed to always land on exactly the
floor value, every time, for every 100%-off code, on every one_time/annual checkout. This is not a rare edge
case triggered by rounding — it is the deterministic, guaranteed outcome of this exact combination.

## Root cause of the "$1" display — found

No hardcoded `$1.00` / `100` cents constant exists anywhere — but a **display-formatting bug** produces the
literal string "$1" for any 50-cent amount. `ScheduleFlow.tsx:593-596`:

```ts
const fmtCents = (cents: number) =>
  cents >= 100000
    ? `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
    : `$${(cents / 100).toFixed(0)}`;
```

This formatter shows **zero decimal places** — it was written for whole-dollar service prices ($95, $175,
etc.), where cents are irrelevant clutter. For any amount under $1.50, it rounds to the nearest whole
dollar. Verified directly in Node: `(0.50).toFixed(0)` → `"1"`. So `fmtCents(50)` literally returns the
string **`"$1"`** — not an approximation or a different code path, the exact string the user reported
seeing. This is the **same `fmtCents` function** used for both the "Due Today" total and the payment
button's label ("Pay {amountLabel} — Confirm Service"), so the bug is visible in both places. See
`FRONTEND_BACKEND_AMOUNT_MISMATCH_REPORT.md` for the full before/after trace.

## Files inspected

`server/routes/billingStripe.ts` (in full), `server/routes/marketplaceStripe.ts` (relevant sections),
`server/routes/adminPromos.ts` (`/promos/validate` in full), `server/routes/webhooksStripe.ts` (searched,
no amount-calculation logic found there — it only reacts to already-decided Stripe events),
`client/components/schedule/ScheduleFlow.tsx` (in full for payment/promo sections),
`client/components/schedule/PaymentStep.tsx` (in full), `client/components/marketplace/CheckoutReview.tsx`
(promo/discount section), `client/lib/stripe.ts` (Stripe.js client init only, no amount logic).
Full git history of both `Math.max(50` sites checked via `git log --all -p -S`.
