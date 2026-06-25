# Worker Type + Test Employee Migration Report
**Date:** 2026-05-31

## Migration: `2026-05-31_worker_type_test_employee.sql`

### Columns Added to `employees`

| Column | Type | Default | Constraint |
|--------|------|---------|------------|
| `worker_type` | text | `'employee'` | CHECK IN ('employee','contractor','vendor','test') |
| `is_test` | boolean | `false` | NOT NULL |
| `emergency_contact_name` | text | NULL | — |
| `emergency_contact_phone` | text | NULL | — |
| `emergency_contact_relation` | text | NULL | — |
| `gps_consent_at` | timestamptz | NULL | — |

### Idempotency

All alterations are wrapped in `DO $$ BEGIN ... IF NOT EXISTS ... END $$`. Safe to re-run without error.

### Indexes Added

- `idx_employees_is_test` — partial index on `is_test = true` for test account lookups
- `idx_employees_worker_type` — index on `worker_type` for filter queries

### Backward Compatibility

All existing employee rows default to `worker_type = 'employee'`, `is_test = false`, emergency contacts null, `gps_consent_at = null`. No existing data is changed.

### Run This Migration First

This migration must be applied before the `employee_location_pings` migration (which references `gps_consent_at`). Run both in order.

## How to Apply

Paste contents of `db/migrations/2026-05-31_worker_type_test_employee.sql` into Supabase Dashboard → SQL Editor → Run.

Expected output: `DO` (success). No errors.

## Verification Query

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'employees'
AND column_name IN ('worker_type','is_test','gps_consent_at','emergency_contact_name')
ORDER BY column_name;
```

Expected: 4 rows returned.
