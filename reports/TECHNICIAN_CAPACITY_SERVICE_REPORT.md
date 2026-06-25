# Technician Capacity Service Report
**Date:** 2026-06-01
**File:** `server/lib/technicianCapacity.ts`

---

## Function

`getEffectiveDailyCapacity(techId: string, date: string): Promise<CapacityResult>`

---

## Resolution Priority for max_stops (Highest → Lowest)

| Priority | Source | Field |
|----------|--------|-------|
| 1 | `technician_date_overrides` for employee + date | `max_stops_override` |
| 2 | `technician_schedule_templates` for employee + day-of-week | `max_stops` |
| 3 | `technician_capacity_profiles` for employee | `max_stops_per_day` |
| 4 | `employees.default_max_stops` | `default_max_stops` |
| 5 | Global constant | `8` |

The `source` field in the return value identifies which level was used.

---

## All Data Fetched in Parallel

All four DB queries run concurrently via `Promise.all()` to minimize latency:
- `employees` — for `default_max_stops`
- `technician_date_overrides` — for date-specific override
- `technician_schedule_templates` — for day-of-week template
- `technician_capacity_profiles` — for full capacity profile

---

## Non-Stop Fields (from capacity profile only)

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| max_service_minutes | number | undefined | Total on-site time cap |
| max_drive_minutes | number | undefined | Total travel time cap |
| allowed_service_types | string[] | [] | Empty = all types allowed |
| skill_level | string | "standard" | junior/standard/senior/specialist |
| is_licensed_applicator | boolean | false | CA DPR |
| preferred_service_area_ids | string[] | [] | ZIP/area preference |
| home_base_lat/lng | number | undefined | Route start point |

These fields are not affected by date overrides or schedule templates — only the capacity profile controls them.

---

## Usage in Route Planner

```typescript
const cap = await getEffectiveDailyCapacity(tech.id, date);
techCapacities[tech.id] = cap.max_stops;
// ...
const withinCap = techAppts.slice(0, techCapacities[tech.id]);
const overflow = techAppts.slice(techCapacities[tech.id]);
```

Each technician in the day planner now gets their own capacity limit rather than the global `max_stops_per_tech` parameter.
