# Employee Onboarding UI Report
**Date:** 2026-05-31
**File:** `client/pages/employee/Onboarding.tsx`
**Route:** `/employee/onboarding`
**Nav:** Employee sidebar → Onboarding

---

## Overview

Single-page employee onboarding experience with inline form signing. No page navigations — selecting a form opens an inline detail view within the same page.

---

## Dashboard Integration

When `employee.onboarding_status === 'pending' || 'in_progress'`:
- Orange banner on Dashboard.tsx: "Onboarding incomplete — Required forms are waiting for your signature."
- "Complete Now" link → `/employee/onboarding`

---

## Main Onboarding Page

### Blocking Warning
If any pending forms have `blocks_assignments = true`:
- Red banner: "N required form(s) must be completed — These forms block access to assignment details until signed."

### Progress Bar
Shows X of Y forms complete with an animated progress bar. When all complete: green "All required forms complete" message.

### Form Cards
**Pending forms** — amber background:
- Form name + Required badge + Blocking badge (if applicable)
- Category label
- Due date (if set)
- Clock icon + chevron → click to open

**Completed forms** — green background:
- Form name + signed date
- Green checkmark icon → click to re-view

---

## Form Detail View (inline, replaces main content)

Back button returns to form list.

Shows:
- Category eyebrow + version title + version number
- Description (if set)
- Body text in a scrollable box (max-height 18rem)
- PDF link (if document_url set)

**If already signed:**
- Green success box: "Signed" with timestamp

**If upload_required form type:**
- "Upload Required Document" instructions
- URL input field (employee uploads file externally, pastes URL)
- "Submit Document for Review" button

**If acknowledgment or pdf_view form type:**
- Amber advisory: "This acknowledgment requires attorney review before it constitutes a legally binding agreement."
- Checkbox: "I acknowledge: [acknowledgment_statement]"
- Text input: "Type your full legal name to sign *"
- "Sign & Acknowledge" button (disabled until checkbox + name filled)
- On submit: POST to `/api/employee/onboarding/:id/sign`
- On success: refreshes onboarding list + invalidates employee query (GPS consent updates)

---

## Post-Sign Behavior

After signing:
- Toast: "Form signed — Signed at [timestamp]"
- Returns to form list
- Signed form moves to Completed section
- Progress bar updates
- If GPS consent form: Dashboard GPS banner updates (consent active)
- If all required forms now complete: onboarding status → completed

---

## States Handled

| State | Display |
|-------|---------|
| Loading | Spinner |
| No forms assigned | Empty state with "Your administrator will assign documents when ready." |
| All pending | Progress bar at 0%, all forms in Pending section |
| Mixed | Progress bar at partial %, pending + completed sections |
| All complete | Progress bar at 100%, green message, no pending section |
| Form detail — already signed | Green "Signed" box, no sign form |
| Sign request fails | Toast error message, form stays open |
| Upload form type | URL input instead of signature form |
