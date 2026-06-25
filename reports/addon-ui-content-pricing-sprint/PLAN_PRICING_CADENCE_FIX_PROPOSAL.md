# One-Time & Annual Plan — Fix Proposal

**Date:** 2026-06-13
**Status:** PROPOSAL ONLY — **NOT IMPLEMENTED**. No code has been changed as part of
this document. This is the "clean plan" requested before any pricing/display fixes are
made, per the sprint instruction: *"investigate and document findings first before
implementing any pricing changes"* and *"do not claim pricing/cadence is fixed unless
you actually implement and test a fix."*

This proposal addresses **Bugs A, B, and C** from `PLAN_PRICING_CADENCE_AUDIT.md`. Bugs
D, E, and F are explicitly deferred (see "Out of Scope" below).

---

## Guiding Principles

- **No changes to Stripe checkout, pricing tables, or charge amounts.** Every fix below
  is in the *display/derivation* layer (dashboard hooks + rendering) or writes
  *additional* bookkeeping data (`amount_cents`, `program`) to rows that are already
  created. Nothing here changes what a customer is charged.
- **No new database migration required.** The `subscriptions` table already has
  `program` and `amount_cents` columns, added by
  `db/migrations/2026-05-28_annual_plan_tracking.sql`, which is confirmed applied to
  production (per memory: all migrations through `2026-06-01` are applied). That
  migration's own comments explicitly document `program` as
  `'subscription' | 'annual' | 'one_time'` and `amount_cents` as "most recent charge
  amount in cents" — i.e., **this fix completes a design that was already
  schema-provisioned but never finished in code.**
- **Minimize blast radius.** Fixes are additive (new column writes, new `if` branches)
  rather than restructuring existing subscription/cancel/portal logic.

---

## Fix 1 — Bug C: Annual plans mis-displayed as "Active Subscription — 30-day recurring cadence • $125.00 / visit"

### 1a. Read `subscriptions.program` directly instead of re-deriving it from `status`

**File:** `client/hooks/dashboard/useSubscriptions.ts`

- Add `program` to the `.select(...)` column list (currently `id, property_id, status,
  cadence_days, amount_cents, current_period_end, cancel_at_period_end, created_at` —
  the column already exists and is already written by `confirm-booking` for
  `subscription` and `annual` rows).
- Replace:
  ```ts
  program: (subscription.status === "active" ? "subscription" : "one_time") as ProgramType,
  ```
  with:
  ```ts
  program: (subscription.program as ProgramType) || "subscription",
  ```
- **Effect:** `"annual"` becomes reachable for the first time. `program: "subscription"`
  is kept as a fallback only for any pre-migration rows where `program` is `NULL` (the
  migration backfilled `program='subscription'` for rows with a `sub_*` ID, but a
  defensive fallback costs nothing).

### 1b. Persist `amount_cents` for annual purchases

**Files:**
- `server/routes/billingStripe.ts`, `/confirm-booking`, annual branch (~line 685)
- `server/routes/webhooksStripe.ts`, `payment_intent.succeeded` annual branch (~line 1007)

In `confirm-booking`, the PaymentIntent object (`pi`) is already fetched at line 654
(`const pi = await stripeFetch(...)`) to verify `pi.status === "succeeded"`. Add one
field to the existing annual upsert payload:
```ts
await supabaseAdmin.from("subscriptions").upsert({
  stripe_subscription_id: paymentIntentId,
  user_id:              user.id,
  property_id:          propertyId,
  status:               "active",
  program:              "annual",
  cadence_days:         parseInt(String(cadenceDays ?? "21"), 10),
  current_period_end:   periodEnd.toISOString(),
  last_payment_at:      new Date().toISOString(),
  amount_cents:         (pi as any).amount,        // <-- NEW
  updated_at:           new Date().toISOString(),
}, { onConflict: "stripe_subscription_id" });
```
Apply the equivalent one-field addition to the webhook's annual upsert
(`webhooksStripe.ts:1007-1017`), using the webhook's PaymentIntent object's `.amount`.

**Effect:** `useSubscriptions.ts:79` (`priceFromSubscription = subscription.amount_cents
!= null ? subscription.amount_cents / 100 : null`) becomes non-null for annual rows,
so `price: priceFromSubscription ?? pricing.perVisit ?? 0` returns the real
$999–$2,900 figure instead of falling through to the hardcoded-acreage `$125`
fallback.

> **Related, out-of-scope finding:** the `subscription`-program upsert
> (`billingStripe.ts:667-675`) also never sets `amount_cents`, so subscription
> customers hit the same `pricing.perVisit` (hardcoded `acreage=0.25`) fallback for
> their displayed price. This is the **same mechanism** as Bug C but affects
> `subscription` plans, which are outside Task 7's "one-time and annual" scope. Flagging
> for the same future pass that addresses Bug E (pricing-table consolidation) — adding
> `amount_cents` there too would be a natural, low-risk extension of 1b once reviewed.

### 1c. Fix the "plan" label and cadence framing for annual

**Files:** `client/hooks/dashboard/useSubscriptions.ts`, `client/pages/dashboard/Billing.tsx`, `client/pages/Dashboard.tsx`

- In `useSubscriptions.ts`, when `subscription.program === "annual"`, return
  `plan: "Annual Plan"` instead of `pricing.tierLabel` (which is derived from the
  hardcoded `acreage = 0.25` and produces the misleading ".21 - .30 acres" label
  regardless of the customer's actual property size).
- In `Billing.tsx` (~lines 511-525), the existing branch
  `{property.program === "annual" ? "/ year" : "/ visit"}` becomes reachable for the
  first time once 1a lands. Replace the cadence-framing line
  (`` `${property.cadence ?? "?"}-day recurring cadence` ``) for annual with copy that
  doesn't imply a recurring bill, e.g.:
  ```tsx
  {property.program === "one_time"
    ? "One-time intensive service"
    : property.program === "annual"
      ? "Prepaid annual plan"
      : `${property.cadence ?? "?"}-day recurring cadence`}
  ```
- In `Dashboard.tsx` (~lines 272-288), the "Active Plan" widget reads `plan`/`cadence`
  from the same hook — once 1a-1c land it will show "Annual Plan" instead of "Standard
  · 30-day cadence". Spot-check whether the `${activeSubscription.cadence || 30}-day
  cadence` line (Dashboard.tsx ~line 286) needs the same annual-specific copy swap as
  Billing.tsx (recommended: yes, for consistency).

### 1d. "Service Frequency" / "Cancel" buttons for annual — needs a decision

`Billing.tsx` (~lines 550-575) currently gates these buttons on
`property.program !== "one_time"`. Once 1a lands, `program === "annual"` will also
satisfy this condition, surfacing a "Cancel Subscription" button for a prepaid annual
plan that has **no real Stripe Subscription object to cancel**
(`billingStripe.ts:678-681` explicitly documents "Renewal is manual — customer
re-purchases").

**Open question (see "Open Questions" below):** should these buttons be hidden for
`program === "annual"` (i.e., gate on `program === "subscription"` specifically), or
replaced with different copy/CTA (e.g., "Contact us about renewal")?

---

## Fix 2 — Bug B: One-time purchases show "No active plan"

### Context

`db/migrations/2026-05-28_annual_plan_tracking.sql` documents `subscriptions.program`
as `'subscription' | 'annual' | 'one_time'` — a `one_time` value was clearly
anticipated at the schema level, but `/confirm-booking` never writes such a row. This
proposal completes that originally-intended design rather than introducing a new one.

### 2a. Write a `subscriptions` row for one-time purchases at confirm-booking

**File:** `server/routes/billingStripe.ts`, `/confirm-booking` (new branch alongside
the existing `subscription`/`annual` branches at ~line 666):

```ts
if (program === "one_time" && paymentIntentId) {
  await supabaseAdmin.from("subscriptions").upsert({
    stripe_subscription_id: paymentIntentId,
    user_id:      user.id,
    property_id:  propertyId,
    status:       "completed",
    program:      "one_time",
    cadence_days: null,
    amount_cents: (pi as any).amount,
    last_payment_at: new Date().toISOString(),
    updated_at:   new Date().toISOString(),
  }, { onConflict: "stripe_subscription_id" });
}
```

**Why `status: "completed"` and not `"active"`:** several other endpoints treat
`subscriptions.status === "active"` (or `"active"`/`"past_due"`) as "this row represents
a live, cancelable, Stripe-managed billing relationship":

- `create-portal-session` (`billingStripe.ts:793+`) lets `active`/`past_due` rows
  through to the Stripe Billing Portal. A one-time row has no real Stripe Subscription
  behind its `stripe_subscription_id` (it's a PaymentIntent ID, same pattern as annual)
  — `status: "active"` here could let a one-time customer reach a portal session that
  errors or behaves unexpectedly against a PaymentIntent ID.
- Any subscription-cancel logic keyed on `status === "active"` should not treat a
  one-time purchase as something to "cancel".

`"completed"` passes `useSubscriptions.ts`'s existing exclusion filter
(`.not("status", "in", '("incomplete","incomplete_expired")')`) — the row will be
returned — while remaining distinguishable from `"active"` for any status-gated logic
elsewhere.

### 2b. Display logic should key off `program`, not `status`

With 1a reading `program` directly, a `{ status: "completed", program: "one_time",
cadence_days: null, amount_cents: 17500 }` row maps to `{ program: "one_time", cadence:
null, price: 175 }` with no further hook changes. Recommend auditing `Billing.tsx` /
`Dashboard.tsx` for any remaining `status === "active"` checks used to decide "is this a
plan to display" — those should check `program` (presence of a row at all) instead,
so a `"completed"` one-time row is treated as "yes, show this plan" rather than
"inactive, hide it". (Covered by the implementation-order grep, step 1 below.)

### 2c. Billing.tsx rendering for one-time — no new rendering code needed

Existing logic already does the right thing once `program === "one_time"` and real data
flow through:
- `Badge`: `property.program === "one_time" ? "Single Treatment" : "Active Subscription"`
  (`Billing.tsx:507`) ✅
- Description: `"One-time intensive service"` + `$175.00` + `"/ visit"`
  (`Billing.tsx:511-524`) ✅
- "Service Frequency"/"Cancel" buttons already gated `property.program !== "one_time"`
  (`Billing.tsx:550+`) — correctly **hidden** for one-time. ✅

### 2d. Backfill for existing one-time customers — needs a decision

Customers who purchased a one-time treatment **before** this fix ships have no
`subscriptions` row and will continue to show "No active plan" until/unless a backfill
runs. Two options (see "Open Questions"):
1. **One-time backfill script**: for every `properties` row with `program = 'one_time'`
   and no matching `subscriptions.property_id`, insert a `subscriptions` row with
   `status: "completed"`, `program: "one_time"`, `cadence_days: null`,
   `amount_cents: 17500` (current flat price) — run once via Supabase SQL Editor.
2. **Dashboard fallback**: `Billing.tsx`/`Dashboard.tsx` fall back to `useProperties()`
   for `program === "one_time"` properties with no `subscriptions` match (re-introduces
   a `useProperties` dependency that `Billing.tsx:127-129` currently deliberately
   avoids — would need care to avoid showing *unpaid* properties as completed plans).

Option 1 is recommended as lower-risk (one-time data fix, doesn't touch the
intentionally-narrow `Billing.tsx` data source).

---

## Fix 3 — Bug A: Stale "Every 21 days · One-time visit" label (cosmetic)

### 3a. Don't pass a misleading cadence for one-time at quote time

**File:** `client/components/sections/QuoteWidgetSection.tsx` (~line 219)

```ts
const cadenceDays =
  selectedProgram === "annual"   ? 30 :
  selectedProgram === "one_time" ? undefined :
  selectedCadence;
```

(Confirm `savePendingOnboarding`'s `cadenceDays` param is already optional —
`PendingOnboarding` type should allow `undefined`/omitted.)

### 3b. Don't render the cadence label for one-time on the Onboarding intro

**File:** `client/pages/Onboarding.tsx` (~lines 67-69)

```ts
const pendingCadenceLabel =
  pending?.cadenceDays != null && pending?.program !== "one_time"
    ? `Every ${pending.cadenceDays} days`
    : null;
```

### 3c. Don't persist a meaningless `cadence` value on the property for one-time

**File:** `server/routes/billingStripe.ts`, `/confirm-booking` (~line 751)

```ts
cadence: program === "one_time" ? null : parseInt(String(cadenceDays ?? "21"), 10),
```

`properties.cadence` is nullable; this is a one-line, additive correctness change. Not
read by `Billing.tsx` (which uses `subscriptions`-derived `cadence_days`, fixed to
`null` for one-time by 2a) — purely a data-quality cleanup for the `properties` table
(e.g., for any future admin view per Bug F).

---

## Out of Scope (deferred to separate sprints, per audit recommendation)

- **Bug D** — `/create-checkout-session` has no `program === "annual"` branch. Confirmed
  unused by any client code today. Recommend either deleting the route or adding the
  same annual guard `/create-payment-intent` has, after confirming with the team it's
  truly dead.
- **Bug E** — four independently-maintained copies of `ANNUAL_TIERS`, two of the
  one-time price constant, and the wholesale-unused `client/lib/pricing.ts` +
  `client/data/site.ts` `pricingTiers` engine (which, ironically, is the *live* source
  of Bug C's wrong `$125` fallback). Recommend a dedicated pricing-table-consolidation
  sprint — touches many files and is exactly the kind of change this sprint was scoped
  to avoid ("do not change pricing business rules without investigation").
- **Bug F** — admin (`admin/Appointments.tsx`, `admin/Pricing.tsx`) has no way to
  identify or filter a customer's plan as "annual" specifically (bucketed under
  "subscription"). Admin UX addition, separate sprint.
- **Subscription `amount_cents`/tierLabel fallback** (noted under Fix 1b) — same root
  mechanism as Bug C but affects `subscription`-program customers; outside Task 7's
  "one-time and annual" scope.

---

## Open Questions (for user review before implementation)

1. **Annual "Cancel"/"Service Frequency" buttons** (Fix 1d): hide entirely for
   `program === "annual"` (gate on `program === "subscription"`), or replace with a
   different CTA (e.g., "Contact us about renewal")?
2. **Backfill for existing one-time customers** (Fix 2d): run a one-time SQL backfill
   into `subscriptions`, or add a `useProperties()` fallback in the dashboard for
   unmatched one-time properties?
3. **`status: "completed"` value** (Fix 2a): before implementing, grep all
   `server/` and `client/` code for `.eq("status", "active")` / similar against the
   `subscriptions` table to confirm nothing needs `"completed"` one-time rows to also
   match an "active plan" check. (This is step 1 of the implementation order below —
   read-only, no decision needed from the user to *start* it, but findings may surface
   new questions.)

---

## Implementation Order (if approved)

1. Grep all `subscriptions`-table `status`/`program` reads across `server/` and
   `client/` to validate assumptions in 2a/2b (read-only, ~15 min).
2. Fix 1a — read `program` directly in `useSubscriptions.ts` (isolated, additive; makes
   `"annual"` reachable immediately).
3. Fix 1b — add `amount_cents` to the annual upserts in `confirm-booking` and the
   webhook (additive column writes).
4. Fix 1c/1d — annual label/cadence/button copy in `Billing.tsx` + `Dashboard.tsx`
   (after resolving Open Question 1).
5. Fix 3a/3b/3c — one-time cadence cosmetics (fully independent; can be done in any
   order relative to 1/2).
6. Fix 2a/2b/2c — one-time `subscriptions` row + display (depends on 1a landing first
   so `program` is read correctly).
7. Fix 2d — backfill, after resolving Open Question 2.

---

## Testing Plan (manual, post-implementation)

| Scenario | Expected result after fix |
|---|---|
| New **annual** purchase (any acreage tier) | Billing.tsx shows "Annual Plan" / "Prepaid annual plan" / correct `$999`–`$2,900` / "year" |
| New **one-time** purchase | Billing.tsx shows "Single Treatment" / "One-time intensive service" / "$175.00 / visit" (not "No active plan") |
| New **subscription** purchase | Billing.tsx **unchanged** — "Active Subscription" / "{cadence}-day recurring cadence" / correct $/visit (regression check) |
| Dashboard.tsx "Active Plan" widget | Mirrors all three above |
| `create-portal-session` | Still works for `subscription` (and `annual`, if previously relied on `active`/`past_due`); one-time customers (`status: "completed"`) do not get portal access |
| `generateRecurring.ts` | Unchanged — still skips one-time, generates for subscription/annual (no code in this file changes; confirm the new one-time `subscriptions` row, `status: "completed"`, isn't picked up by any `status === "active"` query this script uses) |
| Pre-existing annual customer (created before Fix 1b ships) | `amount_cents` is `NULL` for their row until their *next* payment event re-upserts it — `price` falls back to `pricing.perVisit` as today (no regression, but also no improvement until next payment/webhook). Consider whether a one-time backfill of `amount_cents` for existing annual rows (using `lookupAnnualCents(properties.acreage)`) is worth adding to Fix 2d's backfill pass. |

---

**No code has been changed as part of this proposal.** All of the above is pending
review and approval.
