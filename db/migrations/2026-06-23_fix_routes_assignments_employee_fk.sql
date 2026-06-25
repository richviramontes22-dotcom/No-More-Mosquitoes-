-- ============================================================
-- Fix routes.employee_id / assignments.employee_id foreign keys
--
-- Confirmed live (direct insert tests against the production REST API):
-- both columns currently have an FK constraint pointing at auth.users(id)
-- ("routes_employee_id_fkey" / "assignments_employee_id_fkey" both reject
-- a valid employees.id with "is not present in table users"). This breaks
-- route generation completely — dayPlanGenerator.ts (and virtually every
-- other employee_id column in this schema: technician_schedule_templates,
-- technician_capacity_profiles, shifts, employee_messages, etc.) correctly
-- treats employee_id as employees.id throughout.
--
-- The original migration that created both tables
-- (db/migrations/2025-11-10_employee_portal.sql) confirms the INTENDED
-- design always referenced employees(id) — the live schema has drifted
-- from it at some point. This migration restores the original design;
-- it does not change any application code, because the application code
-- was already written correctly for this design.
--
-- Safe to apply: assignments currently has only 6 rows, 5 of them
-- employee_id=null and the 6th an orphaned value matching neither a real
-- user nor a real employee; routes has no real (non-test) data. No
-- existing valid row references auth.users(id) in a way this would break.
--
-- UPDATE after first attempt: applying this as one transaction failed —
-- assignments has one row whose employee_id (e83b9494-5186-4ba4-9cf3-a392f78c4765)
-- is the same orphaned value identified above. It satisfied neither the old
-- (auth.users) nor the new (employees) constraint, so ADD CONSTRAINT's
-- validation pass rejected it and rolled back the whole script, including
-- the otherwise-successful routes fix. Null it out first — assignments.employee_id
-- is nullable by design (ON DELETE SET NULL), and this row is already
-- unusable stale data referencing nothing real.
-- ============================================================

UPDATE public.assignments
SET employee_id = NULL
WHERE employee_id IS NOT NULL
  AND employee_id NOT IN (SELECT id FROM public.employees);

ALTER TABLE public.routes DROP CONSTRAINT IF EXISTS routes_employee_id_fkey;
ALTER TABLE public.routes ADD CONSTRAINT routes_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS assignments_employee_id_fkey;
ALTER TABLE public.assignments ADD CONSTRAINT assignments_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;
