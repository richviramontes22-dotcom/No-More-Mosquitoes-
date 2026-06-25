# Phase 3 — Worker Classification System Report
**Date:** 2026-05-31
**Project:** No More Mosquitoes — Employee Operations Sprint

---

> **LEGAL DISCLAIMER:** This report identifies classification options and technical requirements. It does not constitute legal advice. Classification decisions must be reviewed by a qualified California employment attorney before implementation. Misclassification carries serious penalties under CA Labor Code and PAGA.

---

## Current Classification State

The platform currently has a single worker model. All field workers are stored in the `employees` table with no legal classification field. The role column is operational only (technician/dispatcher/admin) — it does not indicate employment status.

**Risk:** GPS tracking is captured without consent. There is no distinction between how a W2 employee and an independent contractor would be handled legally, contractually, or operationally.

---

## California AB5 Classification Warning

California's AB5 law uses the ABC test for worker classification:

- **A:** The worker is free from control and direction of the hiring entity
- **B:** The worker performs work outside the usual course of the hiring entity's business
- **C:** The worker is customarily engaged in an independently established trade

**Field pest control technicians who:** use company-branded equipment, follow company service schedules, serve company customers, and represent the company brand — almost certainly fail the ABC test and **must be classified as W2 employees** in California.

Misclassification as independent contractors can result in:
- Back wages, overtime, meal/rest period penalties
- Payroll tax liability
- PAGA (Private Attorneys General Act) class action exposure
- Workers' compensation violations
- EDD audits

**Do not offer an "independent contractor" onboarding path for field technicians without attorney review.**

---

## Supported Worker Types

### Type 1: W2 Employee
**Description:** Standard employee with full employment rights under California law.

| Attribute | Value |
|-----------|-------|
| `worker_type` | `employee` |
| Onboarding packet | Full employee packet |
| Dashboard access | Full employee dashboard |
| GPS tracking | Required consent (CCPA + CA Labor Code) |
| Assignment permissions | Dispatched by admin |
| Payroll | Handled externally (Gusto, QuickBooks, etc.) |
| Platform role | technician, dispatcher |

**Required onboarding forms:**
- Offer letter / employment agreement
- Employee handbook acknowledgment
- Safety training acknowledgment
- Pesticide/chemical handling acknowledgment
- Vehicle and driving policy
- GPS/location tracking consent
- Equipment policy
- Photo/video media policy
- Workers' compensation notice (Form 1)
- Background check authorization (if applicable)
- Arbitration agreement (if applicable — attorney review required)
- Non-disclosure agreement

**Platform notes:**
- Timesheet tracking is required
- Break tracking required (CA 4-hour meal break rule)
- Overtime calculations handled externally
- W-4 and I-9 collected externally or flagged for paper process

---

### Type 2: Independent Contractor
**Description:** Only permissible for roles that genuinely satisfy AB5 ABC test. Do not use for field technicians without attorney sign-off.

| Attribute | Value |
|-----------|-------|
| `worker_type` | `contractor` |
| Onboarding packet | Contractor-specific packet |
| Dashboard access | Limited (assignments only; no timesheets) |
| GPS tracking | Consent required; may be optional depending on agreement |
| Assignment permissions | Accept/decline assignments |
| Payroll | 1099; handled externally |
| Platform role | contractor (new role) |

**Required onboarding forms:**
- Independent contractor agreement (attorney-drafted)
- Services scope and rate agreement
- GPS/location tracking consent (if applicable)
- Photo/video media policy
- NDA if applicable

**Platform notes:**
- Timesheet not required (contractors invoice separately)
- No workers' comp notice (contractors carry own insurance)
- 1099 threshold tracking is owner's responsibility

---

### Type 3: Vendor / Partner
**Description:** External business that fulfills service (e.g., subcontract route coverage).

| Attribute | Value |
|-----------|-------|
| `worker_type` | `vendor` |
| Onboarding packet | Minimal — vendor agreement only |
| Dashboard access | None or read-only assignment view |
| GPS tracking | None |
| Assignment permissions | Assigned by admin only |
| Payroll | Invoice-based; external |

---

### Type 4: Test Employee
**Description:** Admin-created account for testing the platform. Never receives real customer data unless explicitly authorized.

| Attribute | Value |
|-----------|-------|
| `worker_type` | `test` |
| Onboarding packet | Optional (for testing onboarding flow) |
| Dashboard access | Full employee dashboard |
| GPS tracking | Simulated or real with consent |
| Assignment permissions | Test assignments only |
| Payroll | None |
| Real customer data | Blocked by default |

---

## Required Database Changes

### Add to `employees` table:
```sql
ALTER TABLE employees ADD COLUMN worker_type text
  DEFAULT 'employee'
  CHECK (worker_type IN ('employee', 'contractor', 'vendor', 'test'));

ALTER TABLE employees ADD COLUMN is_test boolean DEFAULT false;

ALTER TABLE employees ADD COLUMN emergency_contact_name text;
ALTER TABLE employees ADD COLUMN emergency_contact_phone text;
ALTER TABLE employees ADD COLUMN emergency_contact_relation text;
```

### Onboarding packet assignment table:
```sql
CREATE TABLE onboarding_packets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  worker_type text NOT NULL,
  role text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

---

## Access Control by Worker Type

| Feature | employee | contractor | vendor | test |
|---------|----------|------------|--------|------|
| Full dashboard | YES | LIMITED | NO | YES |
| Timesheets | YES | NO | NO | YES |
| Job media upload | YES | YES | NO | YES |
| Messaging | YES | YES | NO | YES |
| GPS tracking | YES (consent req.) | Configurable | NO | YES (sim) |
| Route view | YES | YES | NO | YES |
| Customer contact | YES | YES | NO | NO (default) |
| Onboarding required | YES | YES | Minimal | Optional |

---

## Implementation Recommendation

1. Add `worker_type` and `is_test` columns to `employees` table — **safe, low-risk migration**
2. Default all existing employees to `worker_type = 'employee'`
3. Add `is_test = false` default for all existing
4. Build UI in admin employee management to set worker type on invite/edit
5. Show appropriate onboarding packet based on `worker_type`
6. **Do not expose contractor onboarding flow in production until attorney review complete**
7. Test employee flag must prevent any real customer PII from being sent in notifications

**Attorney Review Checkpoint:** Before any contractor onboarding is made available to real users, legal review of the contractor agreement and classification analysis is mandatory.
