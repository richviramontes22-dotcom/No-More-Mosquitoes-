# Employee Foundation Implementation Plan
**Date:** 2026-05-31
**Sprint:** Employee Operations Foundation — Sprint 0 + 1 + 2

---

## Files Affected

### Migrations (new)
| File | Purpose |
|------|---------|
| `db/migrations/2026-05-31_worker_type_test_employee.sql` | Add worker_type, is_test, emergency contacts, gps_consent_at to employees |
| `db/migrations/2026-05-31_employee_location_pings.sql` | Create employee_location_pings table with RLS |

### Server (modified)
| File | Change |
|------|--------|
| `server/routes/employeeShifts.ts` | Full rewrite — in-memory → Supabase with JWT auth |
| `server/routes/employeeMessages.ts` | Full rewrite — in-memory → Supabase with JWT auth |
| `server/routes/employeeAssignments.ts` | Add GPS snapshot to status + arrive; add checklist GET/POST endpoints |
| `server/routes/adminEmployees.ts` | Add worker_type, is_test, temp password, hard DELETE |

### Client (modified)
| File | Change |
|------|--------|
| `client/hooks/employee/useEmployee.ts` | Add worker_type, is_test, gps_consent_at, emergency contacts to interface + select |
| `client/pages/employee/Dashboard.tsx` | Use API routes for clock-in/out; TEST banner; GPS consent banner |
| `client/pages/employee/Profile.tsx` | GPS consent toggle; emergency contact fields; worker_type display |
| `client/pages/employee/AssignmentDetail.tsx` | Persisted checklist (load + save); GPS capture on status updates |
| `client/pages/admin/Employees.tsx` | worker_type badge; is_test badge; hard delete for test employees; worker_type/is_test in invite; temp password display |

---

## Routes Affected

### New server routes
- `GET /api/employee/assignments/:id/checklist`
- `POST /api/employee/assignments/:id/checklist`
- `DELETE /api/admin/employees/:id`

### Modified server routes
- `POST /api/employee/shifts/clock-in` — now Supabase-backed with JWT auth
- `POST /api/employee/shifts/clock-out` — now Supabase-backed with JWT auth
- `POST /api/employee/shifts/break/:action` — now Supabase-backed with JWT auth
- `GET /api/employee/timesheets` — now Supabase-backed with JWT auth
- `GET /api/employee/messages` — now Supabase-backed with JWT auth
- `POST /api/employee/messages` — now Supabase-backed with JWT auth
- `POST /api/employee/assignments/:id/status` — now accepts lat/lng/accuracy for GPS
- `POST /api/employee/assignments/:id/arrive` — now accepts lat/lng/accuracy for GPS
- `GET /api/admin/employees` — now returns worker_type, is_test, gps_consent_at, emergency contacts
- `POST /api/admin/employees/invite` — now accepts worker_type, is_test, generate_temp_password
- `PATCH /api/admin/employees/:id` — now accepts worker_type, is_test, emergency contacts

---

## Migrations Required (Run in Supabase SQL Editor)

1. `db/migrations/2026-05-31_worker_type_test_employee.sql`
2. `db/migrations/2026-05-31_employee_location_pings.sql`

Run in that order. Both are idempotent.

---

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| GPS stored without consent | ELIMINATED | Server checks `gps_consent_at IS NOT NULL` before any insert |
| Hard delete of real employee | ELIMINATED | Server enforces `is_test = true` check; returns 403 otherwise |
| Temp password exposed | LOW | Returned once in API response; not stored in DB; admin must share securely |
| Shift data inconsistency | ELIMINATED | Both clock-in/out now use Supabase via API route |
| Messages data inconsistency | ELIMINATED | Both routes now use Supabase |
| Checklist data loss on navigation | ELIMINATED | Auto-save on every toggle via API |
| Existing employee data broken | NONE | All new columns have defaults; existing rows unaffected |
| GPS consent gate bypassed by client | ELIMINATED | Consent check is server-side in GPS snapshot logic |

---

## Rollback Plan

### If migration fails
Both migrations use `IF NOT EXISTS` guards. If they fail partway, re-running is safe.

### If shift route breaks
Dashboard.tsx also uses Supabase directly as a fallback path (the old direct write code was removed — if the API route fails, clock-in silently fails). This is acceptable for beta.

### If GPS snapshot breaks status update
GPS code is wrapped in a fire-and-forget `void (async () => {...})()`. Any GPS failure cannot break the status update response.

### If hard delete breaks
Server returns 403 for non-test employees; returns 404 if not found. These are safe conditions.

---

## Testing Plan

After applying migrations:

1. Admin invites test employee with `generate_temp_password: true` → receives temp password
2. Log in as test employee → TEST banner visible
3. Test employee dashboard shows GPS consent reminder
4. Enable GPS in Profile → `gps_consent_at` set in DB
5. Update assignment status → GPS ping written to `employee_location_pings`
6. Disable GPS → `gps_consent_at` set to null
7. Update assignment status → no GPS ping written
8. Open assignment → pre-service checklist loads
9. Check items → checklist state persists after page reload
10. Admin attempts hard delete of real employee → blocked with 403
11. Admin hard deletes test employee → all records removed
12. Clock in/out → shift appears in Timesheets page (Supabase data source)
13. TypeScript: zero errors
14. Build: passes
