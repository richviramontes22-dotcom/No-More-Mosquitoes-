-- Add 'en_route' status to route_stops CHECK constraint
-- Required for route stop ↔ assignment status synchronization.
-- Idempotent — safe to re-run.

ALTER TABLE public.route_stops DROP CONSTRAINT IF EXISTS route_stops_status_check;
ALTER TABLE public.route_stops ADD CONSTRAINT route_stops_status_check
  CHECK (status IN ('pending', 'scheduled', 'en_route', 'arrived', 'skipped', 'completed'));
