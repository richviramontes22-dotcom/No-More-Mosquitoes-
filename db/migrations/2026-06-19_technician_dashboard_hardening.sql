-- ============================================================
-- Technician Dashboard Hardening
--
-- Adds the one column the technician dashboard audit found genuinely
-- missing: a place for the technician to write their own notes about a
-- job (separate from appointments.notes, which is admin-entered and
-- read-only to the technician). Also used as the optional reason when a
-- technician marks a stop no_show/skipped — no new column needed for
-- that, since "blocked access" already exists as a valid assignment
-- status, only the UI action was missing.
-- ============================================================

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS technician_notes TEXT;
