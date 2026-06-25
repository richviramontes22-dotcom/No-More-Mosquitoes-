# Phase 2 — Employee Onboarding Compliance Audit
**Date:** 2026-05-31
**Project:** No More Mosquitoes — Employee Operations Sprint

---

## Summary

**There is no employee onboarding system.** The profiles table has `is_onboarded` and `onboarding_progress` columns, but these were added for customer onboarding, not employees. No employee-specific onboarding pages, document workflows, signature capture, or acknowledgment tracking exist anywhere in the codebase.

---

## Current Onboarding Flow

| Step | Exists? | Notes |
|------|---------|-------|
| Admin sends invite email | YES | `adminEmployees.ts` inviteUserByEmail() |
| Employee receives email link | YES | Supabase magic link / password setup |
| Employee sets password | YES | Supabase auth |
| Employee directed to `/employee` dashboard | YES | redirect URL in invite |
| Identity verification | NO | Name from admin input only |
| Role assignment | YES | Admin sets on invite |
| Emergency contact | NO | No field exists |
| Phone/email verification | Partial | Email verified by Supabase; phone is optional field |
| Employment classification | NO | No employee vs contractor distinction |
| Onboarding checklist | NO | |
| Form completion | NO | |
| Document upload | NO | |
| E-signature | NO | |
| Consent capture | NO | |
| Legal timestamp | NO | |
| IP address capture | NO | |
| Document version tracking | NO | |
| Admin approval | NO | |

---

## Document Categories Required

The following document categories should be supported by the platform. **Do not implement legal text — build the infrastructure to upload, assign, version, and track acknowledgment of each category.**

### Required for W2 Employees
| Document | Legal Requirement | Notes |
|----------|------------------|-------|
| Offer letter / employment agreement | Strong recommendation | Not legally required but best practice |
| Employee handbook acknowledgment | Recommended | Establishes workplace policies |
| Safety training acknowledgment | OSHA-relevant | Especially important for pesticide handling |
| Chemical/pesticide handling acknowledgment | California requirement | Pesticide applicators must understand safe handling per DPR |
| Vehicle and driving policy | Recommended | Covers liability for accidents during service |
| GPS/location tracking consent | California required | CCPA + Labor Code §2929 concerns — must be explicit |
| Equipment policy acknowledgment | Recommended | Covers responsibility for tools, sprayers, PPE |
| Photo/video policy acknowledgment | Recommended | Covers job media, customer property photos |
| Workers' compensation notice | California required | DLSE Form 1 or equivalent |
| Background check authorization | If used | FCRA-compliant form required before running |
| Arbitration agreement | If used | Must be reviewed by attorney; PAGA carve-out required in CA |
| Non-disclosure / confidentiality | Recommended | Customer data and proprietary routes |

### Required for Independent Contractors (If Classified as Such)
| Document | Notes |
|----------|-------|
| Independent contractor agreement | Establishes relationship; reviewed by attorney |
| Services agreement / scope of work | Per-engagement or ongoing |
| Certificate of insurance | Contractor provides their own |
| GPS/location tracking consent | Still required even for contractors |
| Photo/video policy | Still required |
| Equipment ownership acknowledgment | Contractor uses own or rented equipment |

**CRITICAL: Do not classify pest control technicians as independent contractors without attorney review. California ABC test (AB5) makes contractor classification extremely difficult for field service workers who are integral to core business operations.**

---

## Compliance Gaps

### Immediate Gaps
1. **No onboarding acknowledgment flow** — employees receive no documents at hire
2. **No signature capture** — no way to prove employee agreed to any policy
3. **No timestamp of agreement** — no legal record of when/what was acknowledged
4. **No IP/device metadata capture** — legally significant for e-signature validity
5. **No document versioning** — cannot track when policies changed and who signed which version
6. **No GPS consent** — geolocation is captured on clock-in without explicit consent form
7. **No chemical handling acknowledgment** — California DPR requirement for pesticide operations
8. **No worker classification** — system treats all field workers identically regardless of legal status
9. **No emergency contact** — operational and safety risk
10. **No admin approval flow** — onboarding completes on first login, no review step

### Operational Gaps
1. No onboarding completion status per employee (admin can't see who finished)
2. No form assignment by role (technicians vs dispatchers need different docs)
3. No required vs optional form distinction
4. No document re-assignment when policy is updated
5. No export of signed acknowledgment records

---

## Existing Database Fields That Could Support Onboarding

| Column | Table | Current Use |
|--------|-------|-------------|
| `is_onboarded` | profiles | Customer-facing; reusable for employee |
| `onboarding_progress` | profiles | Customer-facing JSONB; reusable for employee |
| `signatures` table | — | Exists in schema, NEVER used in code |
| `job_checklists` table | — | Exists in schema, NEVER used |

---

## Required New Database Entities

See Phase 4 (Onboarding Form Management) for full schema. Summary:

- `onboarding_forms` — form definitions
- `onboarding_form_versions` — versioned content per form
- `employee_onboarding_assignments` — which forms each employee must complete
- `employee_form_signatures` — audit records: signed_at, ip_address, user_agent, signature_text
- `employee_document_uploads` — employee-uploaded documents (I-9 photos, etc.)
- `onboarding_audit_log` — every action tracked

---

## Recommendation

**Build the document management infrastructure now, populate with document categories, and require legal review of actual text before any employee signs anything.**

The platform should support:
1. Admin uploads a document (PDF or plain text acknowledgment)
2. Admin assigns document to roles (technician, dispatcher, etc.)
3. Employee sees "You have X documents to complete" on dashboard
4. Employee reads and checks "I acknowledge" with typed name
5. System records: employee_id, form_version_id, signed_at, ip_address, user_agent, acknowledgment_text
6. Admin sees per-employee completion status
7. Admin can export signed records as PDF or CSV

**Do not go live with GPS tracking, chemical handling, or vehicle operation until GPS consent and safety acknowledgment are in place.**
