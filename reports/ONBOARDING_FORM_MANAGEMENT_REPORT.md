# Phase 4 — Onboarding Form Management System Report
**Date:** 2026-05-31
**Project:** No More Mosquitoes — Employee Operations Sprint

---

## Overview

This report designs the onboarding form management system. No such system currently exists. This is a greenfield implementation.

The system has two actors:
- **Admin:** Creates, versions, assigns, and tracks forms
- **Employee:** Views, acknowledges, and uploads required documents

---

## Database Schema

### `onboarding_forms`
Master form registry. One row per form type (not per version).

```sql
CREATE TABLE onboarding_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL,
  -- categories: employment_agreement, safety, chemical_handling,
  --   vehicle_policy, gps_consent, equipment_policy, media_policy,
  --   workers_comp, background_check, arbitration, nda, handbook,
  --   contractor_agreement, custom
  form_type text NOT NULL DEFAULT 'acknowledgment',
  -- types: acknowledgment (text + checkbox), upload_required (employee uploads doc),
  --   pdf_view (admin uploads PDF, employee confirms read)
  required_for text[] DEFAULT '{}',
  -- array of worker_types that must complete this: ['employee', 'contractor']
  required_roles text[] DEFAULT '{}',
  -- array of roles: ['technician', 'dispatcher'] — empty = all roles
  is_required boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### `onboarding_form_versions`
Versioned content for each form. When content changes, a new version is created; the old version is preserved for audit.

```sql
CREATE TABLE onboarding_form_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES onboarding_forms(id) ON DELETE CASCADE,
  version_number int NOT NULL,
  title text NOT NULL,
  body_text text,
  -- full acknowledgment text the employee reads
  acknowledgment_statement text,
  -- the specific line the employee confirms: "I have read and agree to..."
  document_url text,
  -- Supabase Storage URL for uploaded PDFs
  document_filename text,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  is_current boolean DEFAULT true,
  -- only one version per form should be current=true
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (form_id, version_number)
);
```

### `employee_onboarding_assignments`
Which form versions each employee must complete.

```sql
CREATE TABLE employee_onboarding_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  form_version_id uuid NOT NULL REFERENCES onboarding_form_versions(id),
  form_id uuid NOT NULL REFERENCES onboarding_forms(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'skipped', 'reassigned')),
  assigned_at timestamptz DEFAULT now(),
  due_date date,
  completed_at timestamptz,
  skipped_reason text,
  assigned_by uuid REFERENCES auth.users(id),
  UNIQUE (employee_id, form_version_id)
);
```

### `employee_form_signatures`
Audit record for each completed acknowledgment. Immutable once written.

```sql
CREATE TABLE employee_form_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  form_id uuid NOT NULL REFERENCES onboarding_forms(id),
  form_version_id uuid NOT NULL REFERENCES onboarding_form_versions(id),
  assignment_id uuid REFERENCES employee_onboarding_assignments(id),
  signature_text text,
  -- typed name: "I, [typed full name], acknowledge..."
  checkbox_acknowledged boolean NOT NULL DEFAULT false,
  acknowledgment_statement text NOT NULL,
  -- snapshot of the exact statement agreed to (never changes)
  ip_address inet,
  user_agent text,
  device_fingerprint text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  -- no updates allowed after insert
  CONSTRAINT no_duplicate_signature UNIQUE (employee_id, form_version_id)
);
```

### `employee_document_uploads`
Employee-uploaded documents (I-9 photos, certificates, etc.).

```sql
CREATE TABLE employee_document_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  form_id uuid REFERENCES onboarding_forms(id),
  document_type text NOT NULL,
  -- 'i9_id_front', 'i9_id_back', 'drivers_license', 'insurance_cert', 'custom'
  document_url text NOT NULL,
  filename text,
  file_size_bytes int,
  uploaded_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  review_status text DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected')),
  review_notes text
);
```

### `onboarding_audit_log`
Append-only audit trail. Every action by admin or employee is recorded.

```sql
CREATE TABLE onboarding_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id),
  actor_role text,
  action text NOT NULL,
  -- 'form_created', 'form_updated', 'version_created', 'version_activated',
  -- 'form_assigned', 'form_signed', 'form_skipped', 'document_uploaded',
  -- 'document_approved', 'document_rejected', 'onboarding_approved'
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
```

---

## Admin Capabilities

### Form Management
- Create new form with name, category, description, worker types, roles
- Upload PDF to Supabase Storage (storage bucket: `onboarding-documents`)
- Create new version when content changes (old version preserved)
- Mark form active/inactive
- Preview form as employee would see it
- See all employees and their completion status per form

### Assignment Management
- Auto-assign forms to employees at invite time based on worker_type + role
- Manually assign specific form versions to individual employees
- Reassign updated versions when a form changes (status → 'reassigned')
- View per-employee completion: N of X forms completed

### Records
- Export signed acknowledgment records (CSV with: name, email, form, version, signed_at, ip_address)
- View individual signature details (statement snapshot, timestamp, IP)
- Approve/reject uploaded documents with notes
- Mark overall onboarding as admin-approved

---

## Employee Capabilities

### Onboarding View
- Banner on dashboard: "You have N documents to complete"
- `/employee/onboarding` page: list of pending forms with status indicators
- Progress bar: X of Y completed

### Completing a Form

**Type: acknowledgment**
1. Employee reads full body text
2. Employee checks "I have read and understand this document"
3. Employee types their full name (typed signature)
4. Employee clicks "I Acknowledge and Sign"
5. System captures: signed_at, ip_address (server-side), user_agent, typed name
6. Record inserted to `employee_form_signatures`
7. `employee_onboarding_assignments` status → 'completed'

**Type: pdf_view**
1. Employee views embedded PDF (or opens in new tab)
2. Employee checks acknowledgment checkbox
3. Employee types full name
4. Employee submits
5. Same signature capture as above

**Type: upload_required**
1. Employee sees document type required (e.g., "Driver's License")
2. Employee uploads file via camera or file picker
3. File stored to Supabase Storage under `employee-documents/{employee_id}/`
4. Record inserted to `employee_document_uploads`
5. Admin notified for review

### Onboarding Status Display
- Pending forms: listed with due date if set
- Completed forms: green check with signed date
- Upload-required forms: show review status (pending/approved/rejected)
- Rejected documents: red badge with admin notes, option to re-upload

---

## Server Routes Required

```
GET  /api/employee/onboarding           — list assigned forms and status
GET  /api/employee/onboarding/:assignmentId — form detail with content
POST /api/employee/onboarding/:assignmentId/sign — submit acknowledgment
POST /api/employee/onboarding/:assignmentId/upload — upload document

GET  /api/admin/onboarding/forms              — list all forms
POST /api/admin/onboarding/forms              — create form
GET  /api/admin/onboarding/forms/:id          — form detail
PATCH /api/admin/onboarding/forms/:id         — update form metadata
POST /api/admin/onboarding/forms/:id/versions — create new version
GET  /api/admin/onboarding/employees/:employeeId — employee onboarding status
POST /api/admin/onboarding/assign             — assign forms to employee
GET  /api/admin/onboarding/signatures         — export signed records
PATCH /api/admin/onboarding/uploads/:id/review — approve/reject document
POST /api/admin/onboarding/employees/:employeeId/approve — mark admin-approved
```

---

## Implementation Notes

### IP Address Capture
The server must capture `req.ip` (or `req.headers['x-forwarded-for']` on Netlify) — never trust the client to self-report its IP.

### Signature Immutability
`employee_form_signatures` rows must NEVER be updated. If re-acknowledgment is needed (e.g., form updated), a new row with the new version_id is inserted.

### Storage Bucket Policy
- `onboarding-documents` bucket: admin-write, employee-read (for assigned forms)
- `employee-documents` bucket: employee-write (own folder only), admin-read

### Supabase RLS
Employee should only see their own onboarding assignments and signatures. Admin should see all.

---

## Checklist: What to Build First

- [ ] Database migrations for 5 new tables
- [ ] Supabase storage buckets (onboarding-documents, employee-documents)
- [ ] `POST /api/admin/onboarding/forms` — create form
- [ ] `POST /api/admin/onboarding/forms/:id/versions` — add version + upload PDF
- [ ] Auto-assign on employee invite (in adminEmployees.ts)
- [ ] `GET /api/employee/onboarding` — list pending
- [ ] Employee onboarding page UI
- [ ] `POST /api/employee/onboarding/:id/sign` — capture signature with IP
- [ ] Admin onboarding dashboard (who signed what)
- [ ] Document upload + review flow (Phase 2)
- [ ] Export (Phase 2)
