# Employee Checklist Persistence Report
**Date:** 2026-05-31

## Problem

The pre-service checklist in `AssignmentDetail.tsx` had six hardcoded checkbox items that reset on every page navigation. The `job_checklists` table existed in the database schema but was never referenced in any code.

## Fix

### Server — two new endpoints in `employeeAssignments.ts`:

**GET /api/employee/assignments/:id/checklist**
- Verifies assignment ownership
- Returns saved checklist items from `job_checklists` table
- Returns `{ items: null }` if no checklist saved yet (client defaults to all unchecked)

**POST /api/employee/assignments/:id/checklist**
- Verifies assignment ownership
- Accepts `{ items: Array<{ label: string; checked: boolean }> }`
- If checklist row exists → UPDATE; otherwise → INSERT
- Sets `completed_at` if all items are checked, null otherwise
- Sets `completed_by` to the authenticated employee's ID

### Client — `AssignmentDetail.tsx`:

- Added `checklist: boolean[]` state initialized to all-false
- Added `CHECKLIST_LABELS` constant (6 items, matches previous hardcoded list)
- Added `loadChecklist()` — called on mount — fetches saved state from API
- Added `saveChecklist(next)` — fires on every checkbox toggle (auto-save)
- Added `toggleChecklist(i)` — flips one item, updates state, triggers save
- Added `checklistSaving` state — shows spinner indicator during save
- Added completion counter: "N/6 complete" displayed next to section header
- Checked items show strikethrough style

## Storage Format

Stored in `job_checklists.checklist` as JSONB:
```json
[
  { "label": "PPE on", "checked": true },
  { "label": "Pets accounted for", "checked": false },
  ...
]
```

## Result

Checklist state persists across page navigations and browser refreshes. Auto-saves on every toggle. Reload correctly restores saved state.

## Files Changed
- `server/routes/employeeAssignments.ts` — added two new endpoints
- `client/pages/employee/AssignmentDetail.tsx` — added persistence logic and UI updates
