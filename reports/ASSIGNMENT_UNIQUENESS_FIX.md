# ASSIGNMENT UNIQUENESS CONSTRAINT FIX
## Generated: 2026-05-29
## Phase 7 of the Final Operational Integrity Sprint

---

## Problem Confirmed

**Audit Reference:** INVALID_STATE_ANALYSIS.md IS-12

The `assignments` table has no UNIQUE constraint on `appointment_id`. The admin assignment route (`adminAppointments.ts` line 233) uses:

```typescript
const { error: upsertErr } = await db
  .from("assignments")
  .upsert(upserts, { onConflict: "appointment_id" });
```

Supabase's `.upsert()` with `onConflict` requires a UNIQUE constraint on the conflict target to work correctly. **Without this constraint, the upsert silently INSERTs a new row instead of UPDATing the existing one** — creating duplicate active assignments for the same appointment.

**Impact:** Two technicians could be assigned to the same job. Both receive notifications. Both may show up.

---

## Investigation: Existing Migrations

All migrations searched:
- `2025-11-10_employee_portal.sql`: Creates assignments table with NO unique constraint on `appointment_id`.
- `2026-05-17_phase3a_employee_persistence.sql`: Adds timestamp columns and indexes — no uniqueness.
- No other migration touches assignments uniqueness.

**Conclusion: No UNIQUE constraint exists on assignments.appointment_id.**

---

## Fix Implemented

**Migration created:** `db/migrations/2026-05-29_assignment_appointment_uniqueness.sql`

### Step 1: Clean Up Existing Duplicates

Before creating the index, the migration removes any duplicate active assignments (keeping the newest by `created_at`). This prevents `CREATE UNIQUE INDEX` from failing on existing duplicate data.

### Step 2: Partial Unique Index

```sql
CREATE UNIQUE INDEX IF NOT EXISTS assignments_appointment_id_active_unique
  ON public.assignments (appointment_id)
  WHERE status NOT IN ('completed', 'skipped', 'canceled', 'cancelled', 'no_show');
```

**Why partial?** A full UNIQUE constraint on `appointment_id` would prevent:
- Reassigning after a technician is skipped (the skipped row would block a new assignment)
- Historical records for completed jobs

A partial index (excluding terminal statuses) allows:
- Exactly one active assignment per appointment at any time
- Multiple historical assignments per appointment (for audit trail)
- The admin upsert with `onConflict: "appointment_id"` to work correctly (the conflict applies only to non-terminal rows)

---

## Deployment Risk

**Medium** — the DELETE step removes older duplicate active assignments if any exist in production. This is the correct behavior (keep newest assignment), but it should be reviewed.

Before running in production, check for duplicates:
```sql
SELECT appointment_id, COUNT(*) as count
FROM public.assignments
WHERE status NOT IN ('completed', 'skipped', 'canceled', 'cancelled', 'no_show')
GROUP BY appointment_id
HAVING COUNT(*) > 1;
```

If duplicates exist, review them manually before running the migration.

---

## Migration Required

YES — must be run in Supabase SQL Editor.

File: `db/migrations/2026-05-29_assignment_appointment_uniqueness.sql`

---

## Rollback

```sql
DROP INDEX IF EXISTS assignments_appointment_id_active_unique;
```

The deleted duplicate rows cannot be recovered, but they represent invalid state that should not exist.
