# Stripe Configuration Audit
**Date:** 2026-06-03
**Method:** Direct source code inspection — no assumptions

---

## Stripe Secret Key

**Used by:** `server/routes/billingStripe.ts`, `server/routes/webhooksStripe.ts`, `server/routes/adminStripe.ts`, `server/lib/stripeMode.ts`

**Exact code pattern (from `billingStripe.ts` line 89):**
```typescript
const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || process.env.STRIPE_SECRET;
```

**Fallback chain:** `STRIPE_SECRET_KEY` → `STRIPE_API_KEY` → `STRIPE_SECRET`

**Local .env value:** `sk_test_51T8zHI0zUTKY2M9t...` (test key — correct for local dev)
**Live key location in .env:** `LIVE_STRIPE_SECRET_KEY=sk_live_51T8zGo1GVLFt2OB8...` (wrong variable name)
**Action required for production:** Set `STRIPE_SECRET_KEY=sk_live_...` in Netlify (copy from `LIVE_STRIPE_SECRET_KEY`)

---

## Stripe Publishable Key (Client)

**File:** `client/lib/stripe.ts` line 5
```typescript
export const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");
```

**Local .env:** `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51T8zHI0z...` (test key)
**Live key in .env:** `LIVE_VITE_STRIPE_PUBLISHABLE_KEY=pk_live_51T8zGo1GVLFt2OB8...`
**Action:** Set `VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...` in Netlify

---

## Webhook Secret

**File:** `server/routes/webhooksStripe.ts` line 40
```typescript
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
```

**Local .env before this sprint:** NOT SET → 500 on all events
**Local .env after this sprint:** SET to CLI test secret `whsec_2fa6635f...`
**Webhook verified:** ✅ All events return HTTP 200 (verified with Stripe CLI)

---

## Webhook Route Registration

**File:** `server/index.ts` line 57
```typescript
app.use("/api/webhooks", express.raw({ type: "application/json" }), stripeWebhooks);
```

**Router handler:** `webhooksStripe.ts` line 39
```typescript
router.post("/stripe", async (req: Request, res: Response) => {
```

**Full webhook path:** `POST /api/webhooks/stripe` ✅ CONFIRMED WORKING

---

## Stripe SDK Initialization (webhooksStripe.ts)

```typescript
const getStripeClient = () => {
  const apiKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || process.env.STRIPE_SECRET;
  if (!apiKey) return null;
  return new Stripe(apiKey, { apiVersion: "2023-10-16" as any });
};
```

**Version pinned:** `2023-10-16` — ensures `invoice.payment_intent` returns consistently.

---

## Events Handled (webhooksStripe.ts switch statement)

| Event | Handler | DB Update |
|-------|---------|-----------|
| `checkout.session.completed` | ✅ | marketplace_orders or subscription |
| `invoice.paid` | ✅ | subscriptions.status → active |
| `invoice.payment_failed` | ✅ | notification sent |
| `customer.subscription.deleted` | ✅ | subscriptions.status → canceled |
| `customer.subscription.updated` | ✅ | subscriptions updated |
| `payment_intent.succeeded` | ✅ | payments table |
| `checkout.session.expired` | ✅ | no-op, logged |
| `payment_intent.payment_failed` | ✅ | notification |
| `charge.refunded` | ✅ | refund logged |

---

## confirm-booking Flow

**File:** `server/routes/billingStripe.ts` route `POST /billing/confirm-booking`

Flow:
1. Extract `paymentIntentId` from request body
2. Call `stripeFetch("/payment_intents/{id}")` to verify status
3. If `status === "succeeded"` → create subscription row, appointment, service preferences, mark profile onboarded
4. Returns `{ ok: true, requestId, success: true }`

**Idempotency:** Appointment creation deduped by `(user_id, property_id, scheduled_date)` — safe to retry.

---

## Production/Test Mismatch Guard

**File:** `server/lib/stripeMode.ts` — `assertStripeKeyNotTestInProduction()`
```typescript
if (process.env.NODE_ENV === "production" && key.startsWith("sk_test_")) {
  throw new Error("[FATAL] Stripe test key used in production...");
}
```

This guard fires at server startup and will prevent the Netlify function from starting if a test key is used in production. **This is correct behavior.**

---

## Summary

| Check | Status |
|-------|--------|
| Secret key present (local) | ✅ `sk_test_...` |
| Secret key present (production Netlify) | ⚠ Must set `sk_live_...` |
| Publishable key present (local) | ✅ `pk_test_...` |
| Publishable key present (production) | ⚠ Must set `pk_live_...` |
| Webhook secret (local) | ✅ CLI secret set |
| Webhook secret (production Netlify) | ⚠ Must set Dashboard signing secret |
| Webhook route correct | ✅ `/api/webhooks/stripe` |
| Webhook events handled | ✅ All 9 events |
| Raw body preserved for signature verification | ✅ `express.raw()` on `/api/webhooks` |
| Stripe CLI live test | ✅ All events 200 |
