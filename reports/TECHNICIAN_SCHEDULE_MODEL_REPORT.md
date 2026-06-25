# Technician Schedule Model Report
**Date:** 2026-06-01

---

## Overview

A technician's availability for any given date is resolved by evaluating four layers in priority order:

```
1. Time-Off Request (approved)        ← highest priority → UNAVAILABLE
2. Date Override (admin-created)      ← specific date exception
3. Schedule Template (recurring)      ← weekly default schedule
4. Active Status = 'active'           ← baseline: in the system
```

If no layers restrict availability, the technician is considered available per their template. If no template exists, the technician defaults to **available on all business days** (matching current behavior — safe backward-compatible default).

---

## Layer 1: Recurring Weekly Schedule (`technician_schedule_templates`)

Each technician has a per-day-of-week schedule record. A missing record for a given day means that day uses the business default (available if business is open).

### Example schedule for Luis Martinez:
| Day | is_working | work_start | work_end | max_stops |
|-----|-----------|------------|----------|-----------|
| Sunday | false | — | — | — |
| Monday | true | 08:00 | 17:00 | 8 |
| Tuesday | false | — | — | — |
| Wednesday | true | 10:00 | 16:00 | 6 |
| Thursday | true | 08:00 | 17:00 | 8 |
| Friday | true | 08:00 | 14:00 | 5 |
| Saturday | false | — | — | — |

### Schedule Versioning
The `effective_from` and `effective_until` columns support schedule changes:
- "Starting next month, Maria works 4 days instead of 5" → create new template rows with `effective_from = next_month_start`
- Old rows retained for historical accuracy

### Admin Creates / Updates Schedule
- Admin opens `/admin/workforce/schedules`
- Selects technician
- Edits day-by-day availability with start/end times and max stop override
- Changes take effect from `effective_from` date forward

### Employee Cannot Self-Modify Schedule
Employees request changes via time-off requests. They do not directly edit their template. Admin has final say on the canonical schedule.

---

## Layer 2: Date-Specific Overrides (`technician_date_overrides`)

One-off exceptions that override the weekly template for a single date.

### Use cases:
- "Carlos normally works Tuesdays but not this Tuesday (dentist appointment, not worth a PTO request)"
- "Maria is available Saturday this week even though she's normally off Saturdays"
- "Luis is available but only until 1 PM this Thursday"

### Who creates overrides:
- Admin creates overrides directly (no approval flow — this is an admin action)
- Employees request changes through time-off requests, which admin then approves (which effectively creates an unavailability record)

### Resolution logic:
```typescript
// Check date override first
const override = await db.from("technician_date_overrides")
  .select("is_available, work_start, work_end, max_stops_override")
  .eq("employee_id", techId)
  .eq("override_date", date)
  .maybeSingle();

if (override) {
  if (!override.is_available) return { available: false, reason: "date_override" };
  return { available: true, hours: { start: override.work_start, end: override.work_end } };
}
```

---

## Layer 3: Recurring Template Resolution

After checking overrides, apply the weekly template:

```typescript
const dayOfWeek = new Date(date).getDay(); // 0=Sun, 1=Mon, ...

const template = await db.from("technician_schedule_templates")
  .select("is_working, work_start, work_end, max_stops")
  .eq("employee_id", techId)
  .eq("day_of_week", dayOfWeek)
  .lte("effective_from", date)
  .or("effective_until.is.null,effective_until.gte." + date)
  .order("effective_from", { ascending: false }) // most recent wins
  .limit(1)
  .maybeSingle();

if (template && !template.is_working) {
  return { available: false, reason: "not_scheduled" };
}
```

If no template exists for that day_of_week → fall through to business hours default (available if business is open).

---

## Layer 4: Approved Time-Off Check

Checked first (highest priority):

```typescript
const timeOff = await db.from("technician_time_off_requests")
  .select("id, request_type, partial_day, partial_start, partial_end")
  .eq("employee_id", techId)
  .eq("status", "approved")
  .lte("start_date", date)
  .gte("end_date", date)
  .limit(1)
  .maybeSingle();

if (timeOff) {
  if (!timeOff.partial_day) return { available: false, reason: "approved_time_off" };
  // Partial day: available for part of the day
  return { available: true, partial: true, blocked_start: timeOff.partial_start, blocked_end: timeOff.partial_end };
}
```

---

## Availability Resolution Function

```typescript
interface AvailabilityResult {
  available: boolean;
  reason?: "approved_time_off" | "date_override" | "not_scheduled" | "inactive";
  work_start?: string;
  work_end?: string;
  max_stops?: number;
  partial?: boolean;
}

async function isTechnicianAvailable(
  techId: string,
  date: string // YYYY-MM-DD
): Promise<AvailabilityResult>
```

The route planner calls this function for each active technician before adding them to the candidate pool. Unavailable technicians are excluded entirely.

---

## Admin Schedule Management

### Setting a Default Schedule
Admin sets the weekly template through a 7-day grid:
```
Mon: ✓ 8:00–17:00  max 8 stops
Tue: ✗ (off)
Wed: ✓ 10:00–16:00 max 6 stops
Thu: ✓ 8:00–17:00  max 8 stops
Fri: ✓ 8:00–14:00  max 5 stops
Sat: ✗ (off)
Sun: ✗ (off)
```

### Schedule Change Requests
When an employee requests a permanent schedule change (e.g., "I'd like to switch my off day from Tuesday to Friday going forward"):
- Submit via time-off system as a "schedule change request" (or a separate channel)
- Admin approves → updates the template `effective_from = next_week`

---

## Default Behavior (No Template Set)

To maintain backward compatibility with existing employees who have no schedule template:
- If `technician_schedule_templates` has no rows for a technician, assume available on all business-open days
- Route planner behavior unchanged for employees without templates
- Admin is notified to set schedules for existing technicians before going live
