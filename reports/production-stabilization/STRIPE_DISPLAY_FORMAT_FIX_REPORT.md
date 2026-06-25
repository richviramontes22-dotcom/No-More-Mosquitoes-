# Stripe Display Format Fix Report

## Root cause (from the prior investigation, `reports/stripe-promo-investigation/`)

`fmtCents()` formatted every amount with `.toFixed(0)` — zero decimal places, designed for whole-dollar
service prices. `(0.50).toFixed(0)` evaluates to `"1"`, so any 50-cent amount (Stripe's own minimum charge,
which this app's promo-discount floor lands on exactly for 100%-off codes) displayed as the literal string
`"$1"`.

## Fix

Three duplicate copies of the same `fmtCents` pattern existed; all three fixed identically:

| File | Context |
|---|---|
| `client/components/schedule/ScheduleFlow.tsx:593-600` | One-time/annual checkout's "Due Today" total + payment button label — **the exact bug reported** |
| `client/components/sections/QuoteWidgetSection.tsx:19-26` | Public homepage instant-quote widget — same latent bug pattern, not currently triggered (no promo/discount logic in this widget today), fixed for consistency and to remove the landmine |
| `client/components/marketplace/CheckoutReview.tsx:73-78` | **Different bug, same root symptom** — see below |

New logic: amounts that land on a whole dollar show no decimals (`$175`, `$95`, `$1`); any non-whole amount
shows two decimals (`$0.50`, `$0.99`, `$125.50`) instead of being silently rounded away. Verified directly:

```
50 cents    -> $0.50   (was $1)
100 cents   -> $1
9500 cents  -> $95
17500 cents -> $175
12550 cents -> $125.50 (was $126 — previously hid the 50 cents on *any* non-round amount, not just sub-dollar ones)
150000 cents -> $1,500 (unchanged — large amounts still use locale grouping, no decimals)
99 cents    -> $0.99
```

## Marketplace checkout — audited, found a related but distinct bug, fixed

The marketplace cart's own display formatter (`formatPrice` in `useCatalogItems.ts`) already used
`.toFixed(2)` — it never had the rounding bug. But `CheckoutReview.tsx`'s discount-floor calculation used
`Math.max(0, totalCents - discount_cents)`, while the backend (`server/routes/marketplaceStripe.ts`) floors
at `Math.max(50, ...)` — Stripe's real minimum. A 100%-off marketplace promo would have displayed "$0.00 due"
while Stripe still charged $0.50 at payment time: a genuine display/charge **mismatch**, distinct from the
ScheduleFlow rounding bug but with the same customer-facing symptom (displayed amount doesn't match what's
actually charged). Fixed by changing the frontend floor to match the backend's `Math.max(50, ...)` exactly.

## Verified

- One-time flow: ✅ fixed (the reported bug).
- Annual flow: ✅ fixed — identical code path as one-time in `ScheduleFlow.tsx`.
- Subscription flow: not affected by this bug — subscriptions use Stripe-native promotion codes calculated
  by Stripe itself, not this app's cents-math floor (confirmed in the prior investigation).
- Marketplace: ✅ floor mismatch fixed; display formatting was already correct.
- Due Today total and payment button label: both read the same `amountLabel`/`fmtCents` output, so both
  are fixed together by the single function change.
- `pnpm typecheck`: clean.
