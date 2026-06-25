# Test Employee Data Safety Report
**Date:** 2026-05-31

## TEST ACCOUNT Banner

When `employee.is_test = true`:
- Amber banner displays on Dashboard.tsx: "Test Account — This is a test account. Real customer data may be masked."
- Amber banner displays on Profile.tsx: "Test Account — settings apply to test workflows only."
- Admin employee list shows amber "TEST" badge next to employee name

## Server-Side PII Masking

Current implementation: assignment responses do NOT automatically mask customer PII for test employees. This was intentional — masking requires knowing which data is "real" customer data vs test fixture data. The admin creates test appointments with test properties, so there's no real PII at risk if the admin creates proper test data.

**Future enhancement (Phase 2):** Add server-side masking to `GET /api/employee/assignments` when `employee.is_test = true`:
```typescript
customer_name: "Test Customer",
customer_phone: "(555) 000-0000",
address: "123 Test St",
```

This is deferred because: (1) test appointments should use dummy data, (2) admin controls what data test employees see, (3) masking can be added without breaking changes.

## Notification Suppression

**GPS snapshot:** `employee_location_pings` rows for test employees have `is_test = true` so admin can filter them from real location data.

**Customer notifications:** The fire-and-forget notification code in `employeeAssignments.ts` currently does NOT check `is_test`. This means if a test employee completes an assignment linked to a real appointment, a "service completed" email could go to a real customer.

**Mitigation:** Admin must create test appointments linked to test/dummy customers, not real customer appointments. A full suppression guard can be added in a future sprint by fetching `employee.is_test` in the notification block.

## Simulated GPS

GPS snapshot code in `employeeAssignments.ts`:
```typescript
const pingSource = empData.is_test ? "simulated" : "browser";
```

Test employee GPS pings are marked `source = "simulated"` even if they come from a real device. This allows future admin views to filter out test location data.

Test employees cannot send `source = "simulated"` for real employees — the source is determined server-side from the `is_test` flag, not from the client request.

## Hard Delete Safety

Test employees can be hard-deleted (auth user, profile, employee, shifts, location pings all removed). Real employees cannot — server returns 403. This is enforced server-side and cannot be bypassed by the client.

## Summary of Safety Measures Implemented

| Safety Measure | Implemented | Notes |
|----------------|-------------|-------|
| TEST banner on dashboard | YES | Amber, prominent |
| TEST badge in admin list | YES | Amber badge next to name |
| Hard delete only for test | YES | Server enforces is_test check |
| GPS pings marked is_test | YES | `is_test` column on location_pings |
| GPS source = "simulated" for test | YES | Server-side determination |
| Customer notification suppression | NO | Deferred — use test fixtures |
| PII masking in assignment responses | NO | Deferred — use test fixtures |
