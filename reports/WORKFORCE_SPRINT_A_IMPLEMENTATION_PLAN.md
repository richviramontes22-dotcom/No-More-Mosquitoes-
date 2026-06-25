# Workforce Sprint A — Implementation Plan
**Date:** 2026-06-01

---

## Files Affected

### New migrations
| File | Purpose |
|------|---------|
| `db/migrations/2026-06-01_workforce_sprint_a.sql` | 3 new tables + employee columns + service_areas fix |

### New server lib files
| File | Purpose |
|------|---------|
| `server/lib/technicianAvailability.ts` | `isTechnicianAvailable(techId, date)` — 8-level resolution |
| `server/lib/technicianCapacity.ts` | `getEffectiveDailyCapacity(techId, date)` — 5-level resolution |
| `server/lib/workforceValidation.ts` | `validateRouteForWorkforce()` + `validateDayPlanForWorkforce()` |

### New server routes
| File | Purpose |
|------|---------|
| `server/routes/adminWorkforce.ts` | 14 admin API endpoints for schedules, overrides, capacity, validation |

### Modified server files
| File | Change |
|------|--------|
| `server/routes/adminRoutes.ts` | Add availability + capacity imports; check blackout in day/generate; filter techs; enforce capacity; add validation gate in day/publish |
| `server/index.ts` | Register adminWorkforceRouter |

### New client pages
| File | Route |
|------|-------|
| `client/pages/admin/Workforce.tsx` | `/admin/workforce` |
| `client/pages/admin/WorkforceSchedules.tsx` | `/admin/workforce/schedules` |
| `client/pages/admin/WorkforceCapacity.tsx` | `/admin/workforce/capacity` |

### Modified client files
| File | Change |
|------|--------|
| `client/App.tsx` | Import + 3 new admin routes |
| `client/pages/admin/AdminLayout.tsx` | Add "Workforce" nav item to Workforce group |

---

## Routes Affected

New: `GET/POST/PATCH /api/admin/workforce/schedules[/:employeeId]`
New: `GET/POST/PATCH/DELETE /api/admin/workforce/overrides[/:id]`
New: `GET/POST/PATCH /api/admin/workforce/capacity[/:employeeId]`
New: `GET /api/admin/workforce/overview`
New: `GET /api/admin/workforce/validation?date=`

Modified: `POST /api/admin/routes/day/generate` — company blackout check + availability filter + per-tech capacity
Modified: `POST /api/admin/routes/day/publish` — workforce validation gate (blocks on critical)
Modified: `POST /api/admin/routes/generate` — availability check + capacity enforcement + force override

---

## Migrations Required

Run in Supabase SQL Editor:
1. `db/migrations/2026-06-01_workforce_sprint_a.sql`

This is idempotent. Previous migrations must already be applied.

---

## Risks

| Risk | Level | Mitigation |
|------|-------|------------|
| No schedule template → backward-compatible default | LOW | Service returns `available: true` with warning, not error |
| Company blackout blocks all day generation | LOW | Expected behavior; admin can remove blackout or use different date |
| Validation gate blocks publish with old routes | LOW | Only triggers on NEW publishes; existing published routes unaffected |
| `technician_time_off_requests` table missing | NONE | Wrapped in try/catch; graceful skip |

---

## Rollback Plan

- All new tables use `CREATE TABLE IF NOT EXISTS` — rollback = don't run migration
- All new server files are additive — rollback = remove imports from index.ts
- Route planner fallback: availability service returns `available: true` if all DB calls fail (backward-compatible)
- Validation gate: add `force: true` to any publish request to bypass

---

## Test Plan

1. Apply migration in Supabase
2. Admin creates technician schedule (Mon–Fri 8–5)
3. Admin creates capacity profile (max 6 stops)
4. Generate day plan → only Mon–Fri routes created; max 6 stops each
5. Set date override (unavailable) → tech excluded from that date's plan
6. Set company blackout → day generate returns 400
7. Run validation on day with capacity-exceeded route → returns critical blocker
8. Attempt publish on invalid day → blocked (without force)
9. Attempt publish with `force: true` → succeeds with audit log entry
10. Admin opens `/admin/workforce` → overview shows missing counts
11. Admin opens `/admin/workforce/schedules` → schedule grid editable
12. Admin opens `/admin/workforce/capacity` → capacity form saves
13. `npx tsc --noEmit` → zero errors
14. `pnpm build` → both pass
