# PAYMENT SYSTEM REVIEW
## No More Mosquitoes — Stripe Integration Security Audit
## Date: 2026-05-28
## Files Reviewed:
##   server/routes/billingStripe.ts
##   server/routes/webhooksStripe.ts
##   server/routes/adminStripe.ts
##   server/lib/stripeMode.ts
##   client/pages/dashboard/Billing.tsx

---

## Q1: Can a Production User Ever See Test Card Data (4242, 5555, etc.)?

**Answer: Previously yes, now only in edge cases.**

### What Was Fixed (Sprint 3B)
The Billing page previously defaulted payment method display to:
```typescript
cardLast4: "4242", cardBrand: "Visa", cardExpiry: "12/2026"
```
when `profile.card_last4` was null. This has been removed. Current code (`client/pages/dashboard/Billing.tsx` lines 94–98):
```typescript
const [paymentMethod, setPaymentMethod] = useState<{
  cardLast4: string | null; cardBrand: string | null; cardExpiry: string | null
}>({
  cardLast4: profile?.card_last4 ?? null,
  cardBrand:  profile?.card_brand  ?? null,
  cardExpiry: profile?.card_expiry ?? null,
});
```
Defaults to `null`. Displays "No payment method on file" when null.

### Remaining Issue

`server/routes/billingStripe.ts` — `POST /api/billing/create-and-attach-payment-method` endpoint (lines 1012–1055):

```typescript
const cardDetails: Record<string, { brand: string; last4: string; expiry: string }> = {
  tok_visa:        { brand: "Visa",              last4: "4242", expiry: "12/26" },
  tok_mastercard:  { brand: "Mastercard",        last4: "4444", expiry: "12/26" },
  tok_amex:        { brand: "American Express",  last4: "0005", expiry: "12/26" },
};
```

This endpoint uses Stripe test tokens (`tok_visa`, `tok_mastercard`, etc.) and maps them to fake card data. **If this endpoint is called in a production environment**, it would attach a test source to a live Stripe customer and write `last4: "4242"` to the profile. 

**Is this endpoint callable from the frontend?** No — searching the codebase shows no frontend calls to `/api/billing/create-and-attach-payment-method`. The primary payment method endpoint is `/api/billing/attach-payment-method` (production path). However, the test endpoint remains in the production bundle and could be called directly.

**Risk level: Low** — not reachable from the UI, but the route is registered and accessible via direct HTTP call in production.

---

## Q2: Is There Any Hardcoded Payment Method Data Remaining?

### Removed
- Billing page default `"4242"` display — removed (Sprint 3B).
- `handlePaymentMethodSuccess` Mastercard 5555 injection — removed (Sprint 3B).

### Remaining
1. `server/routes/billingStripe.ts` lines 1019–1023: `tok_visa → 4242`, `tok_mastercard → 4444` in `create-and-attach-payment-method` endpoint. **Only accessible via direct API call, not UI.**
2. `server/routes/regrid.ts` line 49: Hardcoded bypass for test address (Caminito Escobedo): `return res.json({ acreage: 0.07, sqft: 3049 })`. This is a development shortcut that remains in production. If a customer has an address containing "caminito escobedo", the parcel lookup silently returns test data instead of calling Regrid. **Negligible risk in production — this is a very specific address match.**

---

## Q3: Is Stripe Test Mode vs Live Mode Properly Gated?

**Answer: Warning-only — not blocked.**

`server/routes/billingStripe.ts` — `getSecret()` function (lines 84–104):

```typescript
const isProd = process.env.NODE_ENV === "production";
if (isProd && isTestKey) {
  console.warn("[Billing] WARNING: STRIPE_SECRET_KEY is a TEST key but NODE_ENV=production...");
}
if (!isProd && isLiveKey) {
  console.warn("[Billing] WARNING: STRIPE_SECRET_KEY is a LIVE key but NODE_ENV is not production...");
}
return key; // Always returns the key regardless of mismatch
```

The mismatch is logged to the server console (Netlify function logs) but **does not block the request**. A mismatched key will cause downstream failures when Stripe API calls fail with "No such price" or "No such customer" errors, but the server will still attempt the request.

**The `findStripePriceAsync()` function partially mitigates this** by selecting the appropriate price ID based on mode (`stripePriceId` for live, `stripePriceIdTest` for test), but if the `service_plans` DB table has incorrect price IDs or the fallback `STRIPE_PLANS` array is used, mode-mismatched prices may be sent to Stripe.

**There is a fallback:** If Stripe returns "No such price," `billingStripe.ts` retries with `price_data` (inline price) instead of a price ID. This partially saves the checkout flow but does not solve the fundamental mismatch problem.

---

## Q4: Does `stripeMode.ts` Correctly Switch Between Test and Live Keys?

**Answer: Yes — correctly determines mode, but only provides advisory functions.**

`server/lib/stripeMode.ts`:

```typescript
export function getStripeMode(): StripeMode {
  const key = process.env.STRIPE_SECRET_KEY || ...;
  if (key.startsWith('sk_live_')) return 'live';
  if (key.startsWith('sk_test_')) return 'test';
  return 'unknown';
}
```

The mode detection is correct. `isTestMode()` and `isLiveMode()` are boolean helpers.

`getStripeDiagnostics()` exposes mode information to the admin Stripe status endpoint (`/api/admin/stripe/status`). It correctly flags `mode_mismatch: true` when `NODE_ENV=production` but test key is configured.

**What `stripeMode.ts` does NOT do:**
- Does not block mismatched requests.
- Does not swap keys automatically.
- Is purely diagnostic/advisory.

`findStripePriceAsync()` in `server/lib/stripe-prices.ts` calls `getStripeMode()` to select the correct price ID from the dual-mode `STRIPE_PLANS` array. This is the one place where mode actively controls behavior.

---

## Q5: Does the Checkout Flow Verify Payment Server-Side Before Marking Success?

**Answer: YES — implemented correctly.**

`server/routes/billingStripe.ts` — `POST /api/billing/confirm-booking` (lines 646–648):

```typescript
const pi = await stripeFetch(`/payment_intents/${paymentIntentId}`);
if ((pi as any).status !== "succeeded") {
  return res.status(402).json({ error: "Payment has not been confirmed yet", piStatus: pi.status });
}
```

The server calls Stripe's API directly with the server-side Stripe key to verify the PaymentIntent status. No DB writes occur before this check passes. **The client cannot fake a "succeeded" status** because the server independently verifies it from Stripe.

**Subscription renewals:** Verified server-side by `invoice.paid` webhook, which only fires from Stripe after actual payment collection.

**Marketplace purchases:** Verified by `payment_intent.succeeded` webhook. Pre-created orders remain in `status: "pending"` until the webhook confirms payment. Client cannot advance the order status.

---

## Q6: Are Webhook Events Validated (Signature Verification)?

**Answer: YES — correctly implemented.**

`server/routes/webhooksStripe.ts` (lines 29–68):

```typescript
const stripe = new Stripe(apiKey, { apiVersion: "2023-10-16" });
const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
```

Signature verification uses the official Stripe Node.js library. Raw body is required and handled:
```typescript
if (Buffer.isBuffer(req.body)) rawBody = req.body;
else if (typeof req.body === "string") rawBody = req.body;
else rawBody = JSON.stringify(req.body);
```

**Concern:** The fallback `JSON.stringify(req.body)` branch runs when the body has already been JSON-parsed. Re-serializing JSON is byte-order sensitive and may fail signature verification for some Stripe events. This path would be taken if the Express middleware parses the body before it reaches the webhook route.

**Best practice check:** Stripe recommends using `express.raw()` middleware specifically for the webhook route, not `express.json()`. Whether this is correctly configured depends on the Express middleware setup in `server/index.ts`.

**Response on failure:** Returns 400 with error — Stripe will retry the webhook.

---

## Q7: Is There Any Client-Trust of Payment Success Without Server Verification?

**Answer: NO for core flows. Minor concern in payment method update.**

### Checkout (Subscription/Annual/One-Time)
The frontend calls `stripe.confirmPayment()` and on success calls `POST /api/billing/confirm-booking`. The server verifies the PI status with Stripe before doing anything. **No client trust.**

### Marketplace Checkout
The frontend shows a success screen after `stripe.confirmPayment()` succeeds. The actual order status update happens via webhook. The frontend success screen is a UX optimization — the real state change is server-side via webhook. If the webhook fails, the order state is not updated, but the customer will see a "success" screen. **Low risk because the order is pre-created with `status: "pending"` and the frontend success screen doesn't update DB state.**

### Payment Method Update
`POST /api/billing/attach-payment-method` attaches the PM in Stripe and returns `{ success: true }`. The server does NOT write updated card info to `profiles`. The frontend currently shows "No payment method on file" even after a successful update (because `profiles.card_last4` is never written). No client-side fake data is injected post-update (Sprint 3B fix). **No trust issue — just a UX gap.**

### Create-and-Attach (Test Only)
`POST /api/billing/create-and-attach-payment-method` returns a `cardInfo` object with test card details. This is trust — the server returns hardcoded card display data based on which test token was sent. **This endpoint should either be removed from production or gated behind NODE_ENV !== "production".**

---

## Summary Table

| Security Question | Status | Severity |
|-------------------|--------|----------|
| Test card data visible to production users | RESOLVED (Sprint 3B) — null display shown | Low |
| Hardcoded 4242 in test endpoint (not UI-accessible) | PRESENT | Low |
| Stripe mode/key mismatch blocked | NOT BLOCKED (warning only) | Medium |
| Checkout server-side verification | CORRECT | Pass |
| Webhook signature verification | CORRECT (minor raw body concern) | Low |
| Client trust of payment success | NO client trust in core flows | Pass |
| Test endpoint in production bundle | PRESENT (`create-and-attach-payment-method`) | Low |

---

## Recommended Fixes

### Immediate (before launch)
1. **Gate test endpoint** — add `if (process.env.NODE_ENV === 'production') return res.status(404).json({ error: "Not available" })` to `create-and-attach-payment-method` endpoint.
2. **Verify Express raw body middleware** — ensure `server/index.ts` applies `express.raw({ type: 'application/json' })` to the webhook route specifically, not `express.json()`.

### Short Term
3. **Write `card_last4` to profiles on payment success** — in the `invoice.paid` webhook or in `attach-payment-method` endpoint, call Stripe to retrieve the payment method details and write `card_last4`, `card_brand`, `card_expiry` to `profiles`. This closes the "No payment method on file" UX gap.
4. **Block on mode mismatch** — add a hard fail in `getSecret()` when `NODE_ENV === "production"` and key is a test key: `throw new Error("Production environment requires a live Stripe key.")`.
