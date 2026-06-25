# Admin Route Planner UI Report
**Date:** 2026-05-31
**File:** `client/pages/admin/RoutePlanning.tsx`
**Route:** `/admin/route-planning`

---

## Pre-Existing UI

A functional route planning page already existed with:
- Date picker
- Employee selector
- Generate Route button (calls POST /routes/generate)
- Route list sidebar (all routes for selected employee+date)
- Route detail panel (stops table with ETA, distance, sequence)
- "Assign Route" button (draft → assigned)
- "Discard" button (deletes draft)

---

## Changes This Sprint

### New Action Buttons

**Draft status actions:**
- **"Approve Route"** — calls POST `/routes/:id/approve` (replaces old "Assign Route")
- **"Rebuild"** — calls POST `/routes/:id/rebuild` (clears stops, prompts to regenerate)
- **"Discard"** (red) — calls POST `/routes/:id/discard`

**Approved/Assigned status actions:**
- **"Publish & Notify Employee"** — calls POST `/routes/:id/publish`
- **"Rebuild"** — still available until published

**Published status:**
- Shows "Published [timestamp]" indicator instead of action buttons
- Route is locked — no further changes without backend workaround

### Expanded Status Colors

| Status | Color |
|--------|-------|
| draft | Yellow |
| approved | Sky blue |
| assigned | Blue |
| published | Indigo |
| in_progress | Purple |
| completed | Green |
| canceled | Gray |

### Three-Step Approval Flow

```
1. Admin selects employee + date
2. Admin clicks "Generate Optimized Route" → draft created
3. Admin reviews stops in detail panel
4. Admin clicks "Approve Route" → approved
5. Admin confirms and clicks "Publish & Notify Employee" → published, employee notified
```

Previously there was only one step (generate → assign). Now admin has a review stage.

---

## What Is NOT in the UI (Future)

- Drag-and-drop stop reordering (API endpoint exists, UI not implemented)
- Map view of stop pins
- Multi-employee day view
- Reassign stop to different employee
- Add/remove individual stops from a route
- Route history / comparison

These are all Phase 2 route features.
