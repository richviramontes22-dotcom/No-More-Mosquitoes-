-- ─── Assignment Appointment Uniqueness Constraint ─────────────────────────────
-- Adds a partial UNIQUE index so only one NON-TERMINAL assignment can exist per
-- appointment. Terminal statuses (completed, skipped, canceled, no_show) are
-- excluded so historical assignment records are preserved and reassignment is
-- possible after skipping or no-show.
--
-- Without this index, the upsert in adminAppointments.ts (onConflict: "appointment_id")
-- silently INSERTs duplicate rows instead of UPSERTing — meaning two technicians
-- could be assigned to the same appointment simultaneously.
--
-- Audit finding: IS-12 — Multiple active assignments per appointment. Critical risk.

-- Step 1: Remove duplicate active assignments, keeping only the most recently
-- created row per appointment. This prevents the index creation from failing
-- if duplicate rows already exist in the database.

DELETE FROM public.assignments a
WHERE a.id NOT IN (
  SELECT DISTINCT ON (appointment_id) id
  FROM public.assignments
  WHERE status NOT IN ('completed', 'skipped', 'canceled', 'cancelled', 'no_show')
  ORDER BY appointment_id, created_at DESC
)
AND a.status NOT IN ('completed', 'skipped', 'canceled', 'cancelled', 'no_show');

-- Step 2: Add partial unique index on appointment_id for non-terminal assignments.
-- This allows:
--   - Multiple historical records per appointment (completed, skipped, etc.)
--   - Exactly one active assignment per appointment at any time
-- This means adminAppointments.ts onConflict: "appointment_id" will work correctly
-- for the non-terminal rows (which is the intended upsert target).

CREATE UNIQUE INDEX IF NOT EXISTS assignments_appointment_id_active_unique
  ON public.assignments (appointment_id)
  WHERE status NOT IN ('completed', 'skipped', 'canceled', 'cancelled', 'no_show');

-- ─── Verify ───────────────────────────────────────────────────────────────────
-- SELECT indexname FROM pg_indexes
-- WHERE tablename = 'assignments' AND indexname = 'assignments_appointment_id_active_unique';
-- Expected: 1 row
