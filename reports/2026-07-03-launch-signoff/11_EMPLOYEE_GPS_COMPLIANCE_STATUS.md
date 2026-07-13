# Phase 11 — Employee / GPS Compliance Status

**Date:** 2026-07-13  
**Sprint:** Production Launch Verification

---

## Current Status: CONDITIONAL — Attorney Review Pending

GPS consent collection is implemented and live in the employee portal. The legal review of
the consent disclosure text has not been confirmed completed.

---

## What Is Implemented

| Feature | Location | Status |
|---|---|---|
| GPS consent disclosure text | `client/pages/employee/Profile.tsx` | ✅ Displayed |
| "Grant Consent" button | `client/pages/employee/Profile.tsx` | ✅ Present |
| `POST /api/employee/onboarding/consent/grant` | employee routes | ✅ Live |
| `arrived_at` timestamp set on assignment `in_progress` status | `server/routes/employeeShifts.ts` | ✅ Fixed (50625f6) |
| GPS data stored per-assignment | assignments/shifts tables | ✅ |
| GPS not collected before consent | conditional in assignment flow | ✅ |
| `consent_given_at` timestamp recorded | `employee_gps_consent` or profiles table | ✅ |

---

## The Open Item: Attorney Review

The GPS consent disclosure text shown to employees before they grant consent has NOT been
reviewed by an attorney for compliance with:
- **California Labor Code** (if employees are CA-based): GPS tracking disclosure requirements
- **NLRA / NLRB guidance** on workplace monitoring
- **State-specific employee monitoring laws** (TX, FL, and others vary)

**This is required before field employees begin using the app with live GPS tracking.**

---

## Consent Disclosure Text (Current)

The text displayed to employees is in `client/pages/employee/Profile.tsx`. Review and confirm
it includes:
1. What GPS data is collected (location when on shift / assignment)
2. When it is collected (not continuously — only during active assignments)
3. Who has access (company management/admin only)
4. How long it is retained
5. That consent can be revoked (and what happens if revoked)
6. That consent is voluntary (if applicable under your jurisdiction)

---

## Recommended Action

1. Have an employment attorney (familiar with TX labor law if operations are TX-based) review
   the current consent disclosure text.
2. If changes are needed, update `client/pages/employee/Profile.tsx` (consent text section).
3. Confirm with the attorney whether existing employees who already granted consent need to
   re-consent after a text change.

---

## Launch Gate

**For the customer-facing site and admin portal:** GPS compliance is NOT a blocker.  
**For field employee rollout (employees actually using the app on route):** DO NOT roll out
to field employees until attorney review is complete.

---

## Verdict

| Check | Status |
|---|---|
| GPS consent UI + API implemented | ✅ |
| arrived_at fix applied | ✅ |
| GPS not collected pre-consent | ✅ |
| Attorney review of consent text | ❌ NOT CONFIRMED |

**Phase 11: CONDITIONAL — field employee rollout blocked pending attorney review of GPS consent disclosure.**
