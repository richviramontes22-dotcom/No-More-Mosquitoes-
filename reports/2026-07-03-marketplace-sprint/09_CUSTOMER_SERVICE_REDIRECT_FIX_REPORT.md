# 09 — Customer Service Redirect Fix Report

**Date:** 2026-07-03

---

## Problem

`client/components/auth/RequireCustomerService.tsx` — when a user hits a CS-protected route without a valid `admin` or `customer_service` session, the redirect was:

```tsx
// Before:
return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
```

**Issue:** Customer-service users log in through `/employee/login` (the same login page as technicians and dispatchers). Sending them to `/admin/login` when their session expires:
- Lands them on an unfamiliar admin login page
- They may not know their admin login credentials (CS and admin users can be separate)
- Breaks the expected round-trip: CS user → CS route → unauthorized → back to CS login → re-auth

---

## Fix Applied

`client/components/auth/RequireCustomerService.tsx` line 40:

```tsx
// After:
return <Navigate to="/employee/login" state={{ from: location.pathname }} replace />;
```

---

## Auth Flow After Fix

| Scenario | Before | After |
|---|---|---|
| CS user, valid session | CS routes ✅ | CS routes ✅ (unchanged) |
| Admin user, valid session | Admin + CS routes ✅ | Admin + CS routes ✅ (unchanged) |
| CS user, expired session | → /admin/login ❌ | → /employee/login ✅ |
| Tech/dispatcher user, tries CS route | → /admin/login ❌ | → /employee/login ✅ |
| Unauthenticated user, tries CS route | → /admin/login ❌ | → /employee/login ✅ |

---

## Security Analysis

- The redirect change does NOT weaken the auth guard
- `ALLOWED_ROLES = new Set(["admin", "customer_service"])` is unchanged
- Admins still have full access (admin role is in `ALLOWED_ROLES`)
- Technicians, dispatchers, sales still cannot pass the guard
- The redirect only changes WHERE unauthorized users land, not WHO can pass

---

## Preserved Behavior

- `state={{ from: location.pathname }}` is preserved — `EmployeeLogin` (at `/employee/login`) already reads this to redirect back to the intended route after successful login
- Admins who land on a CS route with an expired admin session will go to `/employee/login`, authenticate there, and if their admin token is accepted, the guard will let them back through. (Admins typically use `/admin/login` but can also authenticate through `/employee/login` since auth tokens are role-agnostic.)

---

## File Changed

`client/components/auth/RequireCustomerService.tsx` — one line change (line 40)

**Verdict: ✅ Fixed**
