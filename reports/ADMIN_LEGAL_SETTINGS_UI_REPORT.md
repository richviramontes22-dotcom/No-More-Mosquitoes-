# Admin Legal Settings UI Report
**Date:** 2026-05-31
**File:** `client/pages/admin/LegalCompliance.tsx`
**Route:** `/admin/legal-compliance`
**Nav:** Admin sidebar → Workforce → Legal & Compliance

---

## Overview

New admin page for managing onboarding documents, form versions, employee progress, and document review. Replaces what would have been a buried settings tab with a dedicated, navigable page.

---

## Layout

Three tabs:
1. **Document Forms** — create and manage onboarding form templates + versions
2. **Employee Progress** — per-employee onboarding completion status
3. **Document Review** — guidance on reviewing uploaded documents

---

## Tab 1: Document Forms

### Form List
Table showing all forms with:
- Name (with "Blocking" badge if blocks_assignments = true)
- Category (human-readable label)
- Required For (worker type badges)
- Current Version (e.g., "v2")
- Status (Active / Inactive badge)
- Actions: "Add Version" button, "Deactivate" button (if active)

Clicking a row opens the Form Detail panel (right side on large screens).

### Form Detail Panel
Side panel showing:
- Form name and category
- Description
- Versions list: each shows version number, title, effective date
- "Current" green badge on active version
- "Activate" button on inactive versions

### Create Form Dialog
Fields:
- Form Name (required)
- Description
- Category (dropdown: GPS Consent, Safety Training, Chemical Handling, etc.)
- Form Type (Acknowledgment / PDF View / Document Upload)
- Required For (worker type toggle chips: W2 Employee, Contractor, Vendor, Test)
- Required checkbox
- "Block assignment access until complete" checkbox

### Add Version Dialog
Fields:
- Version Title (required) — e.g., "GPS Consent — June 2026"
- Body Text (textarea) — full text the employee reads
- Acknowledgment Statement (required) — the sentence the employee confirms
- Document URL (optional) — link to hosted PDF
- Effective Date

**Amber warning box:** "All text entered here requires attorney review before this form is assigned to real employees."

---

## Tab 2: Employee Progress

Table showing all active employees with:
- Name + email
- Worker type badge
- Onboarding status (color-coded pill: not_started=gray, pending=amber, in_progress=blue, completed=green, approved=emerald)
- Progress: "N/M forms" count
- Approved date (if admin-approved)

---

## Tab 3: Document Review

Placeholder guidance explaining that document review happens at the employee detail level (via the API). Future sprint will add a dedicated review queue here.

---

## Legal Notice Banner

Persistent amber banner at top of page:
> "Legal Notice: This system supports document management and acknowledgment tracking. All legal text, disclosures, and agreements require attorney review before use with real employees. Do not present any document here as legally sufficient without independent legal review."

---

## Admin Workflow

### Create a GPS Consent form (example):
1. Click "Create Form"
2. Name: "GPS/Location Tracking Consent"
3. Category: "GPS/Location Consent"
4. Form Type: "Acknowledgment"
5. Required For: check "W2 Employee" and "Contractor"
6. Check "Required"
7. Create → form appears in list (no version yet — not assignable)
8. Click "Add Version" on the new form
9. Title: "GPS Consent v1 — June 2026"
10. Body Text: paste draft disclosure (attorney to review)
11. Acknowledgment Statement: "I have read and understand the GPS tracking disclosure."
12. Save Version
13. Click the form row → Form Detail panel opens
14. Click "Activate" on the new version
15. Version is now current — new employee invites will auto-assign this form
