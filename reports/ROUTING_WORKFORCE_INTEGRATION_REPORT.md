# Routing Workforce Integration Report
**Date:** 2026-06-01

---

## Current Routing Gap

In `server/routes/adminRoutes.ts`, the day planner selects technicians with:

```typescript
const { data: techs } = await db
  .from("employees")
  .select("id, user_id")
  .eq("status", "active")
  .in("role", ["technician", "dispatcher"]);
```

**This is the only filter.** A technician is assigned if `status = 'active'`. No schedule, no time-off, no capacity, no blackout, no service area check.

---

## Required Changes to Route Planner

### Step 1: Filter by Date Availability

**New query sequence before assignment loop:**

```typescript
async function getAvailableTechnicians(date: string): Promise<Tech[]> {
  // Get all active technicians
  const { data: allTechs } = await db.from("employees")
    .select("id, user_id")
    .eq("status", "active")
    .in("role", ["technician", "dispatcher"]);

  // Filter each tech through availability check
  const available: Tech[] = [];
  for (const tech of allTechs || []) {
    const avail = await isTechnicianAvailable(tech.id, date);
    if (avail.available) available.push(tech);
  }
  return available;
}
```

`isTechnicianAvailable()` checks (in priority order):
1. Approved time-off request covering this date → EXCLUDED
2. Date override with `is_available = false` → EXCLUDED
3. Weekly schedule template: `is_working = false` for this day_of_week → EXCLUDED
4. Employee-scoped blackout date → EXCLUDED
5. Otherwise → INCLUDED

**If no technicians are available:** Return `{ routes: [], unassigned_appointments: allAppts, message: "No technicians available for this date." }`

### Step 2: Apply Per-Technician Capacity

Replace the current hardcoded `max_stops_per_tech = 8`:

```typescript
// For each available technician:
const cap = await getEffectiveDailyCapacity(tech.id, date);
// Returns: { max_stops, max_service_minutes, allowed_service_types }

const withinCap = techAppts.slice(0, cap.max_stops);
const overflow = techAppts.slice(cap.max_stops);
```

### Step 3: Service Type Filtering

When assigning appointments to technicians, filter by `allowed_service_types`:

```typescript
const eligible = appointments.filter(appt => {
  if (!cap.allowed_service_types.length) return true; // all types allowed
  return cap.allowed_service_types.includes(appt.service_type);
});
```

Appointments a technician is not qualified for go into the unassigned pool.

### Step 4: Company Blackout Enforcement

The current code doesn't check company blackout dates before generating routes (only before customer booking). Add:

```typescript
const { data: blackout } = await db
  .from("blackout_dates")
  .select("id, reason")
  .eq("date", date)
  .in("scope", ["all"])
  .maybeSingle();

if (blackout) {
  return res.status(400).json({
    error: `Cannot generate routes on a blackout date: ${blackout.reason}`
  });
}
```

---

## Conflict Warnings to Surface in Route Proposal

The `routes.conflict_notes` array should include workforce-related warnings:

| Warning | When Triggered |
|---------|---------------|
| "3 technicians have approved time off — reduced capacity today" | Multiple techs unavailable |
| "Luis has a pending time-off request for this date — route may need to be rebuilt" | Pending (not yet approved) time-off |
| "Carlos is at capacity (8 stops) — 2 appointments remain unassigned" | Capacity exceeded |
| "1 appointment requires a licensed applicator — no licensed tech available" | Skill gap |
| "2 appointments in service area not covered by any available tech" | Area coverage gap |

These notes are stored on `routes.conflict_notes` and displayed in the admin Day Planner UI.

---

## What Should NOT Be Auto-Resolved

| Issue | System Behavior |
|-------|----------------|
| Technician unavailable on route date | Route not created for them; admin sees empty slot |
| Pending time-off (not yet approved) | Route created with WARNING note; admin sees pending request alert |
| Capacity exceeded | Overflow goes to unassigned list; admin manually handles |
| Skill gap | Appointment goes to unassigned; admin manually reassigns |
| No technicians available | Route generation fails with clear message; no partial routes |

The system provides information and warnings. Humans make the final decisions.

---

## Single-Technician Generate Route Update

The `POST /api/admin/routes/generate` (single tech) also needs updating:

```typescript
// Before generating:
const avail = await isTechnicianAvailable(employee_id, date);
if (!avail.available) {
  return res.status(400).json({
    error: `${techName} is not available on ${date}`,
    reason: avail.reason
  });
}
```

Admin can override by providing `{ force: true }` in the body (with a warning logged to the route audit).

---

## Routing Workforce Integration: Implementation Order

| Priority | Change | Effort |
|----------|--------|--------|
| 1 | Add `isTechnicianAvailable()` check to day planner | Small (1 function + loop) |
| 2 | Enforce company-level blackout dates in route generation | Tiny |
| 3 | Replace hardcoded capacity with `getEffectiveDailyCapacity()` | Small |
| 4 | Add workforce conflict notes to route proposals | Small |
| 5 | Service type filtering in assignment loop | Medium |
| 6 | Admin override with `{ force: true }` | Small |

None of these require UI changes — they're all server-side route planner changes. The biggest dependency is having `technician_schedule_templates` and `technician_time_off_requests` tables populated.
