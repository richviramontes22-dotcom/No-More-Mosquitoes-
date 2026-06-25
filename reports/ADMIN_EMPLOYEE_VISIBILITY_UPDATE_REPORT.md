# Admin Employee Visibility Update Report
**Date:** 2026-05-31

## API Changes

`GET /api/admin/employees` now returns additional fields per employee:

| Field | Type | Description |
|-------|------|-------------|
| `worker_type` | string | "employee" / "contractor" / "vendor" / "test" |
| `is_test` | boolean | Whether this is a test/dev account |
| `gps_consent_at` | string or null | ISO timestamp when employee enabled GPS, or null |
| `emergency_contact_name` | string or null | Emergency contact full name |
| `emergency_contact_phone` | string or null | Emergency contact phone |
| `emergency_contact_relation` | string or null | Relationship to employee |

## Admin UI Changes (Employees.tsx)

**Employee table — Name column:**
- Shows amber "TEST" badge next to name for `is_test = true` employees

**Employee table — Role column:**
- Shows operational role badge (Technician / Dispatcher / Admin) as before
- Shows secondary `worker_type` badge when not "employee" (e.g., "contractor", "vendor", "test")

**Employee table — Actions column:**
- Edit and Activate/Deactivate buttons unchanged
- **NEW:** Red "Delete" button appears only for `is_test = true` employees
- Delete triggers confirmation dialog before proceeding

**Invite dialog — new fields:**
- Worker Type select: Employee (W2) / Contractor (1099) / Vendor / Test Account
- "Mark as test account" checkbox
- "Generate temp password" checkbox (only visible when is_test checked)

**Temp password dialog:**
- Shown when `generate_temp_password: true` and creation succeeds
- Displays password in monospace with amber background
- Warning: "Save this password now — it will not be shown again."
- Closes and refreshes employee list when admin clicks "I've saved this password"

## What Admin Cannot See Yet

The following visibility items are planned for future sprints:

| Item | Status | Sprint |
|------|--------|--------|
| Latest GPS ping location per employee | Not built | Sprint 2 Phase 2 (live map) |
| Checklist completion per employee | Not built | Would require new admin endpoint |
| Assignment-level checklist view | Not built | Admin media/job detail view |
| Timesheet / shift history per employee | Not built | Admin timesheet view |
| Onboarding form completion | Not built | Sprint 3 (onboarding system) |

## GPS Consent Status

Admin can see `gps_consent_at` field in the API response. The current admin UI table does not display this column to keep the table width manageable. It is available for the edit dialog or a future "Employee Detail" page.
