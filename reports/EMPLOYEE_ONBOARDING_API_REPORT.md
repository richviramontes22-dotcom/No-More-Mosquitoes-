# Employee Onboarding API Report
**Date:** 2026-05-31
**File:** `server/routes/employeeOnboarding.ts`

---

## Overview

5 employee-facing API routes for viewing, signing, uploading, and withdrawing consent. All routes require JWT Bearer auth. Employees can only access their own records.

---

## Routes

### `GET /api/employee/onboarding`
Returns all onboarding assignments for the authenticated employee with:
- Form metadata (name, category, form_type, is_required, blocks_assignments)
- Version metadata (title, version_number, acknowledgment_statement, document_url)
- Assignment status (pending, completed, skipped, reassigned)
- Progress: `{ total, completed, percent }`
- `signed_version_ids`: map of version_id → true for already-signed versions

Client uses this to build the progress bar and form list.

### `GET /api/employee/onboarding/:assignmentId`
Returns full content for one assignment (ownership checked). Includes:
- Full form content: body_text (what employee reads), acknowledgment_statement
- existing_signature: if already signed, returns signed_at + signature_text

### `POST /api/employee/onboarding/:assignmentId/sign`

**Signature capture — all server-side:**

| Field | Source | Notes |
|-------|--------|-------|
| `employee_id` | Authenticated JWT session | Never from request body |
| `user_id` | Authenticated JWT session | Never from request body |
| `form_id` | Assignment record | Verified from DB |
| `form_version_id` | Assignment record | Verified from DB |
| `acknowledgment_statement` | DB snapshot | Exact statement from `onboarding_form_versions` — never from client |
| `signed_at` | `new Date().toISOString()` | Server timestamp — never from client |
| `ip_address` | `req.headers["x-forwarded-for"]` or `req.ip` | Server-captured — never trusted from client |
| `user_agent` | `req.headers["user-agent"]` | Server-captured |
| `signature_text` | Client body | Employee's typed full name |
| `checkbox_acknowledged` | Client body | Must be `true` — validated server-side |

**Post-sign side effects:**
- Marks `employee_onboarding_assignments.status = 'completed'`
- If `form.category === 'gps_consent'`: sets `employees.gps_consent_at` + `gps_consent_form_version_id`
- Calls `updateOnboardingStatus(employeeId)` to recalculate overall `onboarding_status`
- Writes audit log: `form_signed`

**Duplicate prevention:**
- UNIQUE constraint on (employee_id, form_version_id) in DB
- Returns 409 if already signed (server: `sigErr.code === "23505"`)

### `POST /api/employee/onboarding/:assignmentId/upload`
Uploads a document URL for a required-upload form. Ownership verified. Inserts to `employee_document_uploads` with `review_status = 'pending'`. Writes audit log: `document_uploaded`.

Note: The client is responsible for uploading the file to Supabase Storage and providing the URL. The server records the URL and metadata only.

### `POST /api/employee/onboarding/consent/withdraw`
Withdraws GPS consent. Clears `gps_consent_at` and `gps_consent_form_version_id` on the employee record. Writes audit log: `consent_withdrawn` with `metadata: { type: 'gps_consent' }`.

Original signature record is **preserved** — withdrawal is recorded separately. This allows a compliance audit to show: "employee signed consent on date X, withdrew on date Y."

---

## `updateOnboardingStatus` Helper

Called after every form signing:
1. Queries all `employee_onboarding_assignments` for the employee
2. Counts required forms (is_required = true) and how many are completed
3. Sets `employees.onboarding_status`:
   - All required complete → `completed` + sets `onboarding_completed_at`
   - Any complete but not all required → `in_progress`
   - None complete → `pending`

---

## Error Responses

| Scenario | Status | Message |
|----------|--------|---------|
| No auth header | 401 | Unauthorized |
| Employee not found/inactive | 401 | Unauthorized |
| Assignment not found or wrong employee | 404 | Assignment not found |
| Already signed | 409 | Already signed |
| Missing signature_text | 400 | signature_text required |
| checkbox_acknowledged = false | 400 | checkbox_acknowledged must be true |
| GPS withdraw server error | 500 | (logged) |
