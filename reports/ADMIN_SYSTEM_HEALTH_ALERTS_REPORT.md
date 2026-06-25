# Admin System Health Alerts Report

**Date:** 2026-05-30  
**Status:** FOUNDATION ONLY — hooks not yet wired

## Current System Health Visibility

The `admin_alerts` table and `notifyAdmin()` service are ready to accept system health events. Hooks have not been wired yet because the primary focus was on business-critical events (billing, scheduling, field ops).

## Recommended System Health Hooks

| Event | event_type | Severity | Where to hook |
|-------|-----------|---------|--------------|
| Stripe webhook verification failed | `system.webhook_signature_failure` | critical | `webhooksStripe.ts` catch block |
| SMS webhook inbound error | `system.sms_webhook_error` | warning | `webhooks.sms.ts` |
| Email delivery failed (Resend) | `system.email_delivery_failure` | warning | `providers/index.ts` |
| Supabase DB write failed | `system.db_write_failure` | warning | Key write paths |
| Annual reminder function error | `system.reminder_function_error` | warning | `send-annual-warnings.ts` |

## Implementation Pattern

```typescript
// In any error path:
import { notifyAdminCritical } from "../services/notifications/adminNotificationService";

// Example: Stripe webhook signature failure
} catch (err: any) {
  notifyAdminCritical("system.webhook_signature_failure",
    "Stripe webhook signature verification failed",
    { body: err.message, metadata: { ip: req.ip } }
  );
  return res.status(400).json({ error: err.message });
}
```

## Current Monitoring

Without dedicated system health hooks, the operator should:
1. Monitor Netlify function logs for errors
2. Monitor Stripe Dashboard for webhook failures
3. Monitor Supabase logs for RLS violations
