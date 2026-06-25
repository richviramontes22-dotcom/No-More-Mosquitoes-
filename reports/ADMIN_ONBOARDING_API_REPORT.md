# Admin Onboarding API Report
**Date:** 2026-05-31
**File:** `server/routes/adminOnboarding.ts`

---

## Overview

12 admin-only API routes for creating, versioning, assigning, reviewing, and exporting onboarding forms. All routes require admin JWT auth via the `requireAdmin` middleware. All writes use `supabaseAdmin` (service role, bypasses RLS).

All destructive operations (deactivate, review) are soft: no records are permanently deleted.

---

## Routes

### `GET /api/admin/onboarding/forms`
Returns all onboarding forms ordered by created_at desc. Includes current version summary per form (version_number, title, is_current, effective_date).

### `POST /api/admin/onboarding/forms`
Creates a new form. Required: `name`. Optional: `description`, `category`, `form_type`, `required_for[]`, `required_roles[]`, `is_required`, `blocks_assignments`.

Writes audit log: `form_created`.

### `GET /api/admin/onboarding/forms/:id`
Returns full form detail with all versions ordered by version_number desc.

### `PATCH /api/admin/onboarding/forms/:id`
Updates form metadata (name, description, category, worker types, roles, is_required, blocks_assignments). Does NOT create a new version — content changes require a new version.

Writes audit log: `form_updated`.

### `POST /api/admin/onboarding/forms/:id/versions`
Creates a new version for an existing form. Required: `title`, `acknowledgment_statement`. Optional: `body_text`, `document_url`, `document_filename`, `effective_date`.

Version number is auto-incremented (max existing + 1). New version is NOT automatically activated — admin must call activate-version explicitly.

Writes audit log: `version_created`.

### `POST /api/admin/onboarding/forms/:id/activate-version`
Sets one version as `is_current = true` and all others as false. Required: `version_id` in body.

This is what makes a version "live" for new employee assignments. Does not retroactively change existing employee assignments — they keep the version they were assigned.

Writes audit log: `version_activated`.

### `POST /api/admin/onboarding/forms/:id/deactivate`
Sets `is_active = false` on the form. Deactivated forms are not auto-assigned to new employees. Existing assignments are preserved.

Writes audit log: `form_deactivated`.

### `GET /api/admin/onboarding/employees`
Returns all active employees with:
- onboarding_status, onboarding_completed_at, onboarding_approved_at
- forms_total (count of assigned forms)
- forms_completed (count of completed assignments)
- name + email from profiles table

### `GET /api/admin/onboarding/employees/:employeeId`
Returns full onboarding detail for one employee:
- All assignments with form + version details
- Signature records per completed assignment
- All document uploads with review status

### `POST /api/admin/onboarding/employees/:employeeId/assign`
Manually assigns a specific form version to an employee. Required: `form_version_id`. Optional: `due_date`.

Checks for existing assignment first (returns `already_assigned: true` if duplicate). Writes audit log: `form_assigned`.

### `POST /api/admin/onboarding/documents/:uploadId/review`
Approves or rejects an employee-uploaded document. Required: `status` ("approved" or "rejected"). Optional: `notes`.

If approved + linked to an assignment → marks assignment completed.

Writes audit log: `document_approved` or `document_rejected`.

### `GET /api/admin/onboarding/export/signatures`
Returns all signature records. Supports optional query filters: `form_id`, `employee_id`.

Response includes: employee_id, form_id, form_version_id, signature_text, checkbox_acknowledged, acknowledgment_statement (snapshot), ip_address, user_agent, signed_at.

Suitable for CSV export by the client or external reporting tools.

---

## Audit Logging

Every mutating action writes to `onboarding_audit_log` fire-and-forget (non-blocking):
- actor_id: admin user UUID
- actor_role: "admin"
- action: one of form_created, form_updated, version_created, version_activated, form_deactivated, form_assigned, document_approved, document_rejected
- entity_type + entity_id: affected record
- metadata: JSONB with contextual details

---

## Safety Rules

| Rule | Implementation |
|------|---------------|
| No hard deletion of forms | Only deactivate endpoint, no DELETE |
| No deletion of versions | No version DELETE endpoint |
| No deletion of signatures | No signature DELETE or UPDATE endpoint |
| Version number is append-only | Auto-incremented, never reused |
| Signature snapshot is immutable | Written once, never updated in any route |
