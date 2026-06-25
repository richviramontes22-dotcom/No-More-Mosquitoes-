# Stripe Regression Changelog
**Date:** 2026-06-03
**Basis:** `git diff HEAD` and `git log --oneline`

---

## Root Cause in One Line

`assertStripeKeyNotTestInProduction()` was added to `createServer()` startup today. Netlify always sets `NODE_ENV=production`. If Netlify has `STRIPE_SECRET_KEY=sk_test_...` (test key for staging), the function **throws at cold start**, crashing all `/api/*` routes permanently until redeployed.

---

## Changes to server/index.ts

```diff
+  // Guard: hard-fail before any route is registered if a test key is used in production.
+  assertStripeKeyNotTestInProduction();
```

**Added by:** Production Observability sprint (today)
**Effect:** `createServer()` throws a `[FATAL]` error if `NODE_ENV === "production"` AND `STRIPE_SECRET_KEY.startsWith("sk_test_")`. On Netlify, `NODE_ENV` is always `"production"` for deployed functions — including staging builds and preview deploys.

---

## Other Changes Affecting Stripe (Not Causing Regression)

| File | Change | Impact |
|------|--------|--------|
| `server/routes/billingStripe.ts` | Added logger, checkpoint, Sentry — changed timeout 8s→6s | Low risk; logic unchanged |
| `client/App.tsx` | Moved `stripePromise` initialization to `@/lib/stripe` | Non-breaking; `stripePromise` still correctly initialized |
| `client/components/schedule/ScheduleFlow.tsx` | Massive rewrite (1494 lines) — new inline payment flow | New `PaymentStep` component; only renders when `paymentClientSecret` is set |
| `client/components/schedule/PaymentStep.tsx` | NEW FILE — wraps `<Elements>` with per-intent clientSecret | Uses same `stripePromise` from `@/lib/stripe` |
| `server/lib/stripeMode.ts` | `assertStripeKeyNotTestInProduction()` function already existed | The function existed, but was NEWLY CALLED from `createServer()` |

---

## What Was NOT Changed (Evidence This Is Not the Cause)

- `client/lib/stripe.ts` — `loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "")` unchanged
- `server/routes/webhooksStripe.ts` — Webhook handler logic unchanged
- `server/routes/adminStripe.ts` — Admin Stripe endpoints unchanged
- Netlify env vars — User confirms keys unchanged
- Stripe key prefixes — Keys not rolled
