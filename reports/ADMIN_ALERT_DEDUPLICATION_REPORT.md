# Admin Alert Deduplication Report

**Date:** 2026-05-30  
**Status:** IMPLEMENTED

## Deduplication Logic

Located in `adminNotificationService.ts → isDuplicateAlert()`.

### Algorithm

```
1. Compute cutoff = NOW() - dedupWindowMinutes
2. Query admin_alerts WHERE:
   - event_type = event.event_type
   - entity_type = event.entity_type (if provided)
   - entity_id = event.entity_id (if provided)
   - resolved_at IS NULL
   - created_at >= cutoff
3. If count > 0: skip (log, return)
4. Else: proceed with email/SMS/DB insert
```

### Dedup Windows by Severity

| Severity | Window |
|---------|--------|
| info | 60 minutes |
| warning | 60 minutes |
| critical | 15 minutes (more aggressive retry) |

### Why 15 minutes for critical?

Critical alerts (like payment failures) may genuinely re-fire if Stripe retries the webhook. A 15-minute window prevents SMS flooding while still allowing re-alert if the issue persists past a quarter hour.

## Deduplication Key Components

| Component | Example |
|-----------|---------|
| `event_type` | `billing.payment_failed` |
| `entity_type` | `subscription` |
| `entity_id` | `sub_1abc...` (Stripe sub ID) |

All three must match for deduplication. If `entity_id` is omitted, dedup is looser (just event_type + entity_type within time window).

## DB Index

```sql
CREATE INDEX IF NOT EXISTS admin_alerts_dedup_idx
  ON public.admin_alerts (event_type, entity_type, entity_id)
  WHERE resolved_at IS NULL;
```

This partial index makes the dedup query fast even with thousands of historical alerts, since only unresolved alerts are in the index.

## Fail-Open Behavior

If the dedup query itself fails (DB error), `isDuplicateAlert()` returns `false` — allowing the alert to go through. This prevents DB errors from silently swallowing critical notifications.
