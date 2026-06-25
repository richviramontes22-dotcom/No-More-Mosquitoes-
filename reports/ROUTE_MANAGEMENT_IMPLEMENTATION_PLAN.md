# Route Management Implementation Plan
**Date:** 2026-05-31

## Existing Infrastructure (Pre-Sprint)

The following already existed and was NOT rewritten:
- `server/routes/adminRoutes.ts` — generate, assign, discard, reorder, GET routes
- `server/lib/routeOptimization.ts` — nearest-neighbor algorithm with Haversine distance
- `client/pages/admin/RoutePlanning.tsx` — functional route planning UI
- `routes` and `route_stops` DB tables (with wrong column names vs code)

## What This Sprint Adds

### Database
- `db/migrations/2026-05-31_extend_routes.sql` — renames columns to match existing code, adds lifecycle columns, extends status CHECK, adds route_audit_log

### Server
- `server/routes/adminRoutes.ts` — new endpoints: approve, publish, rebuild, stop PATCH, complete, employee routes/today
- `server/index.ts` — also mounts adminRoutesRouter at `/api/employee` for the employee route endpoint

### Client
- `client/pages/employee/Route.tsx` — employee today's route view (NEW)
- `client/pages/admin/RoutePlanning.tsx` — approve/publish workflow added
- `client/pages/employee/AssignmentDetail.tsx` — onboarding 403 blocking screen
- `client/App.tsx` — /employee/route added
- `client/pages/employee/EmployeeLayout.tsx` — "Today's Route" nav added

## Files Changed

| File | Type |
|------|------|
| `db/migrations/2026-05-31_extend_routes.sql` | NEW |
| `server/routes/adminRoutes.ts` | MODIFIED (add 6 endpoints) |
| `server/index.ts` | MODIFIED (mount for employee routes) |
| `client/pages/employee/Route.tsx` | NEW |
| `client/pages/admin/RoutePlanning.tsx` | MODIFIED (approve/publish) |
| `client/pages/employee/AssignmentDetail.tsx` | MODIFIED (onboarding 403 UX) |
| `client/App.tsx` | MODIFIED (/employee/route) |
| `client/pages/employee/EmployeeLayout.tsx` | MODIFIED (nav item) |

## Migration Required
Run `db/migrations/2026-05-31_extend_routes.sql` in Supabase SQL Editor.
This migration renames `route_date→date`, `seq→sequence_number`, `eta→arrival_eta` and adds missing columns.
