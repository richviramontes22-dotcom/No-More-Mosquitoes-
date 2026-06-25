# Admin System Health Alerts — Phase 2 Report
**Date:** 2026-05-30
**Phase:** 6 — Admin System Health Alerts

## Summary
Webhook signature failure alert wired. Provider error alerting uses safe console-only approach to avoid recursion.

## Events Implemented

### 1. `system.webhook_signature_failure` (critical)
**File:** `server/routes/webhooksStripe.ts`
**Trigger:** `stripe.webhooks.constructEvent()` throws — signature verification failure
**Implementation:**
```typescript
try {
  notifyAdminCritical("system.webhook_signature_failure", "Stripe webhook signature verification failed", {
    body: `Error: ${err.message}`,
    entity_type: "webhook",
    metadata: { error: err.message, timestamp: ... },
  });
} catch (alertErr) {
  console.error("[Stripe Webhook] Failed to send admin alert...", alertErr.message);
}
```
- Wrapped in try/catch to prevent alert failure from masking the original error
- Uses `notifyAdminCritical` for immediate SMS + email notification
- 15-minute dedup window (critical severity)

## Provider Error Alerting — Approach Chosen

The mission brief offered two approaches:
1. Module-level boolean flag to prevent recursion
2. **Catch provider errors in adminNotificationService and log to console only (simpler)**

**Approach 2 selected.** The `adminNotificationService.ts` already implements this correctly:

```typescript
async function sendAdminEmail(event, emails): Promise<boolean> {
  ...
  try {
    await provider.send({ to, from, subject, html });
  } catch (err: any) {
    console.error(`[AdminAlert] Email to ${to} failed:`, err.message);
    ok = false;
  }
  return ok;
}
```

Provider errors in the admin notification path are caught and logged to console. They are NOT re-notified through another notification cycle. This is inherently recursion-safe.

**Why not Approach 1:** The boolean flag approach would require module-level shared state and is harder to reason about in a Netlify serverless context where each function invocation may be a fresh process. The simple catch-and-log is more robust.

## Files Modified

| File | Change |
|------|--------|
| `server/routes/webhooksStripe.ts` | Added `notifyAdminCritical` call in signature failure catch block |

## Already Safe (No Change Needed)
- `server/services/notifications/adminNotificationService.ts` — already uses catch-and-log for provider errors
- `server/services/notifications/providers/index.ts` — NullProviders log intent without throwing; real providers throw on failure but adminNotificationService catches them
