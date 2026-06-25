# Admin Route API Report
**Date:** 2026-05-31
**File:** `server/routes/adminRoutes.ts`

---

## Pre-Existing Endpoints

These existed before this sprint:

| Route | Status |
|-------|--------|
| `GET /api/admin/routes?employee_id=&date=` | Existing — fetch routes for employee+date |
| `POST /api/admin/routes/generate` | Existing — run nearest-neighbor algorithm, create draft |
| `GET /api/admin/routes/:routeId` | Existing — route detail with stops |
| `POST /api/admin/routes/:routeId/assign` | Existing — draft → assigned |
| `POST /api/admin/routes/:routeId/discard` | Existing — delete draft route |
| `POST /api/admin/routes/:routeId/reorder` | Existing — bulk update stop sequence numbers |

---

## New Endpoints Added This Sprint

### `POST /api/admin/routes/:routeId/approve`
Transitions status: `draft` → `approved`. Sets `approved_at` and `approved_by`. Writes route audit log.

Used when admin has reviewed the generated route and it's ready to publish but not yet notified to employee.

### `POST /api/admin/routes/:routeId/publish`
Transitions status: `approved` → `published`. Sets `published_at` and `locked_at`. Fires admin notification alert (`scheduling.route_published`). Writes route audit log.

Employee is notified via the admin alert system. The route is now locked — rebuild required to make changes.

### `POST /api/admin/routes/:routeId/rebuild`
Deletes all stops from the route (resets it to zero stops). Route status unchanged. Admin can then generate stops again.

Blocked if route is `published` or `in_progress` (those routes are locked).

### `PATCH /api/admin/routes/stops/:stopId`
Updates individual stop fields: `notes`, `estimated_duration_minutes`, `sequence_number`, `status`. Writes route audit log.

Used for admin to add notes to a specific stop ("Gate code: 1234") or adjust service time estimate.

### `POST /api/admin/routes/:routeId/complete`
Marks route status as `completed`. For admin to manually close out a route at end of day.

### `GET /api/employee/routes/today` (also mounted at `/api/employee`)
Returns today's published route for the authenticated employee. Enriches stops with customer name, phone, address, coordinates, and assignment status.

Falls back gracefully: if no published route exists, returns `{ route: null, stops: [], has_route: false }`.

---

## Route Lifecycle Flow

```
POST /routes/generate  →  draft
POST /routes/:id/approve  →  approved
POST /routes/:id/publish  →  published (employee notified, locked)
POST /routes/:id/complete  →  completed
POST /routes/:id/discard  →  (deleted)
POST /routes/:id/rebuild  →  clears stops (admin generates again)
```

---

## Auth Pattern

All admin routes authenticate via Bearer JWT + profile.role === 'admin' check. No `requireAdmin` middleware is used (inline auth check) — this is consistent with the pre-existing code style in adminRoutes.ts.

---

## Route Audit Log

Written fire-and-forget via `logRouteAudit()` helper on all mutating endpoints. No errors are propagated if audit log fails.
