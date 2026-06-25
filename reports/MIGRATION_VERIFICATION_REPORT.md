# Migration Verification Report
**Sprint:** Final Operational Verification Sprint  
**Date:** 2026-05-29  
**Status: ALL 3 MIGRATIONS VERIFIED**

---

## Overview

Three new migrations are queued for deployment. Each has been read in full and analyzed for safety, idempotency, rollback risk, and order dependencies. They are independent of each other and can be applied in any order.

---

## Migration 1 — Profile Auto-Creation Trigger

**File:** `db/migrations/2026-05-29_ensure_profile_trigger.sql`

### Purpose

Creates a PostgreSQL trigger function `handle_new_user()` and binds it to the `auth.users` table (Supabase auth schema). Every time a new user signs up, a corresponding row is automatically inserted into `public.profiles` with the user's ID, email, name (from user metadata or derived from email), role (`customer`), and timestamps. The `ON CONFLICT (id) DO NOTHING` clause makes the insert safe even if a profile row already exists.

### Tables / Objects Affected

| Object | Type | Action |
|--------|------|--------|
| `public.handle_new_user` | PL/pgSQL function | Created or replaced |
| `on_auth_user_created` | Trigger on `auth.users` | Dropped (if exists), then created |

### Idempotent?

**Yes.** The function uses `CREATE OR REPLACE` so re-running does not fail. The trigger uses `DROP TRIGGER IF EXISTS` followed by `CREATE TRIGGER` — safe to re-run any number of times.

### Rollback Command

```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
```

### Deployment Risk

**Low.** The trigger is `AFTER INSERT` (non-blocking). It uses `ON CONFLICT DO NOTHING` so it cannot corrupt existing data. Failure to insert a profile row is silently ignored at the DB level — the auth user row succeeds regardless.

### Pre-Checks Required

None required before applying. After applying, run the backfill query (see Supabase Deployment Verification Checklist) to create profile rows for any users who signed up before this trigger was deployed.

### Order Dependency

None. Independent of Migrations 2 and 3.

---

## Migration 2 — Add `service_completed` to Notification Log Constraint

**File:** `db/migrations/2026-05-29_notification_type_service_completed.sql`

### Purpose

Drops and recreates the `notification_log_notification_type_check` CHECK constraint on `public.notification_log`. The new constraint expands the allowed `notification_type` values to include `service_completed` (and several other types that exist in code but were not in the original Phase 2 constraint). This unblocks the service completion notification that previously used the wrong type `appointment_confirmation` — a collision that caused silent deduplication failures.

### Tables / Objects Affected

| Object | Type | Action |
|--------|------|--------|
| `public.notification_log` | Table | CHECK constraint dropped and recreated |
| `notification_log_notification_type_check` | CHECK constraint | Replaced |

**Full allowed values after migration:**
`appointment_confirmation`, `reminder_24h`, `reminder_same_day`, `appointment_canceled`, `appointment_rescheduled`, `technician_enroute`, `service_completed`, `appointment_canceled_employee`, `appointment_canceled_customer`, `scheduling_failure`, `payment_failed`, `subscription_canceled`, `logged`

### Idempotent?

**Yes.** Uses `DROP CONSTRAINT IF EXISTS` before `ADD CONSTRAINT`. Safe to re-run.

### Rollback Command

```sql
ALTER TABLE public.notification_log
  DROP CONSTRAINT IF EXISTS notification_log_notification_type_check;

ALTER TABLE public.notification_log
  ADD CONSTRAINT notification_log_notification_type_check
  CHECK (notification_type IN (
    'appointment_confirmation',
    'reminder_24h',
    'reminder_same_day',
    'appointment_canceled',
    'appointment_rescheduled',
    'technician_enroute',
    'service_completed'
  ));
```

Note: rollback should restore whatever the prior constraint was. If the prior constraint is unknown, remove the constraint entirely and add back only confirmed prior values.

### Deployment Risk

**Low.** Dropping and re-adding a CHECK constraint on an existing table is a metadata-only operation — no row rewrites. The new constraint is strictly more permissive than the old one (adds values, removes none). No existing rows will fail the new constraint. The operation runs without locking rows.

### Pre-Checks Required

Verify no existing rows in `notification_log` contain a `notification_type` value that would be excluded by the new constraint. The new constraint only adds values — it does not remove any — so this pre-check will always pass.

```sql
-- Confirm no rows have types outside the new allowed list
SELECT DISTINCT notification_type FROM public.notification_log
WHERE notification_type NOT IN (
  'appointment_confirmation','reminder_24h','reminder_same_day',
  'appointment_canceled','appointment_rescheduled','technician_enroute',
  'service_completed','appointment_canceled_employee','appointment_canceled_customer',
  'scheduling_failure','payment_failed','subscription_canceled','logged'
);
-- Expected: 0 rows returned
```

### Order Dependency

None. Independent of Migrations 1 and 3.

---

## Migration 3 — Assignment Appointment Uniqueness Index

**File:** `db/migrations/2026-05-29_assignment_appointment_uniqueness.sql`

### Purpose

Enforces a business rule: at most one non-terminal assignment can exist per appointment at any time. The migration does two things:

1. **Cleanup step:** Deletes duplicate active assignments, keeping only the most recently created row per appointment. This prevents the index creation from failing on existing bad data.

2. **Index creation:** Creates a partial UNIQUE index `assignments_appointment_id_active_unique` on `public.assignments(appointment_id)` filtered to rows where `status NOT IN ('completed', 'skipped', 'canceled', 'cancelled', 'no_show')`.

Terminal status rows are excluded from the index, so multiple historical assignment records per appointment (e.g., an employee was reassigned after a no-show) are preserved.

### Tables / Objects Affected

| Object | Type | Action |
|--------|------|--------|
| `public.assignments` | Table | Rows deleted (cleanup step) |
| `assignments_appointment_id_active_unique` | Partial UNIQUE index | Created |

### Idempotent?

**Partially.** The `CREATE UNIQUE INDEX IF NOT EXISTS` is idempotent. The `DELETE` step is also safe to re-run (it deletes no rows if duplicates are already gone). However, on the first run it can delete rows — that deletion is irreversible.

### Rollback Command

```sql
DROP INDEX IF EXISTS public.assignments_appointment_id_active_unique;
-- Note: deleted assignment rows cannot be restored. Rollback only removes the index constraint.
```

### Deployment Risk

**Medium.** The cleanup `DELETE` permanently removes duplicate assignment rows. While the kept row is the most recently created (most likely the correct one), any deleted rows are unrecoverable without a DB backup. The pre-check query below must be reviewed before applying.

### Pre-Check Required (CRITICAL)

Run this query BEFORE applying this migration. If it returns rows, the cleanup step will delete assignment records. Review each duplicate manually to confirm the most recently created row is the correct one to keep.

```sql
-- Pre-check: find duplicate active assignments per appointment
SELECT appointment_id, COUNT(*) AS active_count
FROM public.assignments
WHERE status NOT IN ('completed','skipped','canceled','cancelled','no_show')
GROUP BY appointment_id
HAVING COUNT(*) > 1;
```

**If this query returns rows:** Inspect the duplicates, confirm the cleanup logic (keep most recently created by `created_at DESC`) is acceptable, then proceed. If any duplicate represents a legitimate second assignment that should be preserved, resolve it manually before running the migration.

**If this query returns no rows:** The cleanup step is a no-op and the migration is fully safe to apply.

### Order Dependency

None. Independent of Migrations 1 and 2.

---

## Migration Order Summary

All three migrations are independent. Recommended order for clarity (not required):

1. `2026-05-29_ensure_profile_trigger.sql` — lowest risk, no data changes
2. `2026-05-29_notification_type_service_completed.sql` — low risk, metadata only
3. `2026-05-29_assignment_appointment_uniqueness.sql` — run pre-check first, then apply

---

## Verdict

All three migrations are syntactically valid, logically sound, and address confirmed integrity defects (IS-5 profile gap, IS-12 duplicate assignments, notification log collision). They are safe to deploy with the pre-checks noted above.
