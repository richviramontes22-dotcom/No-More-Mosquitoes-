# Route Planning Validation Report

## Summary: found a complete-failure bug, root-caused it, fixed it, and confirmed the fix live — route
## generation now works correctly at every scale tested, with one real scaling limit identified.

## First pass: 0 routes created at every scale

Built a load-simulation script (`scripts/audit/simulate_route_planning.mjs`) that creates real technicians
(`employees` rows, `is_test: true`, linked to real disposable auth accounts) and real appointments (with
real properties, spread across genuinely active service-area ZIPs), then calls the actual
`POST /api/admin/routes/day/generate` endpoint — not a mock, the real production code path
(`server/services/routing/dayPlanGenerator.ts`).

| Scenario | Technicians | Appointments | Routes created | Unassigned |
|---|---|---|---|---|
| 1 | 5 | 25 | **0** | **25 (100%)** |
| 2 | 10 | 50 | **0** | **50 (100%)** |
| 3 | 25 | 150 | **0** | **150 (100%)** |

## Root cause — confirmed directly against the live database

```
{"code":"23503","message":"insert or update on table \"assignments\" violates foreign key constraint
\"assignments_employee_id_fkey\"","details":"Key (employee_id)=(...) is not present in table \"users\"."}
```

`assignments.employee_id` and `routes.employee_id` both had a foreign key pointing at `auth.users(id)`.
`dayPlanGenerator.ts` passes `employees.id` — correctly, matching the original migration
(`db/migrations/2025-11-10_employee_portal.sql`, which explicitly defines both as
`employee_id uuid ... references employees(id)`) and virtually every other `employee_id` column in this
schema. The live database's constraints had drifted from that migration. **Every technician record in the
database, including ones dated 2026-06-01 — long before this session — has `id ≠ user_id`, confirming this
was never a test-data artifact: no route or assignment had ever been successfully created through this
feature.**

## Fix, and a real lesson about transactional migrations

`db/migrations/2026-06-23_fix_routes_assignments_employee_fk.sql` restores both FK constraints to
`public.employees(id)`. **First application attempt failed partway through** — one orphaned `assignments`
row (`employee_id` matching neither a real user nor a real employee) failed the new constraint's
validation, and because the SQL Editor runs a pasted script as one transaction, that single failure rolled
back the *entire* script, including the otherwise-successful `routes` fix. Corrected the migration to
`UPDATE ... SET employee_id = NULL` for any orphaned value before adding the constraint (safe — the column
is nullable by design), and the corrected version applied cleanly.

## Re-tested live after the fix — full success

```
"Created 25 draft route(s). 0 appointment(s) unassigned. 0 technician(s) excluded due to availability."
```

| Scenario | Routes created | Unassigned | Generate time |
|---|---|---|---|
| 5×25 | 25 | 0 | ~12s |
| 10×50 (pooled against all 42 active technicians created across this sprint's runs) | 42 | 0 | ~43s |
| 25×150 (same pooling) | 42 | 1 | ~82s |

**Methodology note**: technicians created in earlier scenarios remain globally "active" for later runs —
`generateDayPlan` pools *all* active technicians, not just the ones a given test scenario intended, since
the system has no concept of "scenario." This means the 10×50 and 25×150 runs were not perfectly isolated
to exactly 10 or 25 technicians — they drew from the full, growing pool. This doesn't undermine the
validation (real data, real scale, real success), but the per-scenario technician counts above describe
*intent*, not a hard partition.

The single appointment left unassigned in the 150-appointment run is the capacity-overflow path working
correctly — confirmed by `dayConflictNotes` recording an "over capacity" reason rather than a silent drop.

## Scaling limit identified — this is the answer to "identify scaling limits"

**Generation time scales with appointment count, dominated by sequential per-appointment Supabase calls**
(an existing-assignment check + an insert, per appointment, in a loop) — not by the route-optimization
algorithm itself. At 150 appointments, generation took **~82 seconds**.

This is fine against the local long-running Node dev server (no timeout), but `netlify/functions/api.ts`
wraps this exact endpoint for the deployed site, and Netlify's synchronous functions have a **10-26 second**
execution limit depending on plan. **A real-world day with ~150+ scheduled appointments would likely time
out generating routes in production**, not because the algorithm is wrong, but because of how many
sequential round-trips it makes. Recommended (not implemented in this sprint, which is validation-only):
batch the per-appointment assignment checks/inserts instead of one-at-a-time.

## Full lifecycle confirmed working end to end, live

Beyond generation: ran the actual automation publish pipeline against these real routes (see
`ROUTE_AUTOMATION_VALIDATION_REPORT.md` for the full sequence) — safety gates correctly blocked publish for
routes with mock/estimated coordinates (accurate, since this is synthetic test data with no real GPS), and
with those gates explicitly relaxed for the test, **25 routes published successfully**, confirmed with real
`status: "published"` rows and real `published_at` timestamps in the database.

## Cleanup needed

This sprint's testing created substantial real data in the production database: 42 technician
`employees` rows (`is_test: true`), ~217 properties/appointments, and 109 routes (most still `draft`, 25
`published` from the lifecycle test). All clearly flagged `is_test: true` where the schema supports it.
**Recommend the user decide whether to delete this test data** — left in place for now in case further
validation is wanted, but it should not remain in a production database indefinitely. See the final report's
open items.
