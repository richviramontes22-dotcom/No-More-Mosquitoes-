# Checkpoint System Report
**Date:** 2026-06-02
**File:** `server/lib/checkpoint.ts`

---

## Naming Convention

`<domain>.<noun>.<verb_or_state>`

Examples:
- `billing.payment.verified`
- `parcel.county.lookup.start`
- `route.publish.blocked`
- `reminder.batch.complete`

All canonical names are in the `CP` constants object to prevent typos.

---

## Checkpoint Function

```typescript
checkpoint(requestId: string, name: string, meta?: Record<string, unknown>): void
```

- When `ENABLE_VERBOSE_CHECKPOINTS=false` (default): logs at `debug` level — suppressed in production
- When `ENABLE_VERBOSE_CHECKPOINTS=true`: logs at `info` level — visible in production log stream

The `meta` parameter accepts any non-sensitive context (user IDs, counts, dates, statuses). Never pass secrets, tokens, or PII beyond user IDs.

---

## Implemented Checkpoint Flows

### Billing / Booking (`billingStripe.ts`)
| Checkpoint | When |
|-----------|------|
| `billing.start` | Route handler entry |
| `billing.payment.verified` | PaymentIntent confirmed as `succeeded` |
| `billing.appointment.created` | First appointment inserted |
| `billing.profile.onboarded` | Profile `is_onboarded = true` |
| `billing.complete` | Full flow succeeded |

### Reminder Automation (`reminderScheduler.ts`)
| Checkpoint | When |
|-----------|------|
| `reminder.batch.start` | `runReminderBatch()` called |
| `reminder.appointments.found` | Query returned N appointments |
| `reminder.duplicate.skipped` | Per-appointment skip (dry-run or disabled) |
| `reminder.batch.complete` | Full batch finished |

### Route Publish (`adminRoutes.ts`)
| Checkpoint | When |
|-----------|------|
| `route.publish.validation.start` | Validation gate entered |
| `route.publish.blocked` | Validation returned critical blockers |
| `route.publish.success` | (future — not yet wired to single publish) |

---

## Defined But Deferred (not yet wired)

These are in `CP` constants, ready to be wired in future sprints:
- Full parcel lookup flow (`parcel.*`)
- Onboarding form flow (`onboarding.*`)
- Route day generate flow (`route.day.generate.*`)

---

## Deferred: DB Persistence

Currently checkpoints are pure log events (stdout JSON). To persist checkpoints to the database for the admin debug panel:

1. Create `checkpoint_log` table: `(id, request_id, name, metadata, created_at)`
2. Enable: set `ENABLE_VERBOSE_CHECKPOINTS=true`
3. Change `checkpoint()` to insert to DB in addition to logging

This is deferred because: (1) stdout logs are already captured by Netlify, (2) DB writes per request add latency, (3) log volume in production needs validation before persisting everything.

---

## Log Format (current)

```json
{
  "ts": "2026-06-02T10:23:45.000Z",
  "level": "debug",
  "event": "checkpoint:billing.payment.verified",
  "requestId": "a1b2c3d4-1234-...",
  "checkpoint": "billing.payment.verified",
  "userId": "user-uuid"
}
```
