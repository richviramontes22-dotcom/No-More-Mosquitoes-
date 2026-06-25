# Employee Shift Persistence Fix Report
**Date:** 2026-05-31

## Problem

`server/routes/employeeShifts.ts` was using an in-memory `db` object from `server/lib/memory.ts`. Clock-in and clock-out data written through these routes was lost on server restart and was invisible to the timesheets page, which reads directly from Supabase.

The Dashboard.tsx component was writing clock-in/out directly to Supabase. The API routes were effectively dead code with a separate in-memory data store.

## Fix

`server/routes/employeeShifts.ts` was completely rewritten to use Supabase (with `supabaseAdmin ?? supabase` for service-role writes).

### Key changes:

**Authentication:** Added `getAuthEmployee(req)` helper using the same JWT pattern as `employeeAssignments.ts`. The old routes accepted `employee_id` from the request body (insecure). New routes extract the authenticated employee from the Bearer JWT.

**Clock-in:**
- Checks for existing open shift today (no clock_out_at) — avoids duplicate shifts
- If already clocked in, returns existing shift with `already_clocked_in: true`
- Otherwise inserts to `shifts` table via Supabase

**Clock-out:**
- Accepts optional `shift_id` in body; falls back to finding today's open shift
- Updates `clock_out_at` on the correct shift row
- Verifies `employee_id` matches authenticated employee (ownership check)

**Timesheets:**
- Now requires JWT auth (employee can only see their own shifts)
- Queries Supabase `shifts` table with date range filters

**Break tracking:**
- Inserts to `time_events` table with proper shift ownership check

**Dashboard.tsx:**
- Updated to call `POST /api/employee/shifts/clock-in` and `POST /api/employee/shifts/clock-out` via API
- Removed direct Supabase writes (single source of truth via API)

## Result

Clock-in/out data now writes to Supabase through the API route. Timesheets read from the same Supabase table. Data is consistent and persists across server restarts.

## Files Changed
- `server/routes/employeeShifts.ts` — full rewrite
- `client/pages/employee/Dashboard.tsx` — uses API routes instead of direct Supabase
