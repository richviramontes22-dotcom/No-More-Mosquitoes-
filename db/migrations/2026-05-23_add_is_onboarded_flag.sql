-- Migration: 2026-05-23_add_is_onboarded_flag
-- Adds is_onboarded boolean to profiles.
-- Existing users default to TRUE so they are not redirected to onboarding.
-- New signups default to FALSE so they are guided through the onboarding flow.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_onboarded boolean NOT NULL DEFAULT false;

-- Backfill: treat any existing profile as already onboarded so returning
-- customers are not unexpectedly sent to the onboarding page on next login.
UPDATE public.profiles
SET    is_onboarded = true
WHERE  is_onboarded = false;

-- RLS: customers may read their own flag; only service role may write it.
-- (The existing "profiles" RLS policies already restrict reads to own row,
-- so no new policies are needed — the column inherits existing row-level security.)
