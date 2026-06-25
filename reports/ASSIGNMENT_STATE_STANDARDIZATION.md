# ASSIGNMENT STATE STANDARDIZATION
## Generated: 2026-05-29
## Phase 6 of the Final Operational Integrity Sprint

---

## Investigation Results

### DB CHECK Constraint (Source of Truth)

From `db/migrations/2025-11-10_employee_portal.sql` line 56:

```sql
create table if not exists assignments (
  ...
  status text check (status in ('scheduled','en_route','in_progress','completed','no_show','skipped')) default 'scheduled',
  ...
```

**Allowed values:** `scheduled`, `en_route`, `in_progress`, `completed`, `no_show`, `skipped`
**NOT allowed:** `assigned`

### Code VALID_STATUSES (Before Fix)

From `server/routes/employeeAssignments.ts` line 11 (before fix):

```typescript
const VALID_STATUSES = ["assigned", "en_route", "in_progress", "completed", "no_show", "skipped"] as const;
```

**Inconsistency confirmed:** `"assigned"` was in the code but NOT in the DB constraint.

### What Status Is Written When Creating an Assignment?

From `server/routes/adminAppointments.ts` line 230:

```typescript
const upserts = appointment_ids.map((appt_id: string) => ({
  appointment_id: appt_id,
  employee_id,
  status: "scheduled",  // ← Correct — matches DB constraint
}));
```

The admin correctly writes `"scheduled"` as the initial status. `"assigned"` was never written to the DB — only present in the validation array.

### Arrive Route Check

From `server/routes/employeeAssignments.ts` line 331 (before fix):

```typescript
if (current.status === "en_route" || current.status === "assigned") {
  update.status = "in_progress";
}
```

This guard checks for `"assigned"` as a source state. Since no production path writes `"assigned"` to the DB, this is dead code. However, it is harmless and is kept for defensive programming.

---

## Decision

**Remove `"assigned"` from `VALID_STATUSES`** — the employee cannot set an assignment to `"assigned"` via the API (which would cause a DB-level CHECK constraint violation). The DB constraint and admin write path already use `"scheduled"` correctly.

**No migration needed** — the DB CHECK constraint is already correct. Only the code validation array needed updating.

---

## Fix Implemented

**File modified:** `server/routes/employeeAssignments.ts`

```typescript
// Before:
const VALID_STATUSES = ["assigned", "en_route", "in_progress", "completed", "no_show", "skipped"] as const;

// After:
// "assigned" is intentionally excluded: it is NOT in the DB CHECK constraint
const VALID_STATUSES = ["en_route", "in_progress", "completed", "no_show", "skipped"] as const;
```

---

## Impact

- Employees calling `POST /api/employee/assignments/:id/status` with `status: "assigned"` will now receive a 400 error with a clear message.
- No previously-working functionality is broken — `"assigned"` was never successfully written to the DB anyway (DB CHECK would have rejected it).
- The arrive route's `|| current.status === "assigned"` check is kept as a defensive guard for any legacy data.

---

## Migration Required

None. The DB constraint was already correct.

---

## Rollback

Add `"assigned"` back to the VALID_STATUSES array in `employeeAssignments.ts`.
