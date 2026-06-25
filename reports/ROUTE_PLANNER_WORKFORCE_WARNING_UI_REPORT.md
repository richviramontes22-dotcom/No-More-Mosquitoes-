# Route Planner Workforce Warning UI Report
**Date:** 2026-06-01

---

## Current State

The Day Planner UI in `client/pages/admin/RoutePlanning.tsx` already shows:
- Confidence badges (High/Medium/Low) per route card
- Coordinate warning count per route card
- "Excluded technicians" count via `excluded_technicians` field in generate response
- `workforce_notes` array from the generate API response

---

## What the Generate Response Now Returns

```json
{
  "routes": [...],
  "workforce_notes": [
    "Technician abc12345: excluded (not_scheduled)",
    "Technician abc12345: No schedule template configured — using business-hours default"
  ],
  "excluded_technicians": 1,
  "message": "Created 2 draft route(s). 0 appointment(s) unassigned. 1 technician(s) excluded due to availability."
}
```

The `message` field shown in the toast already includes the excluded count.

---

## Workforce Warning Display (Planned — Minor UI Update)

After the generate call, the Day Planner should show `workforce_notes` if present:

```
⚠ Workforce Notes (2)
  • Technician abc12345: excluded (not_scheduled)
  • Technician abc12345: No schedule template configured
```

This should appear as a collapsible amber section below the route cards.

**Status:** API returns the data. The UI toast shows the message. The detailed `workforce_notes` display is a one-day UI update — not blocking.

---

## Publish Validation Gate (API implemented)

When admin clicks "Publish All" and validation fails:
- API returns HTTP 400 with `validation` object
- Client receives `AdminApiError` with the message
- Toast shows: "Workforce validation failed — cannot publish"
- Admin must fix blockers or pass `force: true`

The `force` parameter is not yet exposed in the UI — admin would need to use the API directly. A "Force Publish (override)" button with confirmation dialog is the recommended UI addition (1-2 hours of work).

---

## Deferred

- Validation result display per route in admin UI (requires reading validation endpoint before publish)
- Force Publish button with confirm dialog
- Missing schedule/capacity badges on individual route cards
