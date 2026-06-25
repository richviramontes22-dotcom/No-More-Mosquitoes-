# Phase 11 — Legal / Privacy / Liability Settings Report
**Date:** 2026-05-31
**Project:** No More Mosquitoes — Employee Operations Sprint

---

> **LEGAL DISCLAIMER:** This report designs a platform for managing legal disclosure documents. It does not constitute legal advice. All disclaimer text, acknowledgment statements, and legal agreements must be reviewed and approved by a qualified California employment attorney before any employee signs them.

---

## Overview

The legal disclaimer management system is the administrative control layer over the onboarding form system (Phase 4). It gives admin the ability to manage, version, and track all legal and policy documents without writing any code.

Currently, zero legal disclaimer infrastructure exists.

---

## Admin Legal Settings Page: `/admin/settings/legal`

### Document Categories to Support

| Category | Form Type | Required For | Attorney Review? |
|----------|-----------|--------------|-----------------|
| GPS/Location Tracking Consent | acknowledgment | All employees | YES — CA Labor Code |
| Employee Handbook Acknowledgment | pdf_view | W2 employees | YES |
| Safety Training Acknowledgment | acknowledgment | All field staff | YES — OSHA |
| Chemical/Pesticide Handling Acknowledgment | acknowledgment | Technicians | YES — CA DPR |
| Vehicle and Driving Policy | acknowledgment | Drivers | YES |
| Equipment Policy | acknowledgment | All field staff | Recommended |
| Photo/Video/Media Policy | acknowledgment | All employees | Recommended |
| Workers' Compensation Notice | pdf_view | W2 employees | YES — CA required |
| Background Check Authorization | upload_required | If used | YES — FCRA |
| Independent Contractor Agreement | pdf_view | Contractors | YES — AB5 risk |
| Non-Disclosure Agreement | pdf_view | As applicable | Recommended |
| Arbitration Agreement | pdf_view | If applicable | YES — PAGA carve-out required |
| Customer Property Access Disclaimer | acknowledgment | All field staff | Recommended |
| Privacy Policy Acknowledgment | acknowledgment | All users | Recommended |

---

## Document Versioning System

Documents must be versioned because:
1. Laws change (CA labor law updates frequently)
2. Company policies evolve
3. A signed v1 does not constitute agreement to v2
4. Audit records must show which version was in effect when signed

### Version Lifecycle:

```
DRAFT → ACTIVE → SUPERSEDED (when new version activated) → ARCHIVED
```

When a new version is activated:
- All employees who signed the previous version are flagged for re-acknowledgment
- Their `employee_onboarding_assignments` records get status = 'reassigned'
- They see a banner: "Policy updated — please re-acknowledge [Document Name]"
- Their prior signature record is preserved permanently

---

## Signature Capture Requirements

For any acknowledgment to have evidentiary value as an e-signature, the system must capture:

| Field | Source | Notes |
|-------|--------|-------|
| `signed_at` | Server timestamp (UTC) | Never trust client time |
| `ip_address` | `req.ip` or `x-forwarded-for` | Server-captured only |
| `user_agent` | `req.headers['user-agent']` | Browser/device fingerprint |
| `signature_text` | Employee types full name | "I, [typed name], acknowledge..." |
| `checkbox_acknowledged` | Boolean — must be true | Required |
| `acknowledgment_statement` | Snapshot of the exact statement | Never changes after capture |
| `form_version_id` | UUID of the version signed | Links to exact content |
| `employee_id` | Authenticated employee | From JWT, not from request body |

**The `employee_id` must always come from the authenticated session — never from a client-supplied parameter.**

---

## Export Format

Admin can export signed records as:

### CSV Export
```
employee_id, employee_name, employee_email, form_name, form_version, 
version_number, signed_at, ip_address, user_agent, signature_text
```

### Per-Employee Report
Download a summary per employee showing all forms signed with timestamps.

### Per-Form Report
Download all signers for a given form version — useful for annual compliance audits.

---

## GPS Tracking Consent — Special Requirements

GPS consent has additional legal weight in California. The disclosure must:

1. Be a standalone document (not buried in a handbook)
2. State clearly: "Location data will only be captured during active work assignments"
3. State clearly: "No off-duty tracking without separate explicit consent"
4. State: "You may withdraw consent at any time — this may affect your ability to complete assignments"
5. State: Retention period (e.g., "Location history is retained for 90 days")
6. State: Who has access ("Company management only — never sold or shared")

**Platform behavior after signing GPS consent:**
- `employee.gps_consent_version_id` is set to the signed version UUID
- GPS capture is enabled for that employee
- If consent is withdrawn: `employee.gps_consent_version_id` = null, GPS stops

---

## Withdrawal of Consent

Employees should be able to withdraw consent for optional items (e.g., marketing communications).
For GPS tracking, withdrawal must be possible but should trigger an admin notification.

```
POST /api/employee/consent/withdraw
{ "form_id": "...", "reason": "..." }
```

Server:
1. Creates a withdrawal record in `onboarding_audit_log`
2. Clears `gps_consent_version_id` on employee record if GPS consent
3. Sends admin alert: "Employee [name] withdrew GPS consent"
4. Does NOT delete the original signature record (audit trail preserved)

---

## Chemical / Pesticide Acknowledgment — CA-Specific

California Department of Pesticide Regulation (DPR) requirements for pesticide applicators:
- Applicators must be licensed (Qualified Applicator License or Certificate)
- Records of pesticide applications must be maintained
- Employees handling restricted pesticides need specific training
- The platform should track: training date, certification number (if applicable), acknowledgment that employee has been trained

**Platform support (not legal compliance itself):**
```sql
ALTER TABLE employees ADD COLUMN pesticide_cert_number text;
ALTER TABLE employees ADD COLUMN pesticide_cert_expiry date;
ALTER TABLE employees ADD COLUMN pesticide_training_verified_at timestamptz;
ALTER TABLE employees ADD COLUMN pesticide_training_verified_by uuid;
```

Admin uploads the required safety data sheets (SDS) and training materials as PDF form versions in the system.

---

## Admin Settings UI: Legal Tab

Located at `/admin/settings` → "Legal & Compliance" tab.

Sections:
1. **Document Library** — all forms, active/inactive status, current version
2. **Version History** — per form, all past versions, who signed each
3. **Compliance Dashboard** — per employee: % of required forms completed
4. **GPS Consent Tracker** — which employees have consented; last consent date
5. **Export Center** — download signed records by date range, form, or employee
6. **Attorney Review Checklist** — checkboxes for "reviewed by attorney on [date]" with admin notes field

---

## Immediate Compliance Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| GPS captured without consent | HIGH | Add consent gate before any location capture |
| No chemical handling acknowledgment | HIGH | Create form; require before field work |
| No worker classification on record | HIGH | Add worker_type field to employees table |
| No emergency contact | MEDIUM | Add fields to employees table |
| No workers' comp notice | HIGH (CA) | Upload PDF form; require acknowledgment at hire |
| Handbook not acknowledged | MEDIUM | Upload handbook; require at hire |
| No arbitration agreement | MEDIUM | Attorney-review required before adding |

---

## Implementation Priority

| Step | Priority | Effort |
|------|----------|--------|
| GPS consent form (gate before any tracking) | CRITICAL | Medium |
| Chemical/pesticide handling acknowledgment | CRITICAL | Medium |
| Workers' compensation notice acknowledgment | CRITICAL | Small (PDF upload + ack) |
| GPS tracking disclosure text (admin drafts, attorney reviews) | CRITICAL | Owner task |
| Safety training acknowledgment | HIGH | Medium |
| Vehicle/driving policy | HIGH | Medium |
| Equipment and media policies | MEDIUM | Small each |
| Export functionality | MEDIUM | Medium |
| Arbitration agreement | LOW | Attorney must review first |
