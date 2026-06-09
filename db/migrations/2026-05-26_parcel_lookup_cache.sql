-- Parcel lookup cache for acreage estimation
-- Permanent cache — parcel boundaries change rarely.
-- PostGIS extension must be enabled in Supabase (Dashboard → Extensions → postgis).

create extension if not exists postgis;

create table if not exists parcel_lookup_cache (
  id                uuid primary key default gen_random_uuid(),
  normalized_address text not null,
  address_hash       text unique not null,
  place_id           text,
  county             text not null,
  state              text not null default 'CA',
  latitude           numeric,
  longitude          numeric,
  apn                text,
  acreage            numeric not null,
  acreage_source     text not null,  -- county_field | geometry_calculated | scag_fallback | regrid_fallback
  confidence         text not null,  -- high | medium | low
  source_url         text,
  geometry           geometry(MultiPolygon, 4326),
  raw_payload        jsonb,
  lookup_status      text not null default 'success',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  last_accessed_at   timestamptz not null default now(),
  hit_count          integer not null default 1
);

create unique index if not exists parcel_lookup_cache_address_hash_idx on parcel_lookup_cache(address_hash);
create index if not exists parcel_lookup_cache_place_id_idx       on parcel_lookup_cache(place_id) where place_id is not null;
create index if not exists parcel_lookup_cache_county_idx         on parcel_lookup_cache(county);
create index if not exists parcel_lookup_cache_created_at_idx     on parcel_lookup_cache(created_at);
create index if not exists parcel_lookup_cache_last_accessed_idx  on parcel_lookup_cache(last_accessed_at);
create index if not exists parcel_lookup_cache_geometry_idx       on parcel_lookup_cache using gist(geometry) where geometry is not null;

-- Optional: attempt log for debugging provider failures
create table if not exists parcel_lookup_attempts (
  id                uuid primary key default gen_random_uuid(),
  address_hash      text,
  normalized_address text,
  county            text,
  provider          text,
  status            text,
  error_code        text,
  latency_ms        integer,
  raw_error         jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists parcel_attempts_address_hash_idx on parcel_lookup_attempts(address_hash);
create index if not exists parcel_attempts_created_at_idx   on parcel_lookup_attempts(created_at);

-- RLS: parcel cache is read by server-role only (service_role key bypasses RLS)
alter table parcel_lookup_cache enable row level security;
alter table parcel_lookup_attempts enable row level security;
