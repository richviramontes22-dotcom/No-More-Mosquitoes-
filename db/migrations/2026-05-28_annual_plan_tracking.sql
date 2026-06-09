-- ─── Annual Plan Tracking + Subscriptions Column Backfill ─────────────────────
-- Ensures all columns referenced in server code exist on the subscriptions table.
-- Also adds program column so annual plans can be distinguished from recurring.
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS throughout.

-- cadence_days — service visit interval in days (14, 21, 30, 42, or 365 for annual)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS cadence_days INTEGER;

-- program — 'subscription' | 'annual' | 'one_time'
-- annual rows use stripe_subscription_id = pi_xxx (the PaymentIntent ID)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS program TEXT;

-- last_invoice_id — Stripe invoice ID from the most recent invoice.paid event
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS last_invoice_id TEXT;

-- last_payment_at — timestamp of the most recent successful payment
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMPTZ;

-- current_period_start — start of the current billing period (mirrors Stripe)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;

-- amount_cents — most recent charge amount in cents
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS amount_cents INTEGER;

-- currency — charge currency, e.g. 'USD'
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS currency TEXT;

-- Backfill program = 'subscription' for all existing rows that have a sub_ ID
-- (annual plans will have pi_ IDs and will be set explicitly on insert)
UPDATE public.subscriptions
SET program = 'subscription'
WHERE program IS NULL
  AND stripe_subscription_id IS NOT NULL
  AND stripe_subscription_id LIKE 'sub_%';
