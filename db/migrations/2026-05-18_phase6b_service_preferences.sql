-- Phase 6B — Customer Service Preferences
-- Run in Supabase SQL Editor. Safe to run multiple times.

-- 1. service_preferences on properties — stores recurring availability preferences
--    { preferred_days_of_week: [1,2,3], preferred_windows: ["morning"], flexibility_days: 1 }
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS service_preferences jsonb;

-- 2. first_name / last_name on profiles — future-proofing; name field preserved for compatibility.
--    Populate from existing name via a DO block so this is non-destructive.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_name text;

-- Backfill first_name from the existing name column (split on first space).
-- last_name stays null for existing rows — admin can fill in as needed.
DO $$
BEGIN
  UPDATE public.profiles
  SET first_name = split_part(name, ' ', 1)
  WHERE first_name IS NULL AND name IS NOT NULL AND name <> '';
END $$;
