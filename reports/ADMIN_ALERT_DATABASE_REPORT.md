# Admin Alert Database Report

**Date:** 2026-05-30  
**Migration:** `db/migrations/2026-05-30_admin_alerts.sql`  
**Status:** MIGRATION CREATED — run in Supabase SQL Editor

## Table: `admin_alerts`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | `gen_random_uuid()` |
| event_type | TEXT | Dot-namespaced, e.g. `billing.payment_failed` |
| severity | TEXT | CHECK: info \| warning \| critical |
| title | TEXT | Short one-liner for alert bell |
| body | TEXT | Optional longer description |
| entity_type | TEXT | appointment \| subscription \| user \| lead \| assignment |
| entity_id | TEXT | UUID or external ID (e.g. Stripe sub ID) |
| metadata | JSONB | Arbitrary key/value pairs |
| acknowledged_at | TIMESTAMPTZ | NULL until admin sees the alert |
| acknowledged_by | UUID FK → profiles | Admin who acknowledged |
| resolved_at | TIMESTAMPTZ | NULL until issue is addressed |
| resolved_by | UUID FK → profiles | Admin who resolved |
| notified_email | BOOLEAN | Whether email was attempted |
| notified_sms | BOOLEAN | Whether SMS was attempted |
| created_at | TIMESTAMPTZ | Event timestamp |

## Indexes

- `severity` — for filtering by urgency
- `resolved_at` — for unresolved filter (WHERE resolved_at IS NULL)
- `created_at DESC` — for newest-first pagination
- `event_type` — for event type grouping
- `(event_type, entity_type, entity_id) WHERE resolved_at IS NULL` — deduplication

## RLS Policy

- `admin_alerts_admin_only`: ALL operations require `profiles.role = 'admin'`
- Service role (`supabaseAdmin`) bypasses RLS for server-side writes

## Pending Action

Run `db/migrations/2026-05-30_admin_alerts.sql` in Supabase SQL Editor to create the table.
