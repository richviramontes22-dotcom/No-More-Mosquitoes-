# Onboarding Database Migration Report
**Date:** 2026-05-31

## Migration: `db/migrations/2026-05-31_onboarding_tables.sql`

### Employee Table — New Columns

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `onboarding_status` | text | `'not_started'` | CHECK IN ('not_started','pending','in_progress','completed','approved') |
| `onboarding_completed_at` | timestamptz | NULL | Set when all required forms signed |
| `onboarding_approved_at` | timestamptz | NULL | Set by admin when manually approved |
| `onboarding_approved_by` | uuid | NULL | Admin user who approved |
| `gps_consent_form_version_id` | uuid | NULL | Links to the form version used to give GPS consent |

### New Tables

**`onboarding_forms`** — Form registry
- `id`, `name`, `description`, `category`, `form_type`
- `required_for text[]` — worker types that must complete (e.g., `['employee','contractor']`)
- `required_roles text[]` — roles that must complete (empty = all roles)
- `is_required boolean` — required vs optional
- `blocks_assignments boolean` — whether this form blocks assignment detail access
- `is_active boolean` — active/inactive state (soft delete)

**`onboarding_form_versions`** — Versioned content
- `id`, `form_id`, `version_number` (UNIQUE per form)
- `title`, `body_text`, `acknowledgment_statement`
- `document_url`, `document_filename` — optional PDF link
- `is_current boolean` — only one true per form at a time

**`employee_onboarding_assignments`** — Per-employee form assignment tracking
- `id`, `employee_id`, `form_id`, `form_version_id`
- `status CHECK IN ('pending','completed','skipped','reassigned')`
- `due_date`, `completed_at`, `assigned_by`
- UNIQUE (employee_id, form_version_id) — prevents duplicate assignments

**`employee_form_signatures`** — Immutable audit records
- `id`, `employee_id`, `user_id` (both auth + employee FK)
- `form_id`, `form_version_id`, `assignment_id`
- `signature_text` — typed full name
- `checkbox_acknowledged boolean NOT NULL`
- `acknowledgment_statement text` — SNAPSHOT of statement at time of signing
- `ip_address inet` — server-captured
- `user_agent text` — server-captured
- `signed_at timestamptz` — server-captured
- UNIQUE (employee_id, form_version_id) — one signature per employee per version

**`employee_document_uploads`** — Employee document submissions
- `id`, `employee_id`, `assignment_id`, `form_id`
- `document_url`, `filename`, `document_type`, `file_size_bytes`
- `review_status CHECK IN ('pending','approved','rejected')`
- `reviewed_at`, `reviewed_by`, `review_notes`

**`onboarding_audit_log`** — Append-only action trail
- `id`, `actor_id`, `actor_role`, `action`, `entity_type`, `entity_id`, `metadata jsonb`
- Indexes on actor + entity for efficient admin queries

### RLS Policies

All 6 tables have RLS enabled. Two policies per table:
- Admin policy: full access for `profiles.role = 'admin'`
- Employee policy: SELECT own records only (via employees.user_id = auth.uid())

Server-side routes use `supabaseAdmin` (service role) which bypasses RLS.

### Idempotency

- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` wrapped in `DO $$ IF NOT EXISTS $$`
- `CREATE TABLE IF NOT EXISTS` for all new tables
- `CREATE INDEX IF NOT EXISTS` for all indexes
- `DO $$ IF NOT EXISTS $$` wrapping for all RLS policies

### Apply Order

Run `db/migrations/2026-05-31_onboarding_tables.sql` after:
1. `2026-05-31_worker_type_test_employee.sql` (employees table must have worker_type column first)
2. `2026-05-31_employee_location_pings.sql`

### Verification Queries

```sql
-- Verify new employee columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'employees'
AND column_name IN ('onboarding_status','onboarding_completed_at','gps_consent_form_version_id');
-- Expected: 3 rows

-- Verify new tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('onboarding_forms','onboarding_form_versions',
  'employee_onboarding_assignments','employee_form_signatures',
  'employee_document_uploads','onboarding_audit_log');
-- Expected: 6 rows
```
