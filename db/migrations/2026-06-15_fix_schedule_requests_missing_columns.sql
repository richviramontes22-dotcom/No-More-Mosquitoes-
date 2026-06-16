-- Migration: 2026-06-15_fix_schedule_requests_missing_columns.sql
--
-- Context: server/routes/schedule.ts (introduced commit d83cd9a, 2026-06-08)
-- inserts city, state, acreage, and notes into schedule_requests, but the
-- production table was created without those columns. Every /api/schedule POST
-- has failed its INSERT since that commit (console.error logged, 0 rows in
-- prod table). This also blocks CRM Phase 1's upsertLeadFromScheduleRequest
-- (gated on if (data?.id)) from ever firing in production.
--
-- Safe to apply: all four columns are nullable with no default, so existing
-- rows are unaffected. IF NOT EXISTS guards make this idempotent.

ALTER TABLE public.schedule_requests
  ADD COLUMN IF NOT EXISTS city    text,
  ADD COLUMN IF NOT EXISTS state   text,
  ADD COLUMN IF NOT EXISTS acreage numeric(10, 2),
  ADD COLUMN IF NOT EXISTS notes   text;
