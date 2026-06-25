# Routing Quality Implementation Plan
**Date:** 2026-06-01
**Sprint:** Routing Quality + Multi-Technician Dispatch

---

## Files Affected

### Migrations (new)
| File | Purpose |
|------|---------|
| `db/migrations/2026-05-31_route_stops_en_route.sql` | Add `en_route` to route_stops status CHECK constraint |

### Server (modified)
| File | Change |
|------|--------|
| `server/routes/adminRoutes.ts` | Full rewrite: real coordinate resolution, confidence scoring, day planner endpoints, complete audit logging |
| `server/routes/employeeAssignments.ts` | Add route stop status sync on every assignment status change |

### Client (modified)
| File | Change |
|------|--------|
| `client/pages/admin/RoutePlanning.tsx` | Add Day Planner tab, confidence badges, coordinate warnings, approve/publish all |
| `client/pages/employee/Route.tsx` | Polish: route status display, skipped count, next-stop logic |

---

## Routes Affected

### New API endpoints
- `POST /api/admin/routes/day/generate` — generate all technician routes for a date
- `GET /api/admin/routes/day?date=` — get all routes for a date
- `POST /api/admin/routes/day/approve` — bulk approve all drafts for a date
- `POST /api/admin/routes/day/publish` — bulk publish all approved routes for a date
- `POST /api/admin/routes/day/rebuild` — discard all drafts for a date
- `GET /api/admin/routes/day/unassigned?date=` — appointments not yet on any route

### Modified endpoints
- `POST /api/admin/routes/generate` — now uses real property coordinates + confidence scoring + `route_generated` audit log
- `POST /api/admin/routes/:id/discard` — now writes `route_discarded` audit log (was missing)
- `POST /api/admin/routes/:id/assign` — now writes `route_assigned` audit log (was missing)
- `POST /api/admin/routes/:id/reorder` — now writes `stop_reordered` audit log (was missing)
- `POST /api/employee/assignments/:id/status` — now syncs route_stops + auto-completes routes

---

## Migrations Required

Run in Supabase SQL Editor in this order:
1. `db/migrations/2026-05-31_route_stops_en_route.sql` ← NEW (add `en_route` status)

Previous migrations must already be applied:
- `2026-05-31_extend_routes.sql` ← extends routes/route_stops schema

---

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Day planner creates duplicate routes | LOW | `maybeSingle()` check before creating — skips if draft/approved already exists |
| GPS sync fails and blocks status update | ELIMINATED | Sync is fire-and-forget in `void (async () => {})()` |
| Real coords missing → mock fallback degrades route quality | LOW | Confidence marked 'low'/'medium'; admin sees warning badges |
| Multi-technician assignment creation fails halfway | LOW | Per-tech try/catch; failed techs → unassigned list |

---

## Rollback Plan

- If route_stops constraint fails: re-run `2026-05-31_extend_routes.sql` (already has status check drop)
- If day planner creates bad routes: use `POST /api/admin/routes/day/rebuild` to discard all drafts
- Server changes are backward-compatible: existing single-tech generate route is unchanged

---

## Test Plan

1. Run `db/migrations/2026-05-31_route_stops_en_route.sql`
2. Create appointments for tomorrow with real property lat/lng
3. Generate day plan → expect routes with `confidence: "high"` for real coords
4. Create appointment with no lat/lng on property → expect `confidence: "medium"` or `"low"` with coordinate warning
5. Approve all → all routes show `status: "approved"`
6. Publish all → all routes show `status: "published"`
7. Employee views `/employee/route` → sees published route with stops
8. Employee updates assignment to en_route → route_stop should show `en_route` status
9. Employee completes all stops → route status auto-advances to `completed`
10. TypeScript: `npx tsc --noEmit` → zero errors
11. Build: `npm run build:server && npm run build:client` → both pass
