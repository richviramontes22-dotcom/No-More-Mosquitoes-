# Stripe Backend Initialization Report
**Date:** 2026-06-03

---

## server/lib/stripeMode.ts — `assertStripeKeyNotTestInProduction()`

**BEFORE FIX (threw exception):**
```typescript
export function assertStripeKeyNotTestInProduction(): void {
  if (process.env.NODE_ENV === "production" && key.startsWith("sk_test_")) {
    throw new Error("[FATAL] Stripe test key used in production...");
  }
}
```

**AFTER FIX (warns only):**
```typescript
export function assertStripeKeyNotTestInProduction(): void {
  if (process.env.NODE_ENV === "production" && key.startsWith("sk_test_")) {
    console.error("[Stripe] WARNING: test key in production context...");
    // No throw — allows staging/testing deployments on Netlify to function normally.
  }
}
```

---

## server/index.ts — createServer() Startup Call

```typescript
export function createServer() {
  // Guard: hard-fail before any route is registered if a test key is used in production.
  assertStripeKeyNotTestInProduction();  // ← added today; now a warn-only
  const app = express();
  ...
}
```

**Before today:** `assertStripeKeyNotTestInProduction()` was exported but NEVER called at startup.
**After today (before fix):** Called at startup, THROWS if test key + NODE_ENV=production.
**After fix:** Called at startup, WARNS if test key + NODE_ENV=production.

---

## server/routes/billingStripe.ts — Key Resolution

```typescript
function getSecret() {
  const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || process.env.STRIPE_SECRET;
  ...
  return key;
}
```

**Unchanged logic.** Fallback chain preserved: `STRIPE_SECRET_KEY` → `STRIPE_API_KEY` → `STRIPE_SECRET`.

**Timeout change:** `stripeFetch` timeout was 8000ms, changed to 6000ms by today's sprints. This is safe — Netlify functions have a 10s limit, 6s leaves more buffer.

---

## server/routes/webhooksStripe.ts — Stripe Client Init

```typescript
const getStripeClient = () => {
  const apiKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || process.env.STRIPE_SECRET;
  if (!apiKey) return null;
  return new Stripe(apiKey, { apiVersion: "2023-10-16" as any });
};
```

**Unchanged.** Returns null if no key — webhook returns 500 (safe, already handled).

---

## Production Guard — Was It the Right Design?

The intent was correct (prevent test keys in production), but the implementation was too aggressive:

| Issue | Detail |
|-------|--------|
| Netlify always sets `NODE_ENV=production` | Even for staging/testing/preview deploys |
| Test keys are legitimate in staging | You need to test Stripe flows before going live |
| Throwing at startup kills ALL routes | Unrelated routes (health, parcel, admin) also fail |
| Better enforcement point | At the moment of actual payment intent creation, not startup |

**Alternative approach (future):** Warn at startup, throw specifically in `create-payment-intent` if the Stripe account has live products but test keys are used.

---

## Summary

| File | Issue | Fixed? |
|------|-------|--------|
| `server/lib/stripeMode.ts` | Throw → crash | ✅ Changed to warn |
| `server/index.ts` | Calls fatal guard at startup | ✅ Guard is now non-fatal |
| `server/routes/billingStripe.ts` | None | N/A |
| `server/routes/webhooksStripe.ts` | None | N/A |
| `server/routes/adminStripe.ts` | None | N/A |
