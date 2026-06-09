-- ─── Property Coordinates ─────────────────────────────────────────────────────
-- Adds lat/lng to properties so the employee app can open GPS navigation.
-- Safe to re-run: ADD COLUMN IF NOT EXISTS.
--
-- Population paths (run whichever apply after the migration):
--   1. Backfill from parcel_lookup_cache (same normalized address):
--        UPDATE public.properties p
--        SET    lat = c.latitude, lng = c.longitude
--        FROM   public.parcel_lookup_cache c
--        WHERE  lower(trim(p.address)) = lower(trim(c.normalized_address))
--          AND  c.latitude IS NOT NULL
--          AND  p.lat IS NULL;
--
--   2. Going forward, the server can write lat/lng to properties when
--      a parcel lookup resolves coordinates (see confirm-booking endpoint).

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS lat  NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS lng  NUMERIC(10, 7);

CREATE INDEX IF NOT EXISTS properties_lat_lng_idx
  ON public.properties (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;
