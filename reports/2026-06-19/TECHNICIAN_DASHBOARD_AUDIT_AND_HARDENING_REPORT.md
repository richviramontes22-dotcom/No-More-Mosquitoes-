# Technician Dashboard — Audit and Hardening Report
**Date:** 2026-06-19

## Verified Already Complete (no changes made)

| Capability | File |
|---|---|
| Today's route + stop order | `client/pages/employee/Route.tsx` |
| Assigned appointments list | `client/pages/employee/Assignments.tsx` |
| Navigation link | `AssignmentDetail.tsx` — `navUrl()` |
| Customer/property info | `AssignmentDetail.tsx` |
| Admin-entered service notes (read) | `AssignmentDetail.tsx` |
| Job photo/video upload | `job_media` table + `AssignmentDetail.tsx` |
| Mark en route / arrived / completed | `AssignmentDetail.tsx` + `server/routes/employeeAssignments.ts` |
| Clock in/out | `client/pages/employee/Timesheets.tsx`, `shifts` table |
| Job-specific messaging | `AssignmentDetail.tsx` (same thread system audited for the ticketing phase) |

Per the explicit "do not redesign technician dashboard completely" instruction, none of these were touched.

## What Was Hardened

### 1. Blocked Access / Unable to Service

The backend already accepted `no_show`/`skipped` as valid assignment statuses (`VALID_STATUSES` in `employeeAssignments.ts`) and already synced them through to `route_stops`/route-completion logic — this was 100% backend-ready. The only gap was that **no button existed anywhere for a technician to actually set them**; the detail page only *displayed* these statuses if some other process had set them.

Added: a "Blocked / Unable to Service" button on `AssignmentDetail.tsx` that reveals a reason textarea and two confirm actions ("Mark No-Show" / "Mark Skipped"). The reason is sent as `technician_notes` in the same `POST /status` call already used for every other status transition — no new endpoint needed for this part, since the only gap was the UI affordance, not the server logic.

### 2. Treatment Notes (technician-written)

**Genuinely missing at the data layer** — `assignments` had no notes column at all; the "Notes" shown on the detail page was always `appointments.notes` (admin-entered, read-only to the technician). Added:
- `db/migrations/2026-06-19_technician_dashboard_hardening.sql` — one new column, `assignments.technician_notes`.
- `PATCH /api/employee/assignments/:id/notes` (new, narrow endpoint) — lets a technician save notes independent of any status change, so notes can be jotted at any point in the visit, not just at completion.
- A "Treatment Notes" textarea + Save button on `AssignmentDetail.tsx`, pre-filled from the existing value on load.

The same `technician_notes` column doubles as the optional reason field for the blocked-access action above — one column, two related uses, no duplication.

## Server Changes — Minimal, Additive

`server/routes/employeeAssignments.ts`:
- `POST /assignments/:id/status` now additionally accepts an optional `technician_notes` string in the request body and persists it alongside the status change. No existing behavior changed — omitting the field (as every existing caller does) produces identical behavior to before.
- New `PATCH /assignments/:id/notes` handler, following the exact ownership-check pattern (`current.employee_id !== actor.employeeId` → 403) used by every other handler in this file.

## Validation

`pnpm typecheck` clean, `pnpm test` 134/134 (no existing technician-related test regressed; dedicated technician tests are added in Phase 9).
