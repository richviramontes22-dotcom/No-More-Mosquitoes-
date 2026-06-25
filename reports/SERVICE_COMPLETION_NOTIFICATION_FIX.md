# SERVICE COMPLETION NOTIFICATION FIX
## Generated: 2026-05-29
## Phase 8 of the Final Operational Integrity Sprint

---

## Problem Confirmed

**Audit Reference:** CASCADE_RULE_AUDIT.md Event 1 (gap), BUSINESS_STATE_MACHINE_AUDIT.md Section 7

In `server/routes/employeeAssignments.ts`, the completion notification block logged to `notification_log` with:

```typescript
notification_type: "appointment_confirmation"
```

**Two problems with this:**

1. **Wrong semantics:** The type `"appointment_confirmation"` represents the booking confirmation sent to the customer when they first schedule an appointment. Using it for a service completion notification is semantically incorrect.

2. **Unique index collision:** The `notification_log` table has a deduplication index (from `2026-05-16_phase2_notification_infrastructure.sql`):
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS notification_log_dedup_idx
     ON public.notification_log (appointment_id, notification_type)
     WHERE status = 'sent' AND appointment_id IS NOT NULL;
   ```
   When a booking confirmation is sent (type: `appointment_confirmation`, status: `sent`), this index row is created. If the job is later completed and the handler tries to insert another row with the same `(appointment_id, notification_type)` pair, the insert **silently fails** due to the unique index violation — caught by `.catch(() => {})`. The completion notification log is never recorded.

---

## Fix Implemented

### Code Fix

**File modified:** `server/routes/employeeAssignments.ts`

Changed:
```typescript
notification_type: "appointment_confirmation",
```
To:
```typescript
notification_type: "service_completed",
```

### Migration Fix

**File created:** `db/migrations/2026-05-29_notification_type_service_completed.sql`

The `notification_log.notification_type` column has a CHECK constraint that only allows specific values. `"service_completed"` was not in the original list. The migration:

1. Drops the existing CHECK constraint.
2. Recreates it with `"service_completed"` added, plus other notification types used in current code.

**Note:** Even before the migration runs, the code fix is safe — the `.catch(() => {})` guard means a CHECK constraint failure is silently swallowed. The migration makes the insert actually succeed.

---

## Updated notification_type CHECK Constraint Values

After migration:
- `appointment_confirmation` — booking confirmation to customer
- `reminder_24h` — 24-hour reminder
- `reminder_same_day` — same-day reminder
- `appointment_canceled` — cancellation notification
- `appointment_rescheduled` — reschedule notification
- `technician_enroute` — en-route SMS
- `service_completed` — NEW: completion notification to customer
- `appointment_canceled_employee` — NEW: employee cancellation notice
- `appointment_canceled_customer` — NEW: customer-initiated cancel notice
- `scheduling_failure` — NEW: scheduling failure alert
- `payment_failed` — NEW: payment failure notice
- `subscription_canceled` — NEW: subscription cancellation notice
- `logged` — NEW: internal log entry

---

## Migration Required

YES — must be run in Supabase SQL Editor.

File: `db/migrations/2026-05-29_notification_type_service_completed.sql`

---

## Verification

After fix is deployed and a job is completed:
```sql
SELECT appointment_id, notification_type, status, created_at
FROM public.notification_log
WHERE notification_type = 'service_completed'
ORDER BY created_at DESC
LIMIT 10;
```

---

## Rollback

1. Revert `notification_type: "service_completed"` back to `"appointment_confirmation"` in `employeeAssignments.ts`.
2. Re-run the constraint migration with the original set of values.
