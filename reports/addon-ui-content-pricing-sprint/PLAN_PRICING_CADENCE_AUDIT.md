# One-Time & Annual Plan — Pricing/Cadence Audit

**Date:** 2026-06-13
**Type:** Read-only investigation (no pricing/business-rule changes made)
**Reported symptom:** "Selecting a one-time service shows incorrect pricing/cadence. Yearly may also be wrong."

---

## Executive Summary

The reported symptom is real, but it shows up in **two different places for two different reasons**:

1. **Pre-checkout (quote → onboarding banner):** Selecting "One-Time Treatment" on the
   pricing-page quote widget can carry over a stale `cadenceDays` value (default `21`)
   from the hidden subscription-cadence picker. This produces a self-contradictory
   label like *"Every 21 days · One-time visit"* on the Onboarding intro screen.
   **Low severity** — cosmetic, doesn't affect what's charged.

2. **Post-checkout (customer dashboard / Billing page):** This is the big one.
   - A **one-time** purchase never creates a row in the `subscriptions` table, so
     `useSubscriptions()` returns `[]` for that customer and the Billing page renders
     **"No active plan — Complete your service setup..."** even though the customer
     paid $175 and has a scheduled appointment.
   - An **annual** purchase *does* create a `subscriptions` row, but `useSubscriptions()`
     re-derives `program` from `status` only (never produces `"annual"`) and falls back
     to a **hardcoded, acreage-independent $125/visit, 30-day-cadence** price/label
     pulled from an entirely separate (and otherwise-dead) pricing engine
     (`client/lib/pricing.ts` + `client/data/site.ts`). The dashboard shows
     **"Active Subscription — 30-day recurring cadence • $125.00 / visit"** for a
     customer who actually paid a flat $999–$2,900 once for the year.
   **High severity** — actively misleading for paying customers, on the page they'd
   use to verify what they're being charged.

The **actual Stripe charge amounts are correct** for both one-time ($175 flat) and
annual (acreage-tiered $999–$2,900 flat, via `/api/billing/create-payment-intent`).
The bug is entirely in **what gets displayed after the fact** (plus one cosmetic
pre-checkout label issue). No pricing/business-rule fix is required to correct the
charge amounts — only the *display/derivation* layer.

A third, **currently-unreachable landmine** was also found: `/api/billing/create-checkout-session`
has no `program === "annual"` branch and would silently treat an annual request as a
30-day recurring Stripe Subscription if it were ever wired up. It is not called from
any client code today (the live checkout path is `/api/billing/create-payment-intent`),
so it is not causing the reported symptom, but it should be fixed or removed before
anyone reuses it.

---

## System Map (as-built)

```
Quote Widget (Pricing page)              ScheduleFlow (in-flow plan step, Path B)
  selectedProgram: subscription|one_time|annual
  selectedCadence (default 21)             planChoice -> selectedProgram
        |                                          |
        v                                          v
  savePendingOnboarding()                 handleNext(): if annual -> selectedCadenceDays = 30
        |                                          |
        v                                          v
  Onboarding.tsx (pendingCadenceLabel,    selectedProgram / selectedCadenceDays
   pendingProgramLabel banner)                     |
        |                                          v
        +---------------> ScheduleFlow ----> /api/billing/create-payment-intent
                                                     |
                       one_time -> flat $175 PaymentIntent (program=one_time)
                       annual   -> flat $999-$2900 PaymentIntent (program=annual, lookupAnnualCents)
                       subscription -> Stripe Subscription, default_incomplete
                                                     |
                                                     v
                                          /api/billing/confirm-booking
                       - subscription -> subscriptions upsert (program="subscription")
                       - annual       -> subscriptions upsert (program="annual", NO amount_cents)
                       - one_time     -> NO subscriptions row at all
                       - all programs -> properties.program / properties.cadence updated correctly
                                                     |
                                                     v
                              Customer Dashboard: useSubscriptions() reads `subscriptions` table only
                       - one_time:  0 rows  -> "No active plan"
                       - annual:    1 row, status="active" -> program forced to "subscription",
                                     cadence forced to 30, price falls back to client/lib/pricing.ts
                                     calculatePricing({acreage: 0.25 (hardcoded), program:"subscription",
                                     frequencyDays:30}).perVisit === 125 (flat, tier-independent of
                                     the customer's real acreage)
```

---

## Findings, by question

### Q1 — What does "one-time" mean?

A single, non-recurring treatment. Confirmed consistently across client and server:

- `client/lib/pricing.ts:76-85` (`program === "one_time"` → `visitsPerYear: 1`)
- `server/services/parcel/types.ts:84-103` — `programs.one_time: { cents: number }` (no cadence field)
- `server/services/appointments/generateRecurring.ts:88-92` explicitly skips one-time properties:
  ```ts
  if (program === "one_time") { result.skipped++; continue; }
  ```

**Conclusion:** the *concept* of "one-time = single visit, no recurrence" is correctly
modeled everywhere it matters for scheduling/billing logic.

### Q2 — Does "one-time" carry a cadence value anywhere it shouldn't?

**Yes — confirmed bug (low severity, cosmetic).**

`client/components/sections/QuoteWidgetSection.tsx:218-230`:
```ts
const handleSchedule = () => {
  const cadenceDays = selectedProgram === "annual" ? 30 : selectedCadence;
  savePendingOnboarding({
    ...
    program: selectedProgram,
    cadenceDays,
    estimatedPrice: subPriceCents != null ? subPriceCents / 100 : undefined,
    source: "pricing-page",
  });
```

`selectedCadence` defaults to `21` (`QuoteWidgetSection.tsx:132`) and is only changed by
clicking a frequency tile that is **only rendered when `selectedProgram === "subscription"`**
(`QuoteWidgetSection.tsx:519`). If a user picks "One-Time Treatment" without ever viewing
the (hidden) frequency picker, `cadenceDays: 21` is saved alongside `program: "one_time"`.

This value then surfaces on the Onboarding intro banner:

`client/pages/Onboarding.tsx:67-74`:
```ts
const pendingCadenceLabel = pending?.cadenceDays
  ? `Every ${pending.cadenceDays} days`
  : null;
const pendingProgramLabel =
  pending?.program === "subscription" ? "Subscription"
  : pending?.program === "one_time"   ? "One-time visit"
  : pending?.program === "annual"     ? "Annual plan"
  : null;
```

Result: a banner reading **"Every 21 days · One-time visit"** — self-contradictory.

The same stale `cadenceDays` is then passed through as `ScheduleFlow`'s
`initialCadenceDays` → `selectedCadenceDays` → sent to `/api/billing/create-payment-intent`
and `/api/billing/confirm-booking` as `cadenceDays: 21`, and ultimately written to
`properties.cadence = 21` for a one-time property (`billingStripe.ts:747-761`). This
doesn't affect the *charge* (one-time price is flat, looked up independently of
cadence — see Q3), but it leaves a meaningless `cadence` value on the property row.

### Q3 — Is "one-time" pricing flat or acreage-based?

**Flat.** Confirmed in both the UI and the live checkout path:

- UI: `client/components/sections/QuoteWidgetSection.tsx:92` and
  `client/components/schedule/ScheduleFlow.tsx:584`: `const ONE_TIME_CENTS = 17500;` ($175),
  used regardless of `acreage`.
- Server (live path, `/api/billing/create-payment-intent`,
  `server/routes/billingStripe.ts:419-441`): resolves `plan = findStripePriceAsync(acreage, cadenceDays, true, supabase)`.
  In `server/lib/stripe-prices.ts:111-115` and `:150-151`, `isOneTime=true` short-circuits
  to the single `program='one_time'` row — `acreage`/`cadenceDays` are **ignored** for
  one-time:
  ```ts
  if (isOneTime) {
    const plan = STRIPE_PLANS.find(p => p.id === 'one_time');
    ...
  }
  ```
  Static fallback: `stripe-prices.ts:88` — `{ id: "one_time", ..., priceCents: 17500 }`.

**UI and server agree: $175 flat, independent of acreage.** ✅ No bug here.

> Note: a *second*, unused pricing engine (`client/lib/pricing.ts:21` +
> `client/data/site.ts:9-23`) defines `ONE_TIME_APPLICATION_PRICE = 270` — a different
> number. This engine is not called by the quote widget, schedule flow, or checkout
> (confirmed via grep — no imports of `calculatePricing` from those files). It **is**,
> however, the source of the Billing-dashboard price bug in Q14. See "Duplicated pricing
> tables" below.

### Q4 — Is "one-time" a subscription or a single payment?

**Single payment — confirmed correct.**

`server/routes/billingStripe.ts:419-441` (`/create-payment-intent`, `program === "one_time"`):
creates a `PaymentIntent` directly (`POST /payment_intents`), returns `{ clientSecret, intentId, type: "payment_intent" }`. No Stripe Subscription object is created. ✅

### Q5 — Does "one-time" create exactly one appointment with no recurrence?

**Yes — confirmed correct,** via `/api/billing/confirm-booking`
(`server/routes/billingStripe.ts:699-745`): inserts one row into `appointments` for
`scheduledDate`/`windowId` (idempotent — skips if one already exists for that date).
No `subscriptions` row, no recurring schedule. `generateRecurring.ts:88-92` explicitly
skips `program === "one_time"` properties going forward. ✅

### Q6 — Is "annual" a subscription, a prepaid plan, or something custom?

**Prepaid, flat, one-time PaymentIntent — NOT a Stripe Subscription object.**
Confirmed by an explicit design comment, `server/routes/billingStripe.ts:678-681`:

```ts
// For annual plans: record a subscription row using the PaymentIntent ID as key.
// There is no Stripe Subscription object for annual plans — they are one-time
// PaymentIntents. We use current_period_end = now + 365 days so ops know when
// to reach out for renewal. Renewal is manual (customer re-purchases).
```

This is consistent — `/api/billing/create-payment-intent`'s `program === "annual"`
branch (`billingStripe.ts:395-417`) creates a flat `PaymentIntent` with
`metadata[program]=annual`, `description: "Annual Mosquito Service Plan"`. The internal
`subscriptions` table row is a **bookkeeping construct** (to track `current_period_end`
for renewal reminders and to let `generateRecurring.ts` keep generating visits), not a
real Stripe billing subscription. This design is intentional and internally consistent. ✅

### Q7 — What cadence does "annual" select or imply?

**Forced to 30 days ("monthly visits for 12 months"), in both selection paths:**

- Path A (Quote Widget): `QuoteWidgetSection.tsx:219`:
  ```ts
  const cadenceDays = selectedProgram === "annual" ? 30 : selectedCadence;
  ```
- Path B (in-flow plan step): `ScheduleFlow.tsx:368`:
  ```ts
  if (planChoice === "annual") setSelectedCadenceDays(30); // annual is monthly cadence
  ```

User-facing copy confirms the intent — `QuoteWidgetSection.tsx:509-516` /
`ScheduleFlow.tsx:881-888`:
> "Your annual plan covers all monthly (30-day) treatments for 12 months at {price} +
> tax — billed once upfront."

This `cadenceDays=30` is what `generateRecurring.ts` later uses to space out the
recurring visits for an annual customer (Q12). ✅ Internally consistent.

### Q8 — Is "annual" pricing acreage-based?

**Yes — flat-per-acreage-tier (not derived from the 14/21/30/42-day per-visit prices).**

`ANNUAL_TIERS` is duplicated **three times** with identical values:
- `client/components/sections/QuoteWidgetSection.tsx:77-90`
- `client/components/schedule/ScheduleFlow.tsx` (`ANNUAL_TIERS`, ~line 570-583)
- `server/routes/billingStripe.ts:15-28` (`ANNUAL_TIERS_SERVER`, explicit comment:
  *"mirrors client ANNUAL_TIERS in ScheduleFlow.tsx"*)
- A **fourth** copy exists in `server/services/parcel/pricingQuote.ts:65-78` (`ANNUAL_TIERS`)

All four currently contain the same values ($999 for 0.01–0.13 ac up to $2,900 for
1.51–2.00 ac), but they are independently maintained literals with no shared import —
a future edit to one and not the others would silently desync UI quote vs. actual
charge. This is a **maintainability risk**, not a currently-active bug (see "Duplicated
pricing tables" below for the fix recommendation). ✅ Currently correct/consistent, ⚠️ fragile.

### Q9 — Does "annual" route to the correct Stripe mode/endpoint?

**Yes, via the live path (`/create-payment-intent`).** **No** (landmine), via the unused
`/create-checkout-session` path.

- `/api/billing/create-payment-intent` (`billingStripe.ts:395-417`) — explicitly
  special-cases `program === "annual"` **before** the one_time/subscription branches,
  creates a flat `PaymentIntent` via `lookupAnnualCents(acreageNum)`. ✅
- `/api/billing/create-checkout-session` (`billingStripe.ts:240-336`) — **has no
  `program === "annual"` branch at all.** Mode is computed as:
  ```ts
  mode: program === "one_time" ? 'payment' : 'subscription',  // billingStripe.ts:263
  ```
  and price is resolved via:
  ```ts
  const plan = await findStripePriceAsync(acreage, cadenceDays, program === "one_time", supabase); // :252
  ```
  If `program === "annual"` were sent here with `cadenceDays = 30` (the value the client
  always uses for annual, per Q7), `findStripePriceAsync` would happily **match the
  legitimate 30-day subscription tier** (`isOneTime=false`, `cadence_days=30` is a valid
  row) and create a **real, recurring monthly Stripe Subscription** at the 30-day
  per-visit price (e.g. $125/month) — completely different from the intended flat
  $999–$2,900/year. No `metadata[program]` is even written by this endpoint (only
  `tier_key`/`cadence_days`), so a webhook consumer couldn't tell "annual" was ever
  requested.

  **Reachability:** grep of `client/` shows **no caller of `/api/billing/create-checkout-session`**
  — `ScheduleFlow.tsx:424` calls `/api/billing/create-payment-intent` exclusively. This
  route appears to be **legacy/dead** for the property-subscription flow. ⚠️ Flagged as
  a landmine, not an active bug.

### Q10 — Do the UI and backend agree on what "one-time" and "annual" mean?

**Yes, for pricing/checkout.** **No, for post-purchase display** (see Q13/Q14) — the
backend correctly persists `properties.program` ∈ `{one_time, subscription, annual}`
(`billingStripe.ts:747-761`), but the customer-facing dashboard never reads that field;
it re-derives a *different* (and wrong) `program`/`cadence`/`price` from the
`subscriptions` table via `useSubscriptions.ts`.

### Q11 — Is the Stripe checkout `mode` (subscription / payment / setup) correct for each program?

| Program | Live endpoint | Stripe mode/object | Correct? |
|---|---|---|---|
| `one_time` | `/create-payment-intent` | `PaymentIntent` (single charge) | ✅ |
| `subscription` | `/create-payment-intent` | `Subscription` (`payment_behavior: default_incomplete`) | ✅ |
| `annual` | `/create-payment-intent` | `PaymentIntent` (single charge, `metadata.program=annual`) | ✅ |
| `one_time` | `/create-checkout-session` (unused) | `mode: 'payment'` | ✅ (but route unused) |
| `annual` | `/create-checkout-session` (unused) | `mode: 'subscription'` (no annual branch — falls through) | ❌ (but route unused) |
| `subscription` | `/create-checkout-session` (unused) | `mode: 'subscription'` | ✅ (but route unused) |

`setup` mode is not used anywhere in this flow (not applicable).

### Q12 — Does appointment scheduling differ correctly by plan type?

**Yes, for first-appointment creation.** **Partially, for ongoing recurrence.**

- **First appointment** (`/api/billing/confirm-booking`, `billingStripe.ts:699-745`):
  identical logic for all three programs — one `appointments` row inserted from
  `scheduledDate`/`windowId`, idempotent.
- **Ongoing recurrence** (`server/services/appointments/generateRecurring.ts`):
  - `one_time` → skipped entirely (`:88-92`). ✅
  - `subscription` → generated on `cadence_days` interval while `status === "active"`. ✅
  - `annual` → generated on `cadence_days` interval (same mechanism as subscription —
    `:103` reads `cadenceDays` generically with no annual-specific branch), gated by
    `current_period_end` instead of subscription status (`:93-101`):
    ```ts
    if (program === "annual") {
      const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
      if (!periodEnd || periodEnd <= new Date()) { result.skipped++; continue; }
    }
    ```
    Since `cadence_days` is always `30` for annual (Q7), this correctly produces ~12
    visits/year until the 365-day `current_period_end` passes. ✅ This part is correct.

  No issues found in the recurrence-generation logic itself.

### Q13 — How does the customer dashboard display a "one-time" plan?

**Incorrectly — shows "No active plan" for a paying customer. Confirmed root cause.**

`client/hooks/dashboard/useSubscriptions.ts:43-68` queries **only** the `subscriptions`
table:
```ts
.from("subscriptions")
.select(`id, property_id, status, cadence_days, amount_cents, current_period_end, cancel_at_period_end, created_at`)
.eq("user_id", userId)
.not("status", "in", '("incomplete","incomplete_expired")')
```

`/api/billing/confirm-booking` only writes to `subscriptions` for `program ===
"subscription"` (`billingStripe.ts:666-676`) or `program === "annual"`
(`billingStripe.ts:682-697`). For `program === "one_time"`, **no `subscriptions` row is
ever created** — anywhere (checked `confirm-booking` and the `payment_intent.succeeded`
webhook, `webhooksStripe.ts:996-1019`, which also only special-cases `annual`).

Result: a customer whose only purchase is a one-time treatment has **zero rows** in
`subscriptions`. `useSubscriptions()` returns `[]`.

- `client/pages/dashboard/Billing.tsx:127-129`:
  ```ts
  // Only show properties with actual paid subscription records — never fall back to
  // the properties table, which would show unpaid properties as "Active Subscription"
  const nextProperties = subscriptionProperties as Property[];
  ```
  → `properties.length === 0` → renders the empty state (`Billing.tsx:490-499`):
  **"No active plan — Complete your service setup to activate mosquito protection..."**
  with a "Complete Setup" button linking to `/onboarding`.

- `client/pages/Dashboard.tsx:272-286` ("Active Plan" widget): `activeSubscription` is
  `undefined` → renders **"No active plan / Set up service →"**.

Meanwhile, `properties.program = "one_time"` and an `appointments` row **do** exist
correctly (written by `confirm-booking`) — the data needed to show "Single Treatment,
$175, visit scheduled for <date>" exists in the database, it's just never read by these
two screens.

### Q14 — How does the customer dashboard display an "annual" plan?

**Incorrectly — shows a generic, acreage-independent monthly-subscription price/cadence
instead of the actual annual amount. Confirmed root cause — this is the headline "yearly
plan pricing/cadence is wrong" bug.**

For annual, `confirm-booking` *does* upsert a `subscriptions` row
(`billingStripe.ts:685-695`):
```ts
await supabaseAdmin.from("subscriptions").upsert({
  stripe_subscription_id: paymentIntentId,
  user_id:              user.id,
  property_id:          propertyId,
  status:               "active",
  program:              "annual",
  cadence_days:         parseInt(String(cadenceDays ?? "21"), 10),  // = 30, per Q7
  current_period_end:   periodEnd.toISOString(),                     // now + 365 days
  last_payment_at:      new Date().toISOString(),
  updated_at:           new Date().toISOString(),
}, { onConflict: "stripe_subscription_id" });
```
**Note: `amount_cents` is never set** for annual — neither here nor in the
`payment_intent.succeeded` webhook fallback (`webhooksStripe.ts:1007-1017`, same fields,
also no `amount_cents`).

Now in `useSubscriptions.ts:70-95`:
```ts
const acreage = 0.25;  // Default, not enriched                       // :71 — HARDCODED
const cadence = subscription.cadence_days || 30;                      // :72 -> 30
const pricing = calculatePricing({
  acreage,                          // 0.25, not the customer's real acreage
  program: "subscription",          // NOT "annual"
  frequencyDays: cadence as any,    // 30
});

const priceFromSubscription = subscription.amount_cents != null ? subscription.amount_cents / 100 : null; // null (never set)

return {
  ...
  plan: pricing.tierLabel || "Standard",                               // ".21 - .30 acres" (hardcoded tier)
  program: (subscription.status === "active" ? "subscription" : "one_time") as ProgramType, // "subscription" — "annual" UNREACHABLE
  cadence,                                                              // 30
  price: priceFromSubscription ?? pricing.perVisit ?? 0,                // pricing.perVisit
  ...
};
```

`calculatePricing({ acreage: 0.25, program: "subscription", frequencyDays: 30 })` in
`client/lib/pricing.ts:88-101` looks up `pricingTiers` (`client/data/site.ts:9-23`) for
the `0.21–0.30` tier (since 0.25 falls in that range) and returns `perVisit: 125`
(`pricingTiers[2].subscription = 125`). **This is a fixed $125 for every annual
customer, regardless of their actual property size or the $999–$2,900 they paid.**

Rendered in `client/pages/dashboard/Billing.tsx:506-525`:
```tsx
<Badge ...>{property.program === "one_time" ? "Single Treatment" : "Active Subscription"}</Badge>
...
{property.program === "one_time"
  ? "One-time intensive service"
  : `${property.cadence ?? "?"}-day recurring cadence`}
{" • "}
{property.price != null && property.price > 0 ? `$${property.price.toFixed(2)}` : "Custom pricing"}
{" "}
{property.program === "annual" ? "/ year" : "/ visit"}
```

Since `property.program` is always `"subscription"` for an active annual row, and
`property.cadence` is always `30`, and `property.price` is always `125`, **every annual
customer's Billing card reads:**

> **Active Subscription**
> 30-day recurring cadence • $125.00 / visit

— regardless of whether they paid $999 (smallest tier) or $2,900 (largest tier) for a
once-a-year prepayment. The `property.program === "annual" ? "/ year" : "/ visit"`
branch is dead code (never reached). The "Service Frequency" and "Cancel" buttons
(`Billing.tsx:550-575`, gated on `program !== "one_time"`) are also shown for annual
customers, implying they're on a cancelable recurring subscription they can change the
cadence of — neither of which is true for a prepaid annual plan.

`Dashboard.tsx:272-280` ("Active Plan" widget) shows the same derived values:
**"Standard" / "30-day cadence"** (using `plan`/`cadence` from the same hook).

### Q15 — How does the admin dashboard display one-time/annual plans?

**No per-customer "annual" identifier exists anywhere in the admin UI; one-time is
partially distinguished.**

- `client/pages/admin/Pricing.tsx` manages **service plan templates**
  (`service_plans` table via `/api/admin/plans`) — columns include `program` (badge,
  line ~132) and `cadence_days` (line ~131), and the "New Plan" cadence dropdown
  (`admin/Pricing.tsx:222-234`) includes `365` labeled "annual". This is **template-level
  configuration**, not a view of any individual customer's purchased plan.
- `client/pages/admin/Billing.tsx` shows a payment timeline/table (status, amount,
  source) — no plan-type/cadence column for individual customers.
- `client/pages/admin/Appointments.tsx:403`:
  ```ts
  type: app.service_type === "one_time" ? "one_time" : "subscription",
  ```
  Binary classification — annual-plan appointments (whose `service_type` is not
  literally `"one_time"`) are bucketed as `"subscription"`. The "All Plans" filter
  dropdown (`:585-589`) likewise only offers `subscription` / `one_time` — there is no
  way for admin staff to filter or identify annual-plan customers/appointments
  specifically.

**Net effect:** admin staff have no UI-level way to see "this customer is on an annual
prepaid plan, expires on <date>" — that information exists only in the `subscriptions`
table (`program="annual"`, `current_period_end`), with no dashboard surface.

---

## Root Cause Summary

| # | Symptom | Root cause | File:line | Severity |
|---|---|---|---|---|
| A | "Every 21 days · One-time visit" shown pre-checkout | `cadenceDays` defaults to 21 and isn't cleared when `program="one_time"` | `QuoteWidgetSection.tsx:219`, `Onboarding.tsx:67-74` | Low (cosmetic) |
| B | One-time customers see "No active plan" on Billing/Dashboard | `confirm-booking` never writes a `subscriptions` row for `program="one_time"`; `useSubscriptions()`/Billing only reads `subscriptions` | `billingStripe.ts:666-697`, `useSubscriptions.ts:43-68`, `Billing.tsx:127-129` | **High** |
| C | Annual customers see "Active Subscription — 30-day recurring cadence • $125.00 / visit" | `useSubscriptions()` derives `program` from `status` only (never "annual"), `cadence` defaults to 30, and `price` falls back to a hardcoded `calculatePricing({acreage:0.25, program:"subscription", frequencyDays:30})` from an unrelated/dead pricing engine | `useSubscriptions.ts:71-90`, `client/lib/pricing.ts:88-101`, `client/data/site.ts:9-23`, `Billing.tsx:507-525` | **High** |
| D | `/create-checkout-session` would mis-price "annual" as a 30-day Stripe Subscription if ever called | No `program==="annual"` branch; `cadenceDays=30` (used for annual) matches a real 30-day subscription tier | `billingStripe.ts:240-336` | Low (dead code today) — fix before reuse |
| E | Four independent copies of `ANNUAL_TIERS` / two of `ONE_TIME_*` price constants | No shared module for cadence/annual/one-time pricing tables | `QuoteWidgetSection.tsx`, `ScheduleFlow.tsx`, `billingStripe.ts`, `pricingQuote.ts`, `client/lib/pricing.ts` + `data/site.ts` | Maintainability risk |
| F | Admin has no per-customer "annual" view | `admin/Appointments.tsx:403` binary `one_time`/`subscription` classification; `admin/Pricing.tsx` is template-only | `admin/Appointments.tsx:403,585-589` | Low/Medium |

---

## Risk Assessment

- **Stripe charge correctness:** ✅ Not affected. One-time ($175 flat) and annual
  (acreage-tiered $999–$2,900 flat) amounts charged via `/create-payment-intent` are
  correct today. **No evidence customers are being over/under-charged.**
- **Customer-facing display correctness:** ❌ Significantly affected for one-time (B)
  and annual (C) customers on `/dashboard` and `/dashboard/billing` — the two screens
  most likely to be checked by a customer wanting to confirm what they're paying.
- **Data integrity:** `properties.program`/`properties.cadence` are written correctly
  for all three programs (`billingStripe.ts:747-761`) — the *source data* for a correct
  display already exists; the dashboard hooks simply don't use it (one-time) or use the
  wrong fallback (annual).
- **Blast radius of a fix:** Root causes B and C are isolated to
  `client/hooks/dashboard/useSubscriptions.ts` (and its consumers' rendering logic in
  `Billing.tsx`/`Dashboard.tsx`/`PlanChangeDialog.tsx`) — they do **not** touch
  `billingStripe.ts`, Stripe checkout, webhook handlers, or any pricing constant used at
  checkout time. A fix here cannot change what a customer is charged.

---

## Immediate vs. Separate-Sprint Recommendation

- **Root causes B and C (dashboard display)** are display/derivation-layer bugs with a
  small, well-isolated blast radius (one hook + a few render branches) and **no
  Stripe/pricing-rule changes required**. These are good candidates for a focused
  follow-up fix once reviewed — see `PLAN_PRICING_CADENCE_FIX_PROPOSAL.md`.
- **Root cause A (stale pre-checkout cadence label)** is a 1-2 line fix
  (clear/ignore `cadenceDays` when `program==="one_time"`), low risk.
- **Root cause D (`/create-checkout-session` annual gap)** — recommend either deleting
  the unused route or adding the same `program==="annual"` guard `/create-payment-intent`
  already has, as a defensive fix. Confirm with the team whether this route is truly
  dead before removing it (grep found no client callers, but it may be used by an
  external integration, admin tool, or test).
- **Root cause E (duplicated pricing tables)** — larger consolidation effort
  (4 copies of `ANNUAL_TIERS`, 2 of one-time price, plus the wholesale-unused
  `client/lib/pricing.ts`/`pricingTiers` engine). Recommend a **separate sprint** —
  touches many files and risks exactly the kind of "do not change pricing rules"
  concern this sprint was scoped to avoid.
- **Root cause F (admin annual visibility)** — minor, recommend a **separate sprint**
  (admin UX addition, not a correctness bug for customers).

**No pricing/business-rule changes are proposed or required** to fix B, C, or A — see
the fix proposal for the specific, display-only changes recommended.
