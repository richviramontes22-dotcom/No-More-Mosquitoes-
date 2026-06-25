# Payment and Stripe Mode Hardening Report
**Sprint:** Launch Blocker + High-Value Operational Fix Sprint  
**Date:** 2026-05-28

---

## Summary

This sprint completed three payment-system hardening items: a hard-fail startup guard for test keys in production, a production gate on the test-only card attachment endpoint, and real card detail sync from Stripe to the `profiles` table.

---

## Stripe Mode Enforcement

### What Changed

**File:** `server/lib/stripeMode.ts`  
**New export:** `assertStripeKeyNotTestInProduction()`

The existing `stripeMode.ts` already had `getStripeMode()`, `isTestMode()`, `isLiveMode()`, and `getStripeDiagnostics()` — all of which could detect the mismatch, but none of which blocked execution. The existing `getSecret()` in `billingStripe.ts` logged a `console.warn` but returned the key regardless.

The new function `assertStripeKeyNotTestInProduction()` **throws** a fatal error when:
- `process.env.NODE_ENV === "production"` AND
- The resolved key starts with `sk_test_`

It checks all three key env var names (`STRIPE_SECRET_KEY`, `STRIPE_API_KEY`, `STRIPE_SECRET`) matching the same priority order used throughout the codebase.

**File:** `server/index.ts`  
The guard is called at the top level of the module — before `createServer()` is invoked. This means the Node process will exit before Express is set up, before any route is registered, and before any Stripe API call can be made.

### Test/Live Behavior

| Environment | Key | Behavior |
|---|---|---|
| `NODE_ENV=production` | `sk_live_...` | Normal startup |
| `NODE_ENV=production` | `sk_test_...` | **Throws — process exits** |
| `NODE_ENV=development` | `sk_test_...` | Normal startup (dev workflow) |
| `NODE_ENV=development` | `sk_live_...` | Normal startup (warns in `getSecret()`) |
| `NODE_ENV` not set | any key | Normal startup (guard inactive) |

---

## Test Endpoint Guard

### Where the Guard Is

**File:** `server/routes/billingStripe.ts`  
**Route:** `POST /api/billing/create-and-attach-payment-method`  
**Line:** First statement inside the handler, before authentication

```typescript
if (process.env.NODE_ENV === "production") {
  return res.status(403).json({ error: "Not available in production." });
}
```

### What It Returns

- **Production:** HTTP 403 `{ "error": "Not available in production." }`
- **Development/test:** Normal endpoint behavior (create Stripe source from test token)

### The Real Endpoint Is Untouched

`POST /api/billing/attach-payment-method` — the endpoint that attaches a real PaymentMethod ID (from Stripe's PaymentElement) to a customer — is fully functional in all environments. This is the endpoint customers use when updating their card on file through the billing dashboard.

---

## Card Detail Sync

### How Data Flows from Stripe to Profiles Table

**New database columns (migration `2026-05-28_profiles_card_fields.sql`):**
```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS card_last4  text,
  ADD COLUMN IF NOT EXISTS card_brand  text,
  ADD COLUMN IF NOT EXISTS card_expiry text;
```

**Path A — Subscription payment (`invoice.paid` webhook):**

1. Stripe fires `invoice.paid` after a successful subscription charge
2. The webhook handler upserts the subscription row and creates a service order (pre-existing logic)
3. After the upsert, the new code reads `invoice.default_payment_method` (a `pm_` prefixed PaymentMethod ID)
4. If the ID starts with `pm_`, it calls `stripe.paymentMethods.retrieve(pmId)` using the server-initialized Stripe client
5. If `pm.card` is present, it formats the expiry as `MM/YY` and writes `card_last4`, `card_brand`, `card_expiry` to the user's profile row

**Path B — Manual card update (`attach-payment-method` endpoint):**

1. Customer submits a new card through the billing dashboard PaymentElement
2. The server attaches the PaymentMethod to the Stripe customer
3. The `stripeFetch("/payment_methods/{id}/attach", ...)` response is the full PaymentMethod object
4. If `pm.card` is present, it immediately writes card details to the profile using `supabaseAdmin`

**Error handling:**  
Both paths are wrapped in try/catch. A failure to sync card details (e.g., Supabase unavailable, migration not yet applied) never fails the payment confirmation or card attachment.

---

## Payment System Risks Remaining

1. **Migration must be applied before card sync.** The `2026-05-28_profiles_card_fields.sql` migration needs to be run in Supabase. Until then, card sync writes will fail with a "column does not exist" error (silently, in the catch block).

2. **Annual plan payments don't go through `invoice.paid`.** Annual plans use a PaymentIntent (one-time charge), not a subscription invoice. Card sync for annual plans is not implemented in the webhook (the `payment_intent.succeeded` branch could be extended, but `pm_` IDs aren't always present on PaymentIntents). Card sync for annual plans only occurs if the customer later updates their card via `attach-payment-method`.

3. **Payment method details are display-only.** `card_last4`, `card_brand`, and `card_expiry` in `profiles` are for UI display. The authoritative record is in Stripe. There is no automatic refresh if the customer updates their card through the Stripe Customer Portal.

4. **`invoice.default_payment_method` may be null.** For older subscriptions or certain payment methods (ACH, bank transfers), this field may not be a `pm_` prefixed ID. The guard `pmId.startsWith("pm_")` silently skips these cases.
