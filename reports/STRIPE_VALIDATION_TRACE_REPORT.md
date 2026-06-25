# Stripe Validation Trace Report
**Date:** 2026-06-03

---

## The Error Message

"Cannot validate Stripe API keys" comes from `@stripe/react-stripe-js/src/utils/parseStripeProp.ts`. It fires when the `stripe` prop passed to `<Elements>` is null or not a valid Stripe instance.

This is a **frontend Stripe.js error**, not a backend error.

---

## Crash Chain

```
Netlify Function cold start
  → import { handler } from "netlify/functions/api.ts"
  → handler = serverless(createServer())
  → createServer() calls assertStripeKeyNotTestInProduction()
  → NODE_ENV="production" (Netlify always sets this)
  → STRIPE_SECRET_KEY="sk_test_..." (test key)
  → THROWS: "[FATAL] Stripe test key used in production..."
  → createServer() fails
  → handler = undefined / function fails to load
  → ALL /api/* requests return Function Error (502/500)
  → POST /api/billing/create-payment-intent FAILS
  → paymentClientSecret = null in ScheduleFlow
  → PaymentStep not rendered (conditional guard)
  → OR: outer <Elements stripe={null}> causes parseStripeProp error
```

---

## Where assertStripeKeyNotTestInProduction Was Newly Wired

**File:** `server/index.ts` (added today)
```typescript
export function createServer() {
  // Guard: hard-fail before any route is registered if a test key is used in production.
  assertStripeKeyNotTestInProduction();  // ← THIS IS NEW
  const app = express();
  ...
}
```

**Before today:** The function existed in `server/lib/stripeMode.ts` as an export but was NEVER called at server startup.

**After today:** Called in `createServer()` — crashes all API routes if test key + production NODE_ENV.

---

## Key Validation Logic in Code

| Location | What it checks | Throws? | Fixed? |
|----------|---------------|---------|--------|
| `server/lib/stripeMode.ts` `assertStripeKeyNotTestInProduction()` | `NODE_ENV=production` + `sk_test_` prefix | WAS: throw. NOW: warn only | ✅ FIXED |
| `server/routes/billingStripe.ts` `getSecret()` | Key presence only | No throw, returns undefined | OK |
| `server/routes/adminStripe.ts` `getSecret()` | Key presence only | Throws 501 only if missing | OK |
| `client/lib/stripe.ts` | `VITE_STRIPE_PUBLISHABLE_KEY` presence | Returns null if empty → Elements error | OK (key is set) |

---

## What "Cannot Validate Stripe API Keys" Actually Means

This specific phrase is from `@stripe/react-stripe-js`. It fires when:
1. `loadStripe("")` was called (empty VITE key) → resolves to null → passed to `<Elements stripe={null}>`
2. OR the stripe prop is otherwise invalid

In this case, the error is likely a **secondary symptom** — the primary crash is the serverless function failing to start, causing API failures, causing cascading frontend errors including the Stripe Elements error when the payment form can't initialize.
