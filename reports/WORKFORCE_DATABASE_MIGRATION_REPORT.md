# Workforce Database Migration Report
**Date:** 2026-06-01
**File:** `db/migrations/2026-06-01_workforce_sprint_a.sql`

---

## Tables Created

### `technician_schedule_templates`
Recurring weekly schedule per technician. One row per technician per day-of-week per effective_from date.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| employee_id | uuid FK → employees | ON DELETE CASCADE |
| day_of_week | smallint | 0=Sun … 6=Sat |
| is_working | boolean | false = day off |
| work_start | time | e.g., '08:00' |
| work_end | time | e.g., '17:00' |
| max_stops | int | NULL = use capacity profile |
| effective_from | date | When this schedule takes effect |
| effective_until | date | NULL = indefinite |
| UNIQUE | (employee_id, day_of_week, effective_from) | Prevents duplicates |

RLS: admin full, employee SELECT own.

### `technician_date_overrides`
Admin-set one-off availability exceptions for specific dates. Takes priority over weekly template.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| employee_id | uuid FK → employees | ON DELETE CASCADE |
| override_date | date | The specific date |
| is_available | boolean | false = blocked that day |
| work_start / work_end | time | When available |
| max_stops_override | int | NULL = use normal capacity |
| reason | text | Admin note |
| UNIQUE | (employee_id, override_date) | One override per day |

RLS: admin full, employee SELECT own.

### `technician_capacity_profiles`
Per-technician workload limits and qualifications. One row per technician (UNIQUE on employee_id).

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | uuid PK | | |
| employee_id | uuid UNIQUE FK | | |
| max_stops_per_day | int | 8 | |
| max_service_minutes_per_day | int | NULL | Optional |
| max_drive_minutes_per_day | int | NULL | Optional |
| allowed_service_types | text[] | {} | Empty = all types |
| skill_level | text | 'standard' | junior/standard/senior/specialist |
| is_licensed_applicator | boolean | false | CA DPR requirement |
| preferred_service_area_ids | uuid[] | {} | Empty = no preference |
| home_base_lat/lng | decimal | NULL | For future route start location |
| home_base_address | text | NULL | |
| vehicle_type / equipment_notes | text | NULL | |

RLS: admin full, employee SELECT own.

---

## Columns Added to `employees`

| Column | Type | Default |
|--------|------|---------|
| hire_date | date | NULL |
| default_max_stops | int | 8 |
| service_area_ids | uuid[] | {} |

---

## Columns Added to `service_areas`

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| city | text | NULL | Was missing |
| state | text | 'CA' | Was missing |
| capacity | int | 10 | Was missing |
| is_active | boolean | true | Was missing |
| updated_at | timestamptz | now() | Was missing |

---

## Idempotency

All additions are wrapped in `DO $$ BEGIN IF NOT EXISTS ... END $$`. Safe to re-run without error or data loss.

## Verification Queries

```sql
-- Verify new tables
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('technician_schedule_templates','technician_date_overrides','technician_capacity_profiles')
AND table_schema = 'public';
-- Expected: 3 rows

-- Verify employee columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'employees'
AND column_name IN ('hire_date','default_max_stops','service_area_ids');
-- Expected: 3 rows
```
