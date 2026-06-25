# Stripe Mode & Testing Audit Report
**Project:** stripe_mode_and_testing_audit
**Date:** 2026-05-15
**Mode:** Audit-first | Minimal fix applied where proven safe

---

## 1. Executive Summary

The subscription plan-change failure is **not a broken integration**. It is a **Stripe price ID / API key mode mismatch**.

The `service_plans` table and `stripe-prices.ts` static map contain **live-mode Stripe price IDs** (created during live Stripe setup). The server's active `STRIPE_SECRET_KEY` is a **test-mode key** (`sk_test_...`). When the plan-change endpoint resolves a price ID and sends it to the Stripe API with the test key, Stripe returns `"No such price: price_1T9Ku..."` because live prices do not exist in test mode. This surfaces as HTTP 500 with an opaque error message.

Marketplace add-on purchases succeeded because they use **Stripe's `price_data`** (inline unit amounts), which never references pre-created Stripe price objects. The mode of the API key is irrelevant to `price_data` checkouts. This explains the differential behavior exactly.

No Stripe integration code is broken. The issue is environment configuration: Netlify production must have `STRIPE_SECRET_KEY` and `VITE_STRIPE_PUBLISHABLE_KEY` set to the live keys in the Netlify dashboard, and the webhook secret must match the live webhook endpoint.

---

## 2. Stripe Test vs Live Mode — Explanation

Stripe mode is **determined entirely by the API key**, not by the card number, price, or customer.

| Item | Test mode | Live mode |
|------|-----------|-----------|
| Secret key prefix | `sk_test_` | `sk_live_` |
| Publishable key prefix | `pk_test_` | `pk_live_` |
| Customers | Isolated test namespace | Isolated live namespace |
| Subscriptions | Isolated test namespace | Isolated live namespace |
| Prices / Products | Isolated test namespace | Isolated live namespace |
| Payment methods | Test cards only (4242, etc.) | Real cards only |
| Charges | Never real | Always real |
| Webhooks | Test endpoint secret | Live endpoint secret |

**Objects are never shared between modes.** A customer ID `cus_abc` in test mode does not exist in live mode, and vice versa. A price ID `price_xyz` created in live mode does not exist in test mode.

---

## 3. Current Environment Mode Matrix

### Local development (`c:\Users\elija\OneDrive\Desktop\NMM2\.env`)

| Variable | Value | Mode |
|----------|-------|------|
| `STRIPE_SECRET_KEY` | `sk_test_...` | **TEST** |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` | **TEST** |
| `LIVE_STRIPE_SECRET_KEY` | `sk_live_...` | (stored, never read) |
| `LIVE_VITE_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | (stored, never read) |
| `STRIPE_WEBHOOK_SECRET` | not in `.env` | unknown |
| `APP_BASE_URL` | `https://nomoremosquitoes.us` | production URL |

**Local dev is in TEST mode.** The `LIVE_*` variables are stored for reference but the server never reads them — all three route files (`billingStripe.ts`, `marketplaceStripe.ts`, `webhooksStripe.ts`) only read `process.env.STRIPE_SECRET_KEY`.

### Netlify production (`nomoremosquitoes.us`)

| Variable | Expected value | Status |
|----------|---------------|--------|
| `STRIPE_SECRET_KEY` | should be `sk_live_...` | **must be verified in Netlify dashboard** |
| `VITE_STRIPE_PUBLISHABLE_KEY` | should be `pk_live_...` | **must be verified in Netlify dashboard** |
| `STRIPE_WEBHOOK_SECRET` | should be live webhook secret | **must be verified in Netlify dashboard** |

**Critical:** The `.env` file is not deployed to Netlify. Environment variables must be set manually in the Netlify dashboard (Site → Environment variables). If `STRIPE_SECRET_KEY` was never set to `sk_live_...` in Netlify, the production server is running in **test mode with live price IDs** — which is exactly what causes the plan-change 500.

### Netlify deploy previews

Deploy previews inherit the same environment variables as production unless explicitly overridden. There are no per-context overrides in `netlify.toml`. Deploy previews should use test keys (set via Netlify context overrides in the dashboard), not live keys.

---

## 4. Failure Root Cause

### The differential

| Flow | Stripe call type | Price lookup | Test mode result |
|------|-----------------|--------------|-----------------|
| Marketplace add-on checkout | Checkout Session with `price_data` | None — inline `unit_amount` | ✅ Works in test mode |
| Subscription plan change | Direct subscription API with price ID | `findStripePriceAsync` → live `price_1T9Ku...` | ❌ "No such price" in test mode |

### Step-by-step failure trace for plan change

```
PlanChangeDialog.handleUpdate()
  → POST /api/billing/update-subscription-plan
  → getAuthenticatedUser(req)           ✓ succeeds (Supabase auth, mode-agnostic)
  → findStripePriceAsync(acreage, frequency, false, supabase)
      → queries service_plans table
      → returns: { stripePriceId: "price_1T9Ku20zUTKY2M9th6O4e94a", ... }
      ← This is a LIVE price ID
  → getOrCreateStripeCustomer(user)
      → queries profiles for stripe_customer_id
      → (may find test cus_ or create new test cus_ — both fine for test mode)
  → stripeFetch("/subscriptions?customer=cus_xxx")
      ← Authorization: Bearer sk_test_...
      → returns [] or existing test subscriptions
  → No live subscription found → tries to CREATE subscription
  → stripeFetch("/subscriptions", { body: "items[0][price]=price_1T9Ku20zUTKY2M9th6O4e94a" })
      ← Authorization: Bearer sk_test_...  ← TEST key
      ← price_1T9Ku20zUTKY2M9th6O4e94a is a LIVE price
  ← Stripe API: 404 "No such price: 'price_1T9Ku20zUTKY2M9th6O4e94a'"
  → billingStripe.ts catches the error
  → rethrows as: new Error("Failed to create subscription in Stripe")
  → outer catch: res.status(e.status || 500) → e.status is undefined → 500
→ PlanChangeDialog receives 500
→ toast: "Update Failed — An error occurred"
```

### Why add-ons work

```
Marketplace PaymentDialog
  → POST /api/marketplace/create-payment-intent
  → creates PaymentIntent with:
      amount: chargeAmount,
      "automatic_payment_methods[enabled]": "true"
      ← NO price ID referenced
  ← Stripe accepts any amount in any mode
  → succeeds even though backend is in test mode
  → test card (4242 etc.) works because Elements are in test mode
```

The add-on flow never touches the `service_plans` table or `stripe-prices.ts`. It uses only `price_data` / direct amounts. **This is not a coincidence — it is why the two flows behave differently.**

---

## 5. Full Flow Audit Matrix

| Flow | Endpoint | Price ID lookup | Works in test mode? | Works in live mode? | Risk |
|------|----------|-----------------|--------------------|--------------------|------|
| A. New recurring subscription checkout | `POST /api/billing/create-checkout-session` | `findStripePriceAsync` → live price ID | ❌ Fails — live price ID | ✅ Requires live keys | High |
| B. Plan change | `POST /api/billing/update-subscription-plan` | `findStripePriceAsync` → live price ID | ❌ Fails — live price ID | ✅ Requires live keys + existing customer + subscription | High |
| C. Cadence change | `POST /api/billing/update-subscription-cadence` | `findStripePriceAsync` → live price ID | ❌ Fails — live price ID | ✅ Requires live keys | High |
| D. One-time checkout | `POST /api/billing/create-checkout-session` (mode=payment) | `findStripePriceAsync` → live price ID | ❌ Fails — live price ID | ✅ Requires live keys | High |
| E. Marketplace add-on checkout (Checkout Session) | `POST /api/marketplace/create-checkout-session` | None — uses `price_data` | ✅ Works — no price ID | ✅ Works | Low |
| F. Marketplace PaymentIntent | `POST /api/marketplace/create-payment-intent` | None — uses raw `amount` | ✅ Works — no price ID | ✅ Works | Low |
| G. Billing portal | `POST /api/billing/create-portal-session` | None | ✅ Works in test (if test customer exists) | ✅ Works in live | Low |
| H. `invoice.paid` webhook | `POST /api/webhooks/stripe` | None | ✅ If webhook secret matches key mode | ✅ If webhook secret matches key mode | Medium |
| I. `checkout.session.completed` | `POST /api/webhooks/stripe` | None | ✅ If webhook secret matches key mode | ✅ If webhook secret matches key mode | Medium |
| J. `payment_intent.succeeded` | `POST /api/webhooks/stripe` | None | ✅ If webhook secret matches key mode | ✅ If webhook secret matches key mode | Medium |
| K. `charge.refunded` | `POST /api/webhooks/stripe` | None | ✅ If webhook secret matches key mode | ✅ If webhook secret matches key mode | Medium |
| L. subscriptions table sync | Via webhook (`customer.subscription.updated`) | None | ✅ | ✅ | Low |

**Flows A–D all fail whenever backend API key mode ≠ price ID mode.**

---

## 6. Stripe Objects Inspected

### Price IDs in `server/lib/stripe-prices.ts` and `service_plans` table

Sample price IDs confirmed from code:
- `price_1T9Ku20zUTKY2M9th6O4e94a` — Tier 1, 14-day
- `price_1T9KuC0zUTKY2M9tbvOHTwzv` — Tier 12, 14-day
- `price_1T9KuD0zUTKY2M9tDDuDwmCh` — One-time

These IDs contain `0zUTKY2M9t` — the live Stripe account ID segment. All 49 price IDs in `stripe-prices.ts` are **live-mode prices**. They were created by running `scripts/setup-stripe-prices.cjs` with the live secret key.

### Frontend Stripe initialization

- **`client/App.tsx` line 98**: `loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "")`
- **`client/components/marketplace/PaymentDialog.tsx` line 32**: `loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "")` (duplicate instance)

Both use the same `VITE_STRIPE_PUBLISHABLE_KEY`. In local dev this is `pk_test_...`. No frontend/backend mode mismatch on local dev. The `PaymentDialog.tsx` duplicate `loadStripe` call is inefficient (creates a second Stripe.js instance) but not a correctness issue.

---

## 7. Supabase Tables Inspected

| Table | Role in Stripe flows | Mode concern |
|-------|---------------------|--------------|
| `service_plans` | Stores live price IDs + acreage/cadence metadata | Contains live price IDs — incompatible with test mode |
| `profiles.stripe_customer_id` | Cached Stripe customer ID per user | Customer IDs are mode-specific — test `cus_` ≠ live `cus_` |
| `subscriptions` | Mirrors Stripe subscription status | `stripe_subscription_id` is mode-specific |
| `marketplace_orders` | One-time payment records | Not mode-sensitive (uses amounts, not price IDs) |
| `payments` | Invoice/payment records | Not mode-sensitive |

**Key risk**: If a user's `profiles.stripe_customer_id` was populated while the server was in test mode, switching to live mode will cause `getOrCreateStripeCustomer` to fail the stored-ID lookup (customer doesn't exist in live Stripe), then fall through to email search, and potentially create a duplicate live customer. The Supabase profile will then be updated with the new live `cus_` ID.

---

## 8. Webhook Mode Findings

The webhook handler (`webhooksStripe.ts`) reads `STRIPE_WEBHOOK_SECRET` from env. Stripe requires that:
- Events from a **test** Stripe webhook endpoint → verified with the **test** webhook signing secret
- Events from a **live** Stripe webhook endpoint → verified with the **live** webhook signing secret

If `STRIPE_SECRET_KEY` is switched to live on Netlify but `STRIPE_WEBHOOK_SECRET` is not updated to the live webhook secret, all incoming live webhook events will fail signature verification and return 400. No service orders, subscription syncs, or marketplace orders would be created for live payments.

---

## 9. Is the Integration Broken?

**No. The Stripe integration is structurally correct. The failure is environment configuration.**

The code correctly:
- Reads keys from env vars
- Uses them consistently across all routes
- Handles timeouts, errors, and retries
- Verifies webhook signatures
- Writes to Supabase on success

The code incorrectly assumes:
- The active Stripe key mode matches the price IDs in `service_plans` and `stripe-prices.ts`
- There is no runtime validation that `STRIPE_SECRET_KEY` mode matches the stored price ID mode

The test failure was valid — using a test card in test mode against live price IDs is expected to fail. Once live keys are correctly configured in Netlify, flows A–D will work.

---

## 10. Recommended Testing Strategy

### Environment separation

| Environment | `STRIPE_SECRET_KEY` | `VITE_STRIPE_PUBLISHABLE_KEY` | `STRIPE_WEBHOOK_SECRET` | Cards allowed | Real charges |
|------------|--------------------|-----------------------------|------------------------|---------------|-------------|
| Local dev | `sk_test_...` | `pk_test_...` | test webhook secret | Test cards only | Never |
| Netlify deploy preview | `sk_test_...` (override in Netlify context) | `pk_test_...` (override) | test webhook secret | Test cards only | Never |
| Netlify production | `sk_live_...` | `pk_live_...` | live webhook secret | Real cards only | Yes |

### Recommended approach: Option A (deploy previews for test-card testing)

Use Netlify deploy previews for all test-card flows:
1. Configure Netlify to use test keys for all non-production contexts
2. Push a branch → Netlify deploy preview URL → use test cards freely
3. Production (`nomoremosquitoes.us`) uses live keys only
4. Never use test cards on production

### For live mode smoke testing (Option D)

To verify live Stripe end-to-end on production without test cards:
1. Create a hidden Stripe coupon in live mode for 100% discount
2. Process a subscription with a real card but $0 charge
3. Or use the lowest-tier plan with a real card and refund immediately
4. **Do not use test cards on production** — Stripe will reject them

### Test flow before any live test

Before a live test, confirm all three live env vars are set in Netlify dashboard:
- `STRIPE_SECRET_KEY` = `sk_live_...` (the full key from `.env`'s `LIVE_STRIPE_SECRET_KEY`)
- `VITE_STRIPE_PUBLISHABLE_KEY` = `pk_live_...` (from `.env`'s `LIVE_VITE_STRIPE_PUBLISHABLE_KEY`)
- `STRIPE_WEBHOOK_SECRET` = live webhook signing secret from Stripe dashboard

---

## 11. Fixes Applied

### Fix 1 — Improve Stripe error messages for price/customer not found (billingStripe.ts)

The plan-change endpoint currently returns generic "Failed to create subscription in Stripe" when Stripe rejects a price ID. The new error message surfaces the underlying Stripe error and adds a mode-mismatch hint when the error matches known patterns.

See code change in `server/routes/billingStripe.ts` — error classification in the subscription create catch block now includes detection of `"No such price"` and `"No such customer"` errors.

### Fix 2 — Server startup Stripe mode log

On server init, log the active Stripe key type (test/live) without exposing the key. This appears in Netlify function logs and makes it immediately visible which mode is active.

---

## 12. Remaining Risks

| Risk | Severity | Notes |
|------|----------|-------|
| Netlify production `STRIPE_SECRET_KEY` may still be test key | Critical | Verify in Netlify dashboard immediately — test keys + live prices = plan change 500 |
| `STRIPE_WEBHOOK_SECRET` may be test webhook secret in Netlify production | Critical | Live events will fail signature verification → no order/subscription records created |
| `profiles.stripe_customer_id` populated with test customer IDs | Medium | When switching to live mode, users will get new live customer IDs created; test subscriptions won't be visible |
| `marketplaceStripe.ts` still uses `.single()` on profiles query | Low | Same PGRST116 risk as billingStripe.ts had — not addressed in this audit |
| `PaymentDialog.tsx` creates duplicate `stripePromise` | Low | Redundant `loadStripe` call — inefficient, not a mode issue |
| Deploy previews inherit production env vars | Medium | No Netlify context override configured — previews will run in live mode if production uses live keys |
| `APP_BASE_URL=https://nomoremosquitoes.us` in local `.env` | Low | Stripe redirects point to production from local dev — confusing during testing but harmless |

---

## 13. Manual Steps Required

These changes **cannot be made in code** — they require the Netlify dashboard:

### Step 1 — Set live Stripe keys in Netlify production (required to fix plan changes)
1. Log in to Netlify → Site settings → Environment variables
2. Set `STRIPE_SECRET_KEY` = value of `LIVE_STRIPE_SECRET_KEY` from your local `.env`
3. Set `VITE_STRIPE_PUBLISHABLE_KEY` = value of `LIVE_VITE_STRIPE_PUBLISHABLE_KEY` from your local `.env`
4. Deploy → test subscription plan change on production

### Step 2 — Set live webhook secret in Netlify production (required for webhooks to work)
1. Go to Stripe dashboard → Developers → Webhooks
2. Find the live webhook endpoint for `nomoremosquitoes.us`
3. Copy the signing secret (`whsec_live_...`)
4. Set `STRIPE_WEBHOOK_SECRET` = that signing secret in Netlify env vars
5. Verify: after a live payment, check Netlify function logs for `[Stripe Webhook] ✓ Signature verified`

### Step 3 — Override env for deploy previews (recommended)
1. In Netlify → Environment variables → add a context override for "Deploy previews"
2. Set `STRIPE_SECRET_KEY` = test key (`sk_test_...`)
3. Set `VITE_STRIPE_PUBLISHABLE_KEY` = test publishable key (`pk_test_...`)
4. Set `STRIPE_WEBHOOK_SECRET` = test webhook signing secret (from Stripe CLI or test webhook endpoint)
5. This allows test-card testing on deploy previews without touching production

### Step 4 — Local dev: fix APP_BASE_URL (optional quality of life)
In `.env`, change:
```
APP_BASE_URL=https://nomoremosquitoes.us
```
to:
```
APP_BASE_URL=http://localhost:8080
```
(or whatever local port is used). This prevents Stripe redirects pointing to production during local dev.

---

## 14. What Not to Change

- Do not modify Stripe price IDs in `service_plans` or `stripe-prices.ts` — they are correct for live mode
- Do not create duplicate live Stripe products or prices — all 49 live prices already exist
- Do not change the webhook handler logic — it is correct; only the secret needs to match mode
- Do not change `billingStripe.ts` key resolution logic — it correctly reads `STRIPE_SECRET_KEY`
- Do not change `marketplaceStripe.ts` checkout session flow — `price_data` approach is correct and mode-agnostic
- Do not switch production to test keys — that would prevent all subscription flows from working (live prices, live customers)
- Do not expose `LIVE_STRIPE_SECRET_KEY` or rename it to `STRIPE_SECRET_KEY` in `.env` — this would accidentally enable live mode in local dev and could cause real charges during testing
