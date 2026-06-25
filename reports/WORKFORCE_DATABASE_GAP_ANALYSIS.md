# Workforce Database Gap Analysis
**Date:** 2026-06-01

---

## Existing Tables (Workforce-Relevant)

| Table | Purpose | Complete? |
|-------|---------|-----------|
| `employees` | Technician profiles, role, status | Partially — no availability/capacity columns |
| `shifts` | Daily clock-in/out records | YES (for timekeeping; not used for availability) |
| `time_events` | Granular shift events | YES |
| `business_hours` | Global/area operating hours + window capacity | YES |
| `blackout_dates` | Company-wide closed dates | YES — but `employee` scope unimplemented |
| `service_areas` | Geographic service zones | Partially — schema mismatch with API |
| `routes` | Daily route plans per technician | YES |
| `route_stops` | Individual stops on a route | YES |
| `assignments` | Technician ↔ appointment links | YES |
| `route_audit_log` | Route action audit trail | YES |

---

## Missing Tables — Required for Workforce Management

### 1. `technician_schedule_templates`
Defines each technician's recurring weekly work schedule.

```sql
CREATE TABLE technician_schedule_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  -- 0=Sunday, 1=Monday, ... 6=Saturday
  is_working boolean NOT NULL DEFAULT true,
  work_start time,          -- e.g., '08:00'
  work_end time,            -- e.g., '17:00'
  max_stops int,            -- override for this day (NULL = use global)
  notes text,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_until date,     -- NULL = indefinite
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, day_of_week, effective_from)
);
```

### 2. `technician_time_off_requests`
Employee-initiated time-off requests with admin approval workflow.

```sql
CREATE TABLE technician_time_off_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  request_type text NOT NULL
    CHECK (request_type IN ('pto', 'unpaid', 'sick', 'personal', 'unavailable')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  -- partial day support
  partial_day boolean NOT NULL DEFAULT false,
  partial_start time,        -- e.g., '12:00' if leaving at noon
  partial_end time,          -- e.g., '17:00'
  reason text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'canceled')),
  admin_note text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  -- conflict tracking
  conflicts_checked_at timestamptz,
  conflicting_assignment_ids uuid[],  -- assignments that fall during this period
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT date_order CHECK (end_date >= start_date)
);
CREATE INDEX idx_tor_employee_dates ON technician_time_off_requests (employee_id, start_date, end_date);
CREATE INDEX idx_tor_status ON technician_time_off_requests (status) WHERE status = 'pending';
```

### 3. `technician_capacity_profiles`
Per-technician workload limits and service preferences.

```sql
CREATE TABLE technician_capacity_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
  -- Daily limits (NULL = use global business_hours default)
  max_stops_per_day int DEFAULT 8,
  max_service_minutes_per_day int,   -- e.g., 360 (6 hours)
  max_drive_minutes_per_day int,     -- e.g., 120 (2 hours)
  -- Service type qualifications
  allowed_service_types text[] DEFAULT '{}',  -- empty = all types allowed
  skill_level text CHECK (skill_level IN ('junior', 'standard', 'senior', 'specialist')),
  is_licensed_applicator boolean NOT NULL DEFAULT false,
  -- Geographic preferences
  preferred_service_area_ids uuid[],  -- empty = no preference
  home_base_lat decimal(10, 7),
  home_base_lng decimal(10, 7),
  home_base_address text,
  -- Vehicle/equipment
  vehicle_type text,
  equipment_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 4. `technician_date_overrides`
One-off date-specific availability overrides (not PTO — just schedule changes).
Example: "Luis normally works Monday but not this Monday" or "Maria is adding Saturday this week."

```sql
CREATE TABLE technician_date_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  override_date date NOT NULL,
  is_available boolean NOT NULL DEFAULT false,
  work_start time,
  work_end time,
  max_stops_override int,
  reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, override_date)
);
CREATE INDEX idx_date_overrides_date ON technician_date_overrides (override_date);
```

---

## Existing Tables Requiring Column Additions

### `employees` — Add Columns

```sql
-- Already added in prior sprints:
-- worker_type, is_test, gps_consent_at, emergency_contact_*

-- Needed for workforce management:
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS hire_date date,
  ADD COLUMN IF NOT EXISTS service_area_ids uuid[] DEFAULT '{}',
  -- preferred/assigned service areas for routing
  ADD COLUMN IF NOT EXISTS default_max_stops int DEFAULT 8;
  -- used when capacity profile not set
```

### `blackout_dates` — Already Has `employee_id`
The column already exists. It just needs:
1. Backend enforcement in route planner
2. Admin UI to create employee-scoped blackouts
3. API to expose per-employee blackouts

### `service_areas` — Schema Mismatch Fix

```sql
-- API expects: zip, city, state, capacity, is_active, updated_at
-- Migration only has: name, zips[], active, created_at
ALTER TABLE service_areas
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text DEFAULT 'CA',
  ADD COLUMN IF NOT EXISTS capacity int DEFAULT 10,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
```

---

## Tables That Can Be Dropped / Simplified

None — all existing tables are still needed.

---

## Summary: What Needs to Be Created

| New Table | Priority | Sprint |
|-----------|----------|--------|
| `technician_schedule_templates` | HIGH | Sprint A |
| `technician_time_off_requests` | HIGH | Sprint B |
| `technician_capacity_profiles` | MEDIUM | Sprint A or B |
| `technician_date_overrides` | MEDIUM | Sprint A |

## Summary: What Needs to Be Modified

| Existing Table | Change | Priority |
|----------------|--------|----------|
| `employees` | Add hire_date, service_area_ids, default_max_stops | MEDIUM |
| `blackout_dates` | No schema change; add enforcement in route planner | HIGH |
| `service_areas` | Fix schema mismatch (zip, city, state, capacity, is_active) | MEDIUM |
| `business_hours` | No change; already well-structured | — |
