# Onboarding Access Control Report
**Date:** 2026-05-31

---

## How Blocking Forms Work

Admin sets `blocks_assignments = true` on a form in the Legal & Compliance admin page.

When an employee opens an assignment detail page (`GET /api/employee/assignments/:id`):

1. Server checks for any `employee_onboarding_assignments` where:
   - `employee_id = actor.employeeId`
   - `status = 'pending'`
   - Related form has `blocks_assignments = true`

2. If any blocking forms found:
   - Returns HTTP 403 with:
   ```json
   {
     "error": "Onboarding incomplete",
     "message": "Please complete required onboarding forms before accessing assignments.",
     "blocking_forms": ["GPS/Location Tracking Consent"],
     "redirect_to": "/employee/onboarding"
   }
   ```

3. Client (AssignmentDetail.tsx) should handle 403 and show the employee a redirect message.

---

## Test Employee Bypass

Test employees (`is_test = true`) skip the blocking check entirely:
```typescript
if (!actor.isTest) {
  // blocking form check
}
```

This allows testing the assignment workflow without needing to complete onboarding forms.

---

## Non-Blocking Forms

Forms with `blocks_assignments = false` are **reminder-only**:
- Show orange "Onboarding incomplete" banner on Dashboard
- Appear in the Pending section of /employee/onboarding
- Do NOT prevent assignment access
- Do NOT return 403

Admin should use `blocks_assignments = true` only for forms where it's operationally critical the employee has acknowledged before working (e.g., chemical handling safety, GPS consent, vehicle driving policy).

---

## Admin Control

Admin sets `blocks_assignments` per form at create time or via PATCH:
```
PATCH /api/admin/onboarding/forms/:id
{ "blocks_assignments": true }
```

The setting applies to ALL employees assigned the form. There is no per-employee override for real employees (only test employees bypass).

---

## What Is NOT Blocked

The assignment LIST (`GET /api/employee/assignments`) is not blocked — employees can still see their schedule even with incomplete blocking forms. Only the detail view (which shows customer address, phone, notes) is restricted.

This is intentional: employees should be able to see they have work today and navigate to onboarding, rather than seeing a completely empty app.

---

## Client-Side Handling

Currently, `AssignmentDetail.tsx` calls `updateStatus()` and other actions via the API. When the assignment detail endpoint returns 403 with `redirect_to`, the client should:
1. Show the blocking message
2. Provide a "Complete Onboarding" link to `/employee/onboarding`

This client-side handling is not yet implemented in AssignmentDetail.tsx — the current code would show a generic error toast. A future minor update should parse the 403 response and show a friendly redirect message.

---

## Future Enhancement: Admin Approval Gate

After all required forms are signed, admin can optionally require manual approval before full access is granted:
- `employees.onboarding_status = 'completed'` (forms all signed)
- Admin reviews and sets `onboarding_approved_at`
- `employees.onboarding_status = 'approved'`

Currently the system sets `completed` status automatically. The approved gate is not yet enforced in assignment access — it's tracked for record-keeping only.
