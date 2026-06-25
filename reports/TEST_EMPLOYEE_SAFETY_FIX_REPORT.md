# Test Employee Safety Fix Report
**Date:** 2026-05-31

## Gaps Fixed in This Sprint

### 1. Customer Notification Suppression (FIXED)

**Problem:** When a test employee completed an assignment, the server sent a "service_completed" email to the linked customer. If a test employee was assigned to a real customer's appointment during testing, that customer would receive an unexpected email.

**Fix in `server/routes/employeeAssignments.ts`:**

```typescript
// Before:
if (status === "completed") {

// After:
if (status === "completed" && !actor.isTest) {
```

Same fix applied to the en_route fallback email:
```typescript
// Before:
if (status === "en_route" && (updated as any)?.appointment_id) {

// After:
if (status === "en_route" && (updated as any)?.appointment_id && !actor.isTest) {
```

**Effect:** Test employees completing assignments do NOT trigger any customer-facing email or SMS. Admin alerts for no_show/skipped/completed still fire (tagged with test employee metadata via admin notification service).

### 2. `getAuthenticatedEmployee` Updated

The auth helper now returns `isTest` flag:
```typescript
return { userId: user.id, employeeId: emp.id, isTest: (emp as any).is_test ?? false };
```

This flag is available throughout the assignments route and used for:
- Notification suppression
- Blocking form bypass (test employees skip blocking check)
- GPS source tagging (already implemented in prior sprint)

### 3. Blocking Form Check Skipped for Test Employees

```typescript
if (!actor.isTest) {
  // Check for blocking incomplete onboarding forms
  ...
}
```

Test employees can access assignment detail pages even if blocking forms are not signed. This allows testing the assignment workflow without requiring full onboarding.

## Remaining Gaps (Not Yet Fixed)

| Gap | Status | Notes |
|-----|--------|-------|
| PII masking in assignment responses | NOT fixed | Admin must use test fixture appointments with dummy customer data |
| Admin alert tagging with `[TEST]` subject | NOT fixed | Admin alerts still fire with regular subjects for test employees |
| Test employee filter in notification_log | NOT fixed | Notification logs from test employees not distinguished |

## Recommended Practice

**Until PII masking is added:** When testing, admin should create test appointments linked to a test customer profile (e.g., a dummy email/phone), not real customer appointments. This prevents any PII exposure without requiring server-side masking.

**Test customer setup:** In admin, create a customer with email `test@internal.example.com` and phone `(555) 000-0000`. Link test appointments to this customer for all test employee testing.
