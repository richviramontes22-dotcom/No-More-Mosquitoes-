# Onboarding UX Fix Report
**Date:** 2026-05-31

## Problem

When an employee tries to view assignment detail and has an incomplete blocking onboarding form, the server returns:
```json
HTTP 403
{
  "error": "Onboarding incomplete",
  "message": "Please complete required onboarding forms...",
  "blocking_forms": ["GPS/Location Tracking Consent"],
  "redirect_to": "/employee/onboarding"
}
```

Previously, the client just called `supabase.from("assignments")` directly — which bypasses the server auth check entirely. The 403 was never triggered.

## Fix

`client/pages/employee/AssignmentDetail.tsx` — `loadAssignment()` function:

Before loading assignment details from Supabase, the function now calls the API route first to check authorization:

```typescript
const authCheck = await fetch(`/api/employee/assignments/${id}`, {
  headers: { Authorization: `Bearer ${token}` },
});
if (authCheck.status === 403) {
  const body = await authCheck.json().catch(() => ({}));
  if (body.blocking_forms) {
    setBlockingForms(body.blocking_forms);
    setIsLoading(false);
    return;  // Stop — don't load assignment data
  }
}
// If 200 or other status, proceed with existing Supabase direct reads
```

## Blocking Screen

When `blockingForms` state is set (non-null), the component renders a full blocking screen instead of assignment content:

- Red "Onboarding Required" card
- List of blocking form names (from the 403 response)
- "Complete Onboarding" button → links to `/employee/onboarding`

The employee cannot see customer address, phone, or service notes until the blocking forms are signed.

## What Is NOT Blocked

- The assignments LIST (`/employee/assignments`) — employees can still see their schedule
- Non-blocking forms — only forms with `blocks_assignments = true` trigger this
- Test employees — they bypass the blocking check server-side (handled in prior sprint)

## New State Added

```typescript
const [blockingForms, setBlockingForms] = useState<string[] | null>(null);
```

`null` = no blocking (normal behavior). Non-null array = show blocking screen with form names.
