# APPOINTMENT CANCELLATION CASCADE FIX
## Generated: 2026-05-29
## Phase 1 of the Final Operational Integrity Sprint

---

## Problem Confirmed

**Audit Reference:** CASCADE_RULE_AUDIT.md Event 2, INVALID_STATE_ANALYSIS.md IS-1

When an admin canceled an appointment via `PATCH /api/admin/appointments/:id/cancel`, the `appointments.status` was set to `"canceled"` but the linked `assignments` rows were NOT updated. This left assignments in `status = "scheduled"` or other active states, meaning:
- Technicians would drive to canceled jobs
- Employee portal showed jobs that shouldn't be done
- Invalid state IS-1 could be created: `canceled` appointment + `scheduled` assignment

---

## Fix Implemented

**File modified:** `server/routes/adminAppointments.ts`

After the appointment is successfully set to `"canceled"`, the cancel handler now:

1. Queries for any linked assignments NOT already in a terminal state (`completed`, `skipped`, `no_show`, `canceled`, `cancelled`).
2. Updates those assignments to `status = "skipped"` in a single bulk update call.
3. Logs the employee IDs that should be notified (console only — no email template exists yet for employee cancellation notification).
4. The entire cascade block is wrapped in try/catch and is **non-fatal** — if the cascade fails, the appointment cancellation response still returns 200.

---

## Code Change Summary

```typescript
// Cancel linked assignments — skip any that are already in a terminal state.
// Non-fatal: a failure here does not roll back the appointment cancellation.
try {
  const { data: linkedAssignments } = await db
    .from("assignments")
    .select("id, status, employee_id")
    .eq("appointment_id", id)
    .not("status", "in", '("completed","skipped","no_show","canceled","cancelled")');

  if (linkedAssignments && linkedAssignments.length > 0) {
    await db
      .from("assignments")
      .update({ status: "skipped" })
      .eq("appointment_id", id)
      .not("status", "in", '("completed","skipped","no_show","canceled","cancelled")');

    console.log(`[AdminAppointments] Skipped ${linkedAssignments.length} assignment(s) for canceled appointment ${id}`);

    // Log employee notification intent — future enhancement: send email to each employee.
    for (const asgn of linkedAssignments) {
      console.log(`[AdminAppointments] Employee ${asgn.employee_id ?? "unassigned"} should be notified...`);
    }
  }
} catch (cascadeErr: any) {
  console.error("[AdminAppointments] Assignment cascade failed (non-fatal):", cascadeErr.message);
}
```

---

## Design Decisions

**notification_log not used for employee notification:** The `notification_log` CHECK constraint only allows channels `('email', 'sms', 'push')` — not `'internal'`. The status check only allows `('pending', 'sent', 'failed', 'skipped')` — not `'logged'`. Inserting with `channel: "internal"` would violate the CHECK constraint and fail silently. Console logging is used instead. A future sprint can add an employee cancellation email template.

**updated_at not included in assignment update:** The `assignments` table does not have an `updated_at` column (confirmed by reading all migrations). Including it would cause a DB error.

**Idempotent:** The NOT IN guard prevents double-skipping if the route is called twice for the same appointment.

---

## Verification Query (run in Supabase SQL Editor after testing)

```sql
-- IS-1: Canceled appointments with active assignments — should return 0 rows after fix
SELECT
  a.id AS assignment_id, a.status AS assignment_status,
  ap.id AS appointment_id, ap.status AS appointment_status
FROM public.assignments a
JOIN public.appointments ap ON a.appointment_id = ap.id
WHERE ap.status IN ('canceled', 'cancelled')
  AND a.status NOT IN ('canceled', 'cancelled', 'skipped', 'completed', 'no_show');
```

---

## Migration Required

None. Uses existing `assignments` table with its existing `status` CHECK constraint.

---

## Rollback

Remove the `try { ... } catch` block added after the `cancelErr` guard in `adminAppointments.ts`. No DB changes to reverse.
