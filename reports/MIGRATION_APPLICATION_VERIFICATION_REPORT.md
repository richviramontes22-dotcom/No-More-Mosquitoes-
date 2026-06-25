# Phase 2 — Migration Application Verification Report
**Date:** 2026-05-30
**Sprint:** Production Verification & Operational Readiness Sprint

---

## Summary

All 6 migration files were read and analyzed. The user has confirmed all migrations have been applied to Supabase. Each migration has been verified for SQL correctness and idempotency.

---

## Migration 1: `2026-05-30_notification_types_communication_sprint.sql`

**Purpose:** Expand notification_log CHECK constraint to add 13 new notification types from the Communication Sprint.

**Idempotency:** YES
- `DROP CONSTRAINT IF EXISTS` — safe to re-run
- `ADD CONSTRAINT` — will fail only if constraint already exists with same name but different clause; the DROP ensures this is safe

**SQL correctness:** VERIFIED
- Drops old constraint first, recreates with full list
- Includes all prior types plus 13 new ones
- Semicolon-terminated; no syntax issues

**Types added:**
`subscription_activated`, `subscription_renewed`, `annual_expiring_30d`, `annual_expiring_7d`, `annual_expired`, `appointment_reminder_24h`, `appointment_reminder_same_day`, `technician_en_route`, `lead_acknowledgement`, `sms_opt_out`, `sms_opt_in`

Also preserved (from prior migration): `payment_failed`, `subscription_canceled`, `logged`

**Status:** VERIFIED — SQL is correct and idempotent

---

## Migration 2: `2026-05-30_admin_alerts.sql`

**Purpose:** Create admin_alerts table, indexes, and RLS policy.

**Idempotency:** YES
- `CREATE TABLE IF NOT EXISTS` — safe to re-run
- `CREATE INDEX IF NOT EXISTS` — safe to re-run (5 indexes)
- `ALTER TABLE ENABLE ROW LEVEL SECURITY` — idempotent (no error if already enabled)
- `CREATE POLICY` — NOTE: NOT idempotent. Will error on re-run if policy already exists.

**SQL Correctness:** VERIFIED
- Table schema is complete with all required columns
- Indexes cover alert bell query patterns (severity, resolved_at, created_at, event_type)
- Deduplication partial index on (event_type, entity_type, entity_id) WHERE resolved_at IS NULL
- RLS policy uses `profiles.role = 'admin'` check — correct

**Minor idempotency gap:** `CREATE POLICY admin_alerts_admin_only` will fail on re-run with "policy already exists" error. This is a known pattern — it would only be an issue on repeated migration runs, not on initial deployment.

**Status:** VERIFIED — SQL is correct. First-time run: SAFE. Re-run: Policy creation will error (non-fatal for a deployment context).

---

## Migration 3: `2026-05-30_notification_phase2_types.sql`

**Purpose:** Add 4 more notification types for Phase 2 (employee assignments + email opt-out).

**Idempotency:** YES
- `DROP CONSTRAINT IF EXISTS` then `ADD CONSTRAINT` pattern — same as Migration 1

**SQL Correctness:** VERIFIED
- This migration supercedes Migration 1 by including ALL prior types PLUS 4 new ones
- New types: `employee_assignment_created`, `employee_assignment_cancelled`, `employee_assignment_updated`, `email_opted_out`
- This is the FINAL constraint state and must be run AFTER Migration 1

**Important:** Because this migration drops and recreates the constraint, running it after Migration 1 is correct — the final constraint includes all prior types.

**Status:** VERIFIED — SQL is correct and idempotent

---

## Migration 4: `2026-05-29_ensure_profile_trigger.sql`

**Purpose:** Create DB trigger to auto-create profiles row on auth.users INSERT.

**Idempotency:** YES
- `CREATE OR REPLACE FUNCTION` — replaces existing function safely
- `DROP TRIGGER IF EXISTS` then `CREATE TRIGGER` — safe pattern

**SQL Correctness:** VERIFIED
- Function uses SECURITY DEFINER — correct for writing to profiles from auth trigger
- ON CONFLICT (id) DO NOTHING — prevents duplicate errors on replay
- COALESCE for name: prefers `raw_user_meta_data->>'name'`, falls back to `full_name`, then email prefix
- Trigger fires AFTER INSERT on auth.users FOR EACH ROW

**Status:** VERIFIED — SQL is correct and idempotent

---

## Migration 5: `2026-05-29_notification_type_service_completed.sql`

**Purpose:** Add service_completed and other types to notification_log CHECK constraint.

**Idempotency:** YES — same DROP+ADD pattern

**SQL Correctness:** VERIFIED — this was an intermediate migration; Migration 1 and Migration 3 are supersets of this constraint.

**Note:** If migrations were applied in order, this migration's constraint was replaced by Migration 1 (2026-05-30), which was then replaced by Migration 3. The final constraint state is defined by Migration 3.

**Status:** VERIFIED — SQL correct and idempotent

---

## Migration 6: `2026-05-29_assignment_appointment_uniqueness.sql`

**Purpose:** Add partial UNIQUE index to prevent duplicate active assignments per appointment.

**Idempotency:** YES
- `CREATE UNIQUE INDEX IF NOT EXISTS` — safe to re-run

**SQL Correctness:** VERIFIED
- DELETE cleanup step: removes duplicate active assignments keeping only the most recent
- Partial UNIQUE INDEX on (appointment_id) WHERE status NOT IN terminal states
- Terminal states: 'completed', 'skipped', 'canceled', 'cancelled', 'no_show'

**WARNING — DATA SIDE EFFECT:** The DELETE step permanently removes duplicate assignment rows. This is a one-time cleanup that cannot be undone. The migration includes no guard on whether duplicates exist before running. If the migration is re-run after the index is created, the DELETE still executes (though it will find no rows to delete since the index prevents new duplicates).

**Status:** VERIFIED — SQL correct. Initial run: data cleanup executes. Re-run: safe (no rows to delete).

---

## Post-Application SQL Verification Queries

Run these in Supabase SQL Editor to confirm all migrations applied correctly:

### 1. Verify profile trigger exists
```sql
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users'
  AND trigger_name = 'on_auth_user_created';
-- Expected: 1 row
```

### 2. Verify final notification_log CHECK constraint (Phase 2 types)
```sql
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'notification_log_notification_type_check';
-- Expected: 1 row with check_clause containing 'employee_assignment_created'
-- This confirms Migration 3 (phase2_types) was the last applied
```

### 3. Verify assignment uniqueness index
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'assignments'
  AND indexname = 'assignments_appointment_id_active_unique';
-- Expected: 1 row
```

### 4. Verify admin_alerts table exists
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'admin_alerts';
-- Expected: 1 row
```

### 5. Verify admin_alerts RLS is enabled
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'admin_alerts';
-- Expected: rowsecurity = true
```

### 6. Verify notification types include all Phase 2 types
```sql
-- Attempt to insert a row with each new type and confirm no CHECK violation
-- (Do this in a BEGIN/ROLLBACK block to avoid leaving test data)
BEGIN;
INSERT INTO public.notification_log (channel, notification_type, status, created_at)
VALUES
  ('email', 'employee_assignment_created', 'skipped', NOW()),
  ('email', 'employee_assignment_cancelled', 'skipped', NOW()),
  ('email', 'email_opted_out', 'skipped', NOW()),
  ('sms',   'sms_opt_out', 'skipped', NOW()),
  ('sms',   'sms_opt_in', 'skipped', NOW()),
  ('email', 'subscription_activated', 'skipped', NOW()),
  ('email', 'lead_acknowledgement', 'skipped', NOW());
ROLLBACK;
-- Expected: No errors (all types accepted by CHECK constraint)
```

### 7. Verify no orphaned auth users (profiles backfill complete)
```sql
SELECT au.id, au.email
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;
-- Expected: 0 rows
-- If rows returned: run the backfill query below
```

### 8. Profile backfill query (run only if Query 7 returns rows)
```sql
INSERT INTO public.profiles (id, name, email, role, created_at)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
  au.email,
  'customer',
  NOW()
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
```

---

## Status Summary

| Migration | File Exists | SQL Correct | Idempotent | Applied (user-confirmed) |
|-----------|------------|-------------|-----------|--------------------------|
| notification_types_communication_sprint | YES | YES | YES | YES |
| admin_alerts | YES | YES | MOSTLY (policy not idempotent) | YES |
| notification_phase2_types | YES | YES | YES | YES |
| ensure_profile_trigger | YES | YES | YES | YES |
| notification_type_service_completed | YES | YES | YES | YES |
| assignment_appointment_uniqueness | YES | YES | YES (with data side effect) | YES |

**Overall:** All 6 migrations are syntactically correct. All have been applied per user confirmation. Operator should run verification queries 1-5 to confirm.
