# Admin Technician Schedule UI Report
**Date:** 2026-06-01
**File:** `client/pages/admin/WorkforceSchedules.tsx`
**Route:** `/admin/workforce/schedules`

---

## Layout

Two-column: technician list sidebar (280px) + schedule editor (flex-1).

---

## Technician Sidebar

Lists all active technicians/dispatchers. Clicking selects a technician and loads their schedule.

---

## Weekly Schedule Grid

One row per day of week (Sun–Sat). Each row shows:
- Day abbreviation (Sun, Mon…) colored green if working, gray if off
- "Working / Day off" checkbox toggle
- If working: start time input, end time input, max stops input
- "Effective from" date picker (bottom of grid)
- "Save Schedule" button

On save, calls `POST /api/admin/workforce/schedules/:employeeId` with all 7 days + effective_from. Uses upsert — safe to call repeatedly.

Default values when no template exists:
- Mon–Fri: working, 08:00–17:00, max_stops null
- Sat–Sun: not working

---

## Date Overrides Section

Shows upcoming overrides for the selected technician (next 30 days). Each override shows:
- Date (monospace)
- Available (✓) or Unavailable (✗) icon
- Hours if available / reason
- Delete button

**Add Override form:**
- Date picker
- "Available" checkbox
- Reason text field
- "Add" button → calls `POST /api/admin/workforce/overrides`

Overrides auto-reload after add/delete.

---

## Empty State

When no technician selected: dashed border placeholder.
When loading: spinner + "Loading schedule…"
