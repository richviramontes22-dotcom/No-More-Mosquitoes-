# Technician Capacity Model Report
**Date:** 2026-06-01

---

## Overview

Capacity governs how many stops and hours a technician can handle in a single day. The current system has only one capacity setting: `max_jobs_per_tech` per business-hours window (global, not per-technician). That is insufficient for a multi-technician operation with technicians of different experience levels, working hours, or physical limitations.

---

## Current Capacity Model (What Exists)

```
business_hours.windows[].max_jobs_per_tech = 3 (morning), 3 (afternoon)
```

The day planner reads this: total capacity per tech per window = 3. Hard-coded in the window definition. No per-technician override possible.

---

## Proposed Capacity Model

### Per-Technician Capacity Profile (`technician_capacity_profiles`)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `max_stops_per_day` | int | 8 | Maximum job stops per working day |
| `max_service_minutes_per_day` | int | NULL | Optional: cap on total on-site time |
| `max_drive_minutes_per_day` | int | NULL | Optional: cap on total drive time |
| `allowed_service_types` | text[] | `{}` (all) | If set, only these service types assigned |
| `skill_level` | text | 'standard' | 'junior', 'standard', 'senior', 'specialist' |
| `is_licensed_applicator` | boolean | false | CA DPR pesticide applicator license |
| `preferred_service_area_ids` | uuid[] | `{}` (any) | Preferred geographic zones |
| `home_base_lat/lng` | decimal | NULL | Route starting location |
| `home_base_address` | text | NULL | Human-readable depot address |
| `vehicle_type` | text | NULL | For equipment planning |

---

## Capacity Hierarchy (Resolution Order)

```
1. technician_capacity_profiles.max_stops_per_day        ← per-tech setting
2. technician_schedule_templates[day].max_stops          ← per-day-of-week override
3. technician_date_overrides[date].max_stops_override    ← per-date override
4. business_hours.windows[].max_jobs_per_tech × 2        ← global fallback
```

The route planner uses whichever limit applies at the most specific level.

---

## Stop Count Capacity

### Simple Model (MVP)
- `max_stops_per_day` = total stops that day, regardless of job type or duration
- Default: 8 (currently hard-coded in day planner as `max_stops_per_tech`)
- Existing behavior is preserved with the default

### Example Configurations:
| Technician | max_stops | Reason |
|------------|-----------|--------|
| Luis (senior, FT) | 10 | Experienced, efficient |
| Maria (standard, FT) | 8 | Default |
| James (part-time) | 4 | Works half days |
| New hire (junior) | 5 | Training period, needs more time per stop |

---

## Service Time Capacity (Phase 2)

When `max_service_minutes_per_day` is set:
- Each stop has an `estimated_duration_minutes` (default: 45 min)
- Route planner sums estimated service time across all stops
- Stops are excluded once the tech's daily service time cap would be exceeded

This is more accurate for mixed job types (a large property takes 90 min; a small one 20 min).

---

## Service Type / Skill Filtering

### Use Case: Pesticide Applicator License
California requires licensed applicators for certain pesticide applications. If a technician is not licensed, they should not be assigned pesticide-heavy treatments.

```typescript
// Route planner filter:
if (capacity.allowed_service_types.length > 0) {
  if (!capacity.allowed_service_types.includes(appointment.service_type)) {
    // Skip this technician for this appointment
    return false;
  }
}
```

### Skill Levels
| Skill Level | Can Be Assigned |
|-------------|----------------|
| junior | Standard mosquito service only |
| standard | All standard services |
| senior | All services including remediation visits |
| specialist | All services + training supervision |

These are suggestions — the actual mapping is business-configurable, not hard-coded.

---

## Geographic Capacity: Service Area Preferences

Each technician can have `preferred_service_area_ids`:
- Empty array = no preference, route planner assigns anywhere
- Non-empty = route planner prefers to assign stops in these areas

The preference is a soft constraint (hint to the grouping algorithm), not a hard block. Admin can always override.

### Technician Home Base
`home_base_lat/lng` and `home_base_address` allow the route optimizer to:
- Start each technician's route from their actual starting location
- Estimate first-stop travel time more accurately
- (Future) Return-to-depot distance calculation

Currently the route optimizer starts from the first appointment (no home base). This field enables improvement without requiring it.

---

## Admin Capacity Management UI

Located at `/admin/workforce/capacity`:

Per-technician card showing:
- Daily stop limit with editable field
- Skill level dropdown
- Licensed applicator toggle
- Allowed service types checklist
- Preferred service areas multi-select
- Home base address input

---

## Capacity in the Day Planner

The current day planner uses `max_stops_per_tech = 8` as a hardcoded local variable. After this sprint, it should:

```typescript
// For each technician, get their effective capacity for the date
const cap = await getEffectiveCapacity(tech.id, date);
// cap.max_stops = from profile, schedule template, or date override

const withinCap = techAppts.slice(0, cap.max_stops);
const overflow = techAppts.slice(cap.max_stops);
```

This is a one-line change in the loop; the capacity resolution function does the work.
