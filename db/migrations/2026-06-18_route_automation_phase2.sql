-- ============================================================
-- Routing Intelligence Phase 2 — extend route_automation_settings
--
-- Phase 1 automation only acted on routes that already existed (approve/
-- publish). These columns add OPTIONAL, independently-toggleable automation
-- for the earlier stages (generation, Smart Optimize) and for how strict
-- publish-stage automation is allowed to be. Every new column defaults to
-- the safest value — existing manual_only behavior is completely unaffected
-- until an admin opts in to each one individually.
-- ============================================================

ALTER TABLE public.route_automation_settings
  ADD COLUMN IF NOT EXISTS auto_generate_enabled                BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_optimize_enabled                BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_generate_time                    TIME,
  ADD COLUMN IF NOT EXISTS auto_generate_days                    TEXT[],
  ADD COLUMN IF NOT EXISTS require_admin_review_before_publish   BOOLEAN     NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_full_auto_publish                BOOLEAN     NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.route_automation_settings.auto_generate_enabled IS
  'When true, the scheduled sweep calls generateDayPlan() for upcoming dates instead of requiring an admin click. Independent of mode/enabled (publish automation) — generation and publish are separate opt-ins.';
COMMENT ON COLUMN public.route_automation_settings.auto_optimize_enabled IS
  'When true, freshly auto-generated draft routes are immediately run through Smart Optimize before any approve/publish decision is made.';
COMMENT ON COLUMN public.route_automation_settings.auto_generate_time IS
  'Time of day (server/UTC) the auto-generate sweep is allowed to run. NULL means no time restriction.';
COMMENT ON COLUMN public.route_automation_settings.auto_generate_days IS
  'Day-of-week names (e.g. {monday,tuesday}) auto-generate is allowed to run on. NULL/empty means every day.';
COMMENT ON COLUMN public.route_automation_settings.require_admin_review_before_publish IS
  'Safety gate, defaults TRUE: even with mode=fully_automatic, auto-generated/auto-optimized routes stop at draft/approved and will NOT be auto-published unless this is explicitly set to FALSE.';
COMMENT ON COLUMN public.route_automation_settings.allow_full_auto_publish IS
  'Second, independent gate on top of mode + require_admin_review_before_publish: must ALSO be TRUE for autoPublishEligibleRoutes() to ever transition a route past approved. Even when true, the existing hard blockers (low confidence, mock geo, drive-cap exceeded, non-draft/approved status) still apply unconditionally.';
