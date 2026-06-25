# Onboarding Auto-Assignment Report
**Date:** 2026-05-31

## How It Works

When admin invites a new employee via `POST /api/admin/employees/invite`, the server automatically assigns all active onboarding forms that match the employee's worker_type.

## Implementation

In `server/routes/adminEmployees.ts`, after the employee row is created, a fire-and-forget async block:

1. Queries `onboarding_forms` where:
   - `is_active = true`
   - `required_for` array contains the employee's `worker_type`

2. For each matching form, finds the current active version (`is_current = true`)

3. Inserts rows into `employee_onboarding_assignments`:
   - `employee_id` = new employee's ID
   - `form_id` = form ID
   - `form_version_id` = current version ID
   - `status = 'pending'`
   - `assigned_by` = admin user ID

4. If any forms were assigned, updates `employees.onboarding_status = 'pending'`

## Behavior

- **Fire-and-forget:** Failures are logged but don't break the invite response
- **Idempotent per version:** UNIQUE constraint on (employee_id, form_version_id) prevents duplicates
- **Worker type matching:** Uses Supabase `contains()` — forms with `required_for = ['employee']` match W2 employees; forms with `required_for = ['employee','contractor']` match both
- **Role filtering:** Future enhancement — currently only worker_type is checked at auto-assign time

## Example Flow

1. Admin creates GPS Consent form with `required_for = ['employee', 'contractor']`, adds version, activates it
2. Admin invites a new W2 employee
3. Server: finds GPS Consent form (employee in required_for) → finds current version → assigns it → sets status=pending
4. Employee logs in → sees "Onboarding incomplete" banner
5. Employee goes to /employee/onboarding → sees GPS Consent form → signs it
6. Server: GPS consent form signed → sets gps_consent_at on employee → updates onboarding_status
7. Dashboard GPS consent reminder disappears

## Manual Assignment

Admin can manually assign forms to specific employees via:
`POST /api/admin/onboarding/employees/:employeeId/assign`
Body: `{ form_version_id: "...", due_date: "2026-06-15" }`

This is useful for:
- Assigning forms to existing employees when a new policy is created
- Assigning optional forms not triggered by worker_type
- Reassigning a newer version when a policy is updated

## When Forms Are Updated (New Version Created)

When admin creates a new version and activates it:
- New employees get the new version auto-assigned
- Existing employees who signed the old version are NOT automatically reassigned
- Admin must manually reassign via the assign endpoint if re-acknowledgment is needed
- Old signatures are preserved permanently

## Audit Trail

Auto-assignment does NOT write to `onboarding_audit_log` (fire-and-forget, not actor-initiated).
Manual assignments DO write to audit log with `action = 'form_assigned'`.
