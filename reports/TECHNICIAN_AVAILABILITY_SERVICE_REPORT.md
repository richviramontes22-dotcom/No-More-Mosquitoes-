# Technician Availability Service Report
**Date:** 2026-06-01
**File:** `server/lib/technicianAvailability.ts`

---

## Function

`isTechnicianAvailable(techId: string, date: string): Promise<AvailabilityResult>`

Returns `{ available, reason, work_start, work_end, max_stops, warnings }`.

---

## Resolution Priority (Highest → Lowest)

| Priority | Check | Result If Matched |
|----------|-------|------------------|
| 1 | `employees.status !== 'active'` | unavailable, reason: `employee_inactive` |
| 2 | `blackout_dates` with `scope = 'all'` for date | unavailable, reason: `company_blackout` |
| 3 | `blackout_dates` with `scope = 'employee'` + employee_id | unavailable, reason: `employee_blackout` |
| 4 | `technician_time_off_requests` with `status = 'approved'` (table may not exist) | unavailable, reason: `approved_time_off` |
| 5 | `technician_date_overrides` for employee + date | uses override: available/unavailable, work hours, max_stops |
| 6 | `technician_schedule_templates` for employee + day_of_week + effective_from ≤ date | uses template: working/day-off, work hours, max_stops |
| 7 | `business_hours` for day_of_week | if business closed → unavailable |
| 8 | Default | available=true with warning: "No schedule template configured" |

---

## Backward Compatibility

If `technician_schedule_templates` has no row for a technician, the service returns `available: true` with a warning message rather than blocking route generation. This ensures the route planner continues to work before any schedules are configured.

The warning appears in:
- `route.conflict_notes` array
- Day planner `workforce_notes` response field
- Admin workforce overview as "missing schedules" count

---

## Time-Off Request Handling

The check for `technician_time_off_requests` (Sprint B table) is wrapped in a `try/catch`. If the table doesn't exist (Sprint A), the error is silently ignored and execution continues to the next priority level. This is the only table check in the service that uses graceful failure.

---

## Return Shape

```typescript
{
  available: boolean,
  reason?: "employee_inactive" | "company_blackout" | "employee_blackout"
           | "approved_time_off" | "date_override" | "not_scheduled"
           | "business_closed" | "schedule_template" | "default_business_hours",
  work_start?: string,   // "08:00"
  work_end?: string,     // "17:00"
  max_stops?: number,    // from template or override
  warnings?: string[],   // non-blocking advisory messages
}
```
