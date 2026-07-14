-- Migration: 2026-07-13_create_promotional_popups.sql
-- Creates the promotional_popups table for admin-managed customer-facing promotional popups.
-- Apply in Supabase SQL Editor.

create table if not exists promotional_popups (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  subtitle         text,
  body             text,
  image_url        text,
  cta_label        text,
  cta_url          text,
  secondary_label  text,
  secondary_url    text,
  audience         text not null default 'all'
                   check (audience in ('all', 'public', 'customers', 'logged_in', 'logged_out')),
  page_target      text not null default 'all'
                   check (page_target in ('all', 'home', 'pricing', 'services', 'marketplace', 'dashboard', 'custom')),
  custom_path      text,
  start_at         timestamptz,
  end_at           timestamptz,
  active           boolean not null default true,
  frequency        text not null default 'once_per_session'
                   check (frequency in ('once_per_session', 'once_per_day', 'always')),
  priority         integer not null default 10,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Index for the public active-popup query (date-range + active flag)
create index if not exists promotional_popups_active_idx
  on promotional_popups (active, start_at, end_at, priority desc);

-- Auto-update updated_at on row change
create or replace function promotional_popups_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_promotional_popups_updated_at on promotional_popups;
create trigger set_promotional_popups_updated_at
  before update on promotional_popups
  for each row execute function promotional_popups_set_updated_at();

-- RLS
alter table promotional_popups enable row level security;

-- Public/anon: read only rows that are active and currently within their date window.
-- Inactive, future, expired, or draft rows are never visible publicly.
create policy "promotional_popups_public_read" on promotional_popups
  for select
  to anon, authenticated
  using (
    active = true
    and (start_at is null or start_at <= now())
    and (end_at   is null or end_at   >= now())
  );

-- Admin (service role): full access for management
create policy "promotional_popups_admin_all" on promotional_popups
  for all
  to service_role
  using (true)
  with check (true);
