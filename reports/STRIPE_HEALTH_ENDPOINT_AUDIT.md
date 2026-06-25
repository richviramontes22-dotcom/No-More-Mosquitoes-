# Stripe Health Endpoint Audit
**Date:** 2026-06-03

---

## `GET /api/health/stripe` (new endpoint added today)

**File:** `server/routes/health.ts`

```typescript
router.get("/health/stripe", (req: any, res) => {
  const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || process.env.STRIPE_SECRET;
  const mode = getStripeMode();
  const webhookConfigured = !!process.env.STRIPE_WEBHOOK_SECRET;
  res.json({
    ok: !!key,
    configured: !!key,
    mode,                        // "test" | "live" | "unknown"
    webhookConfigured,
    publishableKeyConfigured: !!process.env.VITE_STRIPE_PUBLISHABLE_KEY,
    requestId: req.requestId,
  });
});
```

**Makes real Stripe API calls?** NO — only checks env var presence and key prefix.
**Can produce "cannot validate" error?** NO.
**False positive risk?** YES — `mode: "test"` with live keys expected can alarm users, but this is a display issue, not a crash.

**Local result:** `{"ok":true,"configured":true,"mode":"test","webhookConfigured":true,"publishableKeyConfigured":true,...}`

---

## `GET /api/admin/debug/system-status`

**File:** `server/routes/adminDebug.ts`

Uses `getStripeDiagnostics()` which only checks env var presence and key prefix. Does NOT make real Stripe API calls. Reports `mode_mismatch: true` if `NODE_ENV=production` AND test key.

**Can produce "cannot validate" error?** NO. Shows warning text if mismatch detected.

---

## `GET /api/admin/stripe/status`

**File:** `server/routes/adminStripe.ts`

Makes **REAL Stripe API calls** to `/account` and `/balance`. Called by admin Billing and Revenue pages.

```typescript
const [account, balance] = await Promise.all([
  stripeFetch("/account"),
  stripeFetch("/balance"),
]);
```

**Can produce "cannot validate" error?** YES if Stripe returns an API error. But this would return Stripe's own error messages (e.g., "No such account"), not "cannot validate Stripe API keys."

**When does this fail?**
- When the server function crashes at startup (due to `assertStripeKeyNotTestInProduction()` throw) — then ALL routes including this one return 502/500.

---

## Summary of Health Endpoint False Positive Risk

| Endpoint | Real API Call | Can Say "Cannot Validate"? | Risk |
|----------|-------------|--------------------------|------|
| `/api/health/stripe` | NO | NO | Low — shows mode only |
| `/api/admin/debug/system-status` | NO | NO | Low — shows mismatch warning |
| `/api/admin/stripe/status` | YES | Indirect (via API error) | Medium — only shown in admin |

The "cannot validate Stripe API keys" error that users/admins see is from the **frontend Stripe.js SDK**, triggered when `stripePromise` resolves to null (empty publishable key) or when the API routes fail and the payment flow can't obtain a clientSecret.
