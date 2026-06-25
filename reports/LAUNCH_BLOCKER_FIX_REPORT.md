# Launch Blocker Fix Report
**Sprint:** Launch Blocker + High-Value Operational Fix Sprint  
**Date:** 2026-05-28  
**Status:** All P0 fixes implemented

---

## P0.1 — Block Stripe Test Keys in Production

### Problem Statement
The `getSecret()` function in `billingStripe.ts` and `stripeMode.ts` only logged a `console.warn` when a test key was detected in production. It never blocked the server from starting or making Stripe API calls. A misconfigured deployment with `sk_test_` + `NODE_ENV=production` would silently process real user traffic against Stripe test mode, causing all subscription charges to fail.

### Files Changed
- `server/lib/stripeMode.ts` — added `assertStripeKeyNotTestInProduction()` function (new export, lines 4–20)
- `server/index.ts` — imports and calls the guard at module-load time (lines 2–5)

### Implementation Description
A new exported function `assertStripeKeyNotTestInProduction()` was added to `stripeMode.ts`. It reads `STRIPE_SECRET_KEY || STRIPE_API_KEY || STRIPE_SECRET` and throws a fatal `Error` if `NODE_ENV === "production"` and the key starts with `sk_test_`. The function is called at the top level of `server/index.ts` — before `express` is imported and before `createServer()` is ever reached — so the process crashes at startup instead of silently accepting traffic.

Local development is not affected. The guard only fires when `NODE_ENV` is exactly `"production"`.

### Validation
- Guard only activates when `NODE_ENV === "production"` AND key starts with `sk_test_`
- Local dev with `sk_test_` key continues to work normally
- Production with `sk_live_` key: no throw, normal startup

### Remaining Risks
- `STRIPE_API_KEY` and `STRIPE_SECRET` are fallback env var names. All three are checked by the guard. Document these alternatives in `.env.example` to prevent confusion.
- The guard does not validate that the live key is correctly formatted beyond the `sk_live_` prefix.

---

## P0.2 — Disable Test Payment Method Endpoint in Production

### Problem Statement
`POST /api/billing/create-and-attach-payment-method` is a test-only utility that creates a Stripe source from a hardcoded test token (`tok_visa`, `tok_mastercard`, `tok_amex`) and stores fake card display metadata in Stripe customer metadata. In production this endpoint would silently accept calls, potentially allowing unprivileged users to write fake card data to Stripe customer records.

### Files Changed
- `server/routes/billingStripe.ts` — added production guard at the top of the handler (line 1014)

### Implementation Description
A single guard was added as the very first statement inside the `try` block of the `create-and-attach-payment-method` handler:
```typescript
if (process.env.NODE_ENV === "production") {
  return res.status(403).json({ error: "Not available in production." });
}
```
This returns HTTP 403 before any auth check or Stripe API call. The `attach-payment-method` endpoint (which handles real card updates via PaymentElement) is a separate route and is unchanged.

### Validation
- Returns 403 in production (NODE_ENV === "production")
- Returns normal flow in development/test environments
- The real `attach-payment-method` route at `/api/billing/attach-payment-method` is unaffected

### Remaining Risks
- None. The endpoint was always test-only by design.

---

## P0.3 — Fix Reschedule Capacity Check

### Problem Statement
`checkWindowAvailability()` in `server/routes/customerAppointments.ts` calculated slot capacity as `1 * (windowDef.max_jobs_per_tech ?? 3)` — hardcoded to 1 technician. As the business scales and more active technicians are added, the reschedule availability check would refuse valid slots even when technicians had open capacity. This is a silent data correctness bug: customers see "slot full" errors on dates that are actually available.

### Files Changed
- `server/routes/customerAppointments.ts` — replaced the hardcoded capacity calculation (line 73–74)

### Implementation Description
Replaced:
```typescript
const capacity = 1 * (windowDef.max_jobs_per_tech ?? 3);
```
With:
```typescript
const { data: activeTechs } = await db.from("employees").select("id").eq("status", "active");
const activeTechCount = (activeTechs && activeTechs.length > 0) ? activeTechs.length : 1;
const capacity = activeTechCount * (windowDef.max_jobs_per_tech ?? 3);
```
The `db` reference (`supabaseAdmin ?? supabase`) was already defined at the module level in this file — the new query uses the same client. The fallback of `1` ensures zero-employee scenarios don't divide by zero or open unlimited capacity.

### Validation
- Capacity now reflects actual active technician count from the database
- Fallback to 1 technician if no active employees found (conservative, fail-safe)
- The `findAvailableSlot` function in `generateRecurring.ts` already did this correctly — the reschedule route now matches

### Remaining Risks
- The active tech query adds one DB round-trip per reschedule request. This is negligible for a low-volume service ops business.

---

## P0.4 — Fix Annual Plan Recurring Appointment Generation

### Problem Statement
The recurring appointment generator (`generateRecurring.ts`) had a single skip condition for non-recurring programs:
```typescript
if (program === "one_time" || program === "annual") continue;
```
This means annual plan subscribers never got recurring appointments generated — even while their paid period was active. Customers on the annual plan had to manually schedule every follow-up visit, which breaks the SLA of scheduled recurring service.

### Files Changed
- `server/services/appointments/generateRecurring.ts` — two changes:
  1. Added `current_period_end` to the subscriptions SELECT query (line 59)
  2. Replaced the combined skip condition with program-specific logic (lines 88–101)

### Implementation Description
The SELECT query now fetches `current_period_end` from the subscriptions table (already stored by `confirm-booking` and `payment_intent.succeeded` webhook for annual plans).

The skip logic was split:
- `one_time` programs: always skipped (no recurring generation)
- `annual` programs: skipped only if `current_period_end` is null or in the past. Annual plans with a future `current_period_end` now proceed through the full slot-finding and appointment generation logic.

### Validation
- Annual subscribers with active period (`current_period_end > now`) receive recurring appointments
- Expired annual subscribers are correctly skipped
- One-time programs remain fully skipped
- The idempotency guard (future appointment already exists) prevents double-creation

### Remaining Risks
- Annual plans store `current_period_end = now + 365 days` at checkout. If a customer's annual plan is manually extended or renewed early, the `current_period_end` must be updated in the subscriptions table for this guard to reflect the new period.
- Annual plan renewal is still manual (customer re-purchases). The system does not auto-renew annual plans.

---

## P0.5 — Sync Real Payment Method Details

### Problem Statement
The `profiles` table had no `card_last4`, `card_brand`, or `card_expiry` columns. After payment, the billing dashboard had no way to display real card information. The previous `create-and-attach-payment-method` endpoint stored fake metadata in Stripe customer metadata (not in Supabase), which was non-functional in production.

### Files Changed
- `db/migrations/2026-05-28_profiles_card_fields.sql` — NEW FILE, adds three columns to profiles
- `server/routes/webhooksStripe.ts` — card sync after `invoice.paid` subscription upsert (lines 502–523)
- `server/routes/billingStripe.ts` — card sync after `attach-payment-method` success (lines 1069–1077)

### Implementation Description

**Migration:** Three `ADD COLUMN IF NOT EXISTS` statements add `card_last4 text`, `card_brand text`, and `card_expiry text` to `profiles`. Safe to re-run.

**Webhook path (subscriptions):** After the `invoice.paid` subscription upsert completes, a non-fatal try/catch block fetches the payment method from Stripe using `stripe.paymentMethods.retrieve(pmId)`. It targets the `default_payment_method` field on the invoice, which is a `pm_` prefixed ID. If found and the card details are present, it writes `card_last4`, `card_brand`, and `card_expiry` (formatted as `MM/YY`) to the profile row matched by `resolvedUserId`.

**Billing portal path (card updates):** The `attach-payment-method` route now uses the response from `stripeFetch("/payment_methods/{id}/attach", ...)` which returns the full PaymentMethod object. If `pm.card` is present, it immediately writes the card details to `supabaseAdmin.from("profiles")` by user ID.

Both paths are non-fatal (wrapped in try/catch) — a failure to sync card details never blocks the payment flow.

### Validation
- Migration is additive and idempotent
- Webhook sync handles the case where `pmId` is not a `pm_` prefixed string (skips gracefully)
- Billing portal sync uses `supabaseAdmin` (service role) to bypass RLS

### Remaining Risks
- The `invoice.paid` path can only sync if the invoice has a `default_payment_method` field. Older invoices or bank transfer payments won't set this field — in those cases, the try/catch skips silently.
- A card-detail sync migration (`2026-05-28_profiles_card_fields.sql`) must be applied to Supabase before the sync code runs. Until then, the upserts will fail silently.
