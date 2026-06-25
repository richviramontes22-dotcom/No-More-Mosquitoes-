# Webhook Flow Report
**Date:** 2026-06-03
**Verification method:** Stripe CLI live test

---

## Actual Webhook Route

**`POST /api/webhooks/stripe`**

This is definitively confirmed — NOT `/api/webhooks` (the router prefix) and NOT `/webhook` or `/stripe/webhook`.

---

## Request Path (Production Netlify)

```
Customer payment → Stripe
  → Stripe fires webhook to: https://nomoremosquitoes.us/api/webhooks/stripe
  → Netlify redirect (netlify.toml): /api/* → /.netlify/functions/api/:splat
  → Netlify function: /.netlify/functions/api/webhooks/stripe
  → serverless-http: routes to Express at path /api/webhooks/stripe
  → Express: app.use("/api/webhooks", express.raw(), stripeWebhooks)
  → Router: router.post("/stripe", handler)
```

---

## Raw Body Preservation

**`server/index.ts` line 57:**
```typescript
app.use("/api/webhooks", express.raw({ type: "application/json" }), stripeWebhooks);
```

This middleware runs BEFORE `express.json()` on line 59. The raw body is preserved as a `Buffer` for the webhook route, which is required for Stripe signature verification.

The webhook handler also has a fallback (lines 57-63 in webhooksStripe.ts):
```typescript
if (Buffer.isBuffer(req.body)) {
  rawBody = req.body;
} else if (typeof req.body === "string") {
  rawBody = req.body;
} else {
  rawBody = JSON.stringify(req.body);  // ⚠ This path would fail signature verification
}
```

The third branch (JSON stringify fallback) would break signature verification if ever reached. In normal operation with `express.raw()`, req.body is always a Buffer and this branch is never hit.

---

## Signature Verification

**`server/routes/webhooksStripe.ts` lines 67-91:**
```typescript
event = stripe.webhooks.constructEvent(
  rawBody,
  signature as string,
  webhookSecret
);
```

Uses the official Stripe SDK `constructEvent()` — correct implementation.

On failure: logs error + fires admin critical alert + returns 400. **✅ Correct**

---

## Event Handlers

All handled via `switch (type)` on line 102.

**Verified working (Stripe CLI live test results):**

| Event | CLI Status | HTTP Response |
|-------|-----------|--------------|
| `payment_intent.succeeded` | ✅ TRIGGERED | 200 |
| `charge.succeeded` | ✅ TRIGGERED | 200 |
| `charge.updated` | ✅ TRIGGERED | 200 |
| `payment_intent.created` | ✅ TRIGGERED | 200 |
| `checkout.session.completed` | ✅ TRIGGERED | 200 |
| `invoice.paid` | ✅ TRIGGERED | 200 |
| `customer.subscription.updated` | ✅ TRIGGERED | 200 |

**Zero 500s, zero 400s after STRIPE_WEBHOOK_SECRET was set.**

---

## Database Update Tracing

When `checkout.session.completed` fires:
1. Reads `session.metadata.user_id`, `property_id`, `purchase_type`
2. If `purchase_type === "marketplace"` → upserts `marketplace_orders`
3. Otherwise → creates subscription via `createSubscriptionServiceOrder()`

When `invoice.paid` fires:
1. Finds subscription by `stripe_subscription_id`
2. Sets `status = "active"`, updates `last_payment_at`
3. Sends `subscription_renewed` notification if not first payment

When `customer.subscription.deleted` fires:
1. Updates subscription status → `canceled`
2. Sends `subscription_canceled` notification

---

## Error Handling

- Missing stripe client/secret → 500 + error logged
- Missing signature header → 400
- Signature verification fail → 400 + admin critical alert fired
- Unknown event type → falls through switch, no-op + logged
- DB error in handlers → logged, still returns 200 (prevents Stripe retry storms)

---

## What Was Wrong (Root Cause)

`STRIPE_WEBHOOK_SECRET` was not set in the local `.env` file. The webhook route itself was always correct. The 500 responses were caused by this missing variable only.

**Evidence:** When the variable was added, all events immediately returned 200.
