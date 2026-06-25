# Employee Foundation Test Report
**Date:** 2026-05-31

## Build / Typecheck

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS — zero errors |
| `pnpm build` | PASS — client 3,451 modules, ✓ built in 15.01s; server 64 modules, ✓ built in 1.72s |

## Manual Test Checklist

### Sprint 0 — Data Integrity Fixes

| Test | Expected | Verified |
|------|----------|---------|
| Clock in via dashboard | Calls `POST /api/employee/shifts/clock-in`; shift row in Supabase `shifts` table | Code verified |
| Clock out | Calls `POST /api/employee/shifts/clock-out`; `clock_out_at` set in Supabase | Code verified |
| Timesheets page loads | Reads from Supabase `shifts` table (same as clock-in writes) | Code already used Supabase — unchanged |
| No duplicate clock-in | If already clocked in today, API returns existing shift with `already_clocked_in: true` | Code verified |
| Messages route uses Supabase | `GET /api/employee/messages?assignment_id=X` returns threads from Supabase | Code verified |
| Messages route auth | Returns 401 without Bearer JWT | Code verified |
| Checklist toggles persist | Toggle checkbox → auto-save fires → API writes to `job_checklists` | Code verified |
| Checklist reloads after navigation | Return to assignment detail → checklist items restored | Code verified |
| Checklist shows completion count | "N/6 complete" shown in header | Code verified |
| Checked items have strikethrough | CSS applied conditionally | Code verified |

### Sprint 1 — Worker Type + Test Employee

| Test | Expected | Verified |
|------|----------|---------|
| Real employee invite works | Email invite sent via Supabase, employee row created | Code unchanged from working state |
| Test employee creation (email) | is_test=true, worker_type="test" set; invite email sent | Code verified |
| Test employee creation (temp pw) | is_test=true; no email; temp password returned in response | Code verified |
| Temp password dialog appears | Admin sees password in amber dialog after creation | Code verified |
| Real employee hard delete blocked | `DELETE /api/admin/employees/:id` returns 403 when `is_test = false` | Code verified |
| Test employee hard delete | Removes: assignments.employee_id nullified, employee, profile, auth user | Code verified |
| TEST badge in admin list | Amber "TEST" badge next to name for is_test employees | Code verified |
| Worker type badge shown | Secondary badge when worker_type != "employee" | Code verified |
| Delete button only for test | PowerOff button only renders when `emp.is_test === true` | Code verified |
| Worker type in invite form | Select shows Employee/Contractor/Vendor/Test | Code verified |
| TEST banner on employee dashboard | Amber banner when `employee.is_test === true` | Code verified |
| TEST banner on employee profile | Same amber banner | Code verified |

### Sprint 2 — GPS Consent + Snapshot Tracking

| Test | Expected | Verified |
|------|----------|---------|
| GPS banner shows when not consented | Blue banner on dashboard with Profile link | Code verified |
| GPS active banner shows when consented | Green banner on dashboard | Code verified |
| GPS enable in Profile | Sets `gps_consent_at = now()` on employees table | Code verified |
| GPS disable in Profile | Sets `gps_consent_at = null` | Code verified |
| GPS card shows enabled state | Green card with date when active | Code verified |
| GPS card shows disclosure | Amber warning box with attorney review note | Code verified |
| Status update without GPS consent | Status updates normally; no ping in location_pings | Code verified (server check) |
| Status update with GPS consent | Ping inserted to `employee_location_pings`; geo_arrive/geo_complete updated | Code verified |
| GPS browser denied | Status update succeeds; no ping inserted (client returns null) | Code verified |
| GPS timeout | Same as denied — 6-second timeout, then null | Code verified |
| Test employee GPS marked simulated | `source = "simulated"` for is_test employees | Code verified |
| Real employee GPS marked browser | `source = "browser"` for real employees | Code verified |
| GPS cannot block status update | GPS block is fire-and-forget; any failure is logged, not propagated | Code verified |

### Regression Tests

| Test | Expected | Verified |
|------|----------|---------|
| Assignment list loads | Unchanged | Code unchanged |
| Status buttons work (en route/arrive/complete) | Unchanged behavior + GPS attempt | Code verified |
| Navigation deep links | Unchanged | Code unchanged |
| Job media upload | Unchanged | Code unchanged |
| Admin assignment dispatch | Unchanged | Code unchanged |
| Customer notifications on completion | Unchanged | Code unchanged (no is_test guard yet) |
| Admin alerts on no_show/skipped | Unchanged | Code unchanged |

## Known Gaps (Not Blocking Beta)

1. **Notification suppression for test employees** — Not implemented. Admin must create test appointments with dummy customers to avoid sending real emails.
2. **PII masking in assignment responses** — Not implemented. Use test fixture data.
3. **GPS consent in formal onboarding system** — Current implementation uses profile-level toggle; formal e-signature + IP capture deferred to Sprint 3.
4. **`gps_consent_at` not shown in admin UI table** — Available in API; not displayed to keep table manageable.
5. **Continuous GPS tracking** — Not implemented; snapshot only.
