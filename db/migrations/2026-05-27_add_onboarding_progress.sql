-- Adds onboarding_progress column to profiles so the scheduling flow can be
-- resumed from any device, not just the browser where it was started.
-- Stored as JSONB matching the FlowProgressState shape from client/lib/flowProgress.ts.
-- Cleared (set to NULL) on successful booking via /api/billing/confirm-booking.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_progress jsonb DEFAULT NULL;

-- Customers can update their own onboarding_progress (existing row-level UPDATE
-- policy on profiles already covers this column — no new policy needed).
