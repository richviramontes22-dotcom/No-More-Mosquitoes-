# GPS Onboarding Consent Integration Report
**Date:** 2026-05-31

## Integration Design

GPS consent is now integrated with the onboarding form system while keeping the Profile page toggle as a convenience shortcut.

## How They Work Together

### Path 1: Onboarding Form (formal, recommended for production)
1. Admin creates a form with `category = 'gps_consent'`
2. Form is auto-assigned to employees on invite
3. Employee signs via `/employee/onboarding`
4. Server sees `category === 'gps_consent'` and sets:
   - `employees.gps_consent_at = now()`
   - `employees.gps_consent_form_version_id = form_version_id`
5. GPS tracking is now enabled with a complete audit trail:
   - Employee name, ID, signed_at (server timestamp)
   - IP address (server-captured)
   - User agent (server-captured)
   - Snapshot of the exact acknowledgment statement
   - Form version that was signed

### Path 2: Profile Toggle (simple, for early testing)
- Employee enables GPS from Profile page
- Sets `gps_consent_at = now()` via direct Supabase write
- No IP/user-agent captured — not suitable for legal compliance
- Suitable for internal testing and development

**Production recommendation:** Use Path 1 (onboarding form) for all real employees. The profile toggle is acceptable for test employees and development.

## GPS Consent Form Withdrawal

When employee disables GPS from Profile page, the server calls `POST /api/employee/onboarding/consent/withdraw`:
- Sets `gps_consent_at = null`
- Sets `gps_consent_form_version_id = null`
- Writes to `onboarding_audit_log`:
  - `action = 'consent_withdrawn'`
  - `entity_type = 'employee'`
  - `metadata = { type: 'gps_consent', is_test: bool }`

This provides an audit trail of consent withdrawal — the original signature record is preserved.

## `gps_consent_form_version_id`

New column added to `employees` table. When GPS consent is captured via the onboarding form:
- This column is set to the `form_version_id` that was signed
- Links to the exact document version the employee consented to
- Useful for compliance: "on what version of the GPS policy did this employee consent?"

## Employee Location Ping Linkage

In `employeeAssignments.ts`, GPS snapshots still check `employees.gps_consent_at IS NOT NULL`.
The `gps_consent_form_version_id` is a separate audit field — it doesn't affect whether pings are stored.

## Status Display

On Dashboard.tsx:
- If `gps_consent_at = null`: blue banner → "Enable GPS tracking in your profile"
- If `gps_consent_at` set: green banner → "GPS tracking active"

On Profile.tsx:
- Shows consent enabled date
- Shows withdrawal button
- Shows disclosure text (marked attorney review required)

## Legal Limitations

The GPS consent form in the onboarding system provides better audit metadata than the profile toggle.
However, the **content of the disclosure itself** (the body_text and acknowledgment_statement) must be reviewed by an attorney before it is presented to real employees as a legally binding consent. The system only captures the signature — it does not validate the legal sufficiency of the text.
