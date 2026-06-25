# Phase 11 — Notification Log and Alert Audit Report
**Date:** 2026-05-30
**Sprint:** Production Verification & Operational Readiness Sprint

---

## Summary

Cross-referenced the TypeScript `NotificationType` union in `notificationLogger.ts` against all DB migration CHECK constraints. Also verified the admin_alerts schema uses free-form TEXT for event_type (no DB constraint needed).

---

## TypeScript NotificationType Union (from notificationLogger.ts)

```typescript
export type NotificationType =
  | "appointment_confirmation"
  | "reminder_24h"
  | "reminder_same_day"
  | "appointment_canceled"
  | "appointment_rescheduled"
  | "technician_enroute"
  | "technician_en_route"
  | "service_completed"
  | "appointment_canceled_employee"
  | "appointment_canceled_customer"
  | "scheduling_failure"
  | "payment_failed"
  | "subscription_activated"
  | "subscription_renewed"
  | "subscription_canceled"
  | "annual_expiring_30d"
  | "annual_expiring_7d"
  | "annual_expired"
  | "appointment_reminder_24h"
  | "appointment_reminder_same_day"
  | "lead_acknowledgement"
  | "sms_opt_out"
  | "sms_opt_in"
  | "email_opted_out"
  | "employee_assignment_created"
  | "employee_assignment_cancelled"
  | "employee_assignment_updated"
  | "logged";
```

**Total types in TypeScript union: 27**

---

## Final DB CHECK Constraint (from `2026-05-30_notification_phase2_types.sql`)

This is the final migration and contains the complete constraint. Values in constraint:

```
'appointment_confirmation', 'reminder_24h', 'reminder_same_day', 'appointment_canceled',
'appointment_rescheduled', 'technician_enroute', 'service_completed',
'appointment_canceled_employee', 'appointment_canceled_customer', 'scheduling_failure',
'payment_failed', 'subscription_canceled', 'logged', 'subscription_activated',
'subscription_renewed', 'annual_expiring_30d', 'annual_expiring_7d', 'annual_expired',
'appointment_reminder_24h', 'appointment_reminder_same_day', 'technician_en_route',
'lead_acknowledgement', 'sms_opt_out', 'sms_opt_in', 'employee_assignment_created',
'employee_assignment_cancelled', 'employee_assignment_updated', 'email_opted_out'
```

**Total types in DB constraint: 28**

---

## Cross-Reference Analysis

### Types in TypeScript Union but NOT in DB Constraint

Checking each TypeScript type against the DB constraint:

| TypeScript Type | In DB Constraint | Risk |
|----------------|-----------------|------|
| appointment_confirmation | YES | None |
| reminder_24h | YES | None |
| reminder_same_day | YES | None |
| appointment_canceled | YES | None |
| appointment_rescheduled | YES | None |
| technician_enroute | YES | None |
| **technician_en_route** | YES | None (both variants present) |
| service_completed | YES | None |
| appointment_canceled_employee | YES | None |
| appointment_canceled_customer | YES | None |
| scheduling_failure | YES | None |
| payment_failed | YES | None |
| subscription_activated | YES | None |
| subscription_renewed | YES | None |
| subscription_canceled | YES | None |
| annual_expiring_30d | YES | None |
| annual_expiring_7d | YES | None |
| annual_expired | YES | None |
| appointment_reminder_24h | YES | None |
| appointment_reminder_same_day | YES | None |
| lead_acknowledgement | YES | None |
| sms_opt_out | YES | None |
| sms_opt_in | YES | None |
| email_opted_out | YES | None |
| employee_assignment_created | YES | None |
| employee_assignment_cancelled | YES | None |
| employee_assignment_updated | YES | None |
| logged | YES | None |

**RESULT: All 27 TypeScript types are present in the DB constraint. ZERO types would cause silent failures.**

### Types in DB Constraint but NOT in TypeScript Union

The DB constraint has 28 types; the TypeScript union has 27. Let me check for the extra:

Both `technician_enroute` (old spelling) and `technician_en_route` (new spelling) exist in BOTH the TypeScript union AND the DB constraint. So neither is orphaned.

Comparing the lists:
- DB constraint contains all 27 TypeScript types
- DB constraint also has... let me recount:

DB constraint types (28):
1. appointment_confirmation
2. reminder_24h
3. reminder_same_day
4. appointment_canceled
5. appointment_rescheduled
6. technician_enroute
7. service_completed
8. appointment_canceled_employee
9. appointment_canceled_customer
10. scheduling_failure
11. payment_failed
12. subscription_canceled
13. logged
14. subscription_activated
15. subscription_renewed
16. annual_expiring_30d
17. annual_expiring_7d
18. annual_expired
19. appointment_reminder_24h
20. appointment_reminder_same_day
21. technician_en_route
22. lead_acknowledgement
23. sms_opt_out
24. sms_opt_in
25. employee_assignment_created
26. employee_assignment_cancelled
27. employee_assignment_updated
28. email_opted_out

TypeScript union (27) — same list except: DB has both `technician_enroute` AND `technician_en_route`; TypeScript also has both. Count matches at 27 unique types if we note both old and new spelling exist in BOTH. 

Actually recounting — both have 28 types since both have technician_enroute AND technician_en_route. The TypeScript union explicitly contains both spellings. The count difference was a miscounting error. **Both have the exact same 28 types.**

**RESULT: PERFECT MATCH — TypeScript union and DB constraint are in complete alignment.**

---

## Notable Finding: Dual Spelling for Technician En-Route

Both the TypeScript union and DB constraint contain:
- `"technician_enroute"` — original spelling (from Phase 2 infrastructure migration)
- `"technician_en_route"` — new spelling (added in Communication Sprint)

The code in `employeeAssignments.ts` (en-route fallback email) uses `"technician_en_route"` (new spelling). The old `"technician_enroute"` type is now orphaned in the code but harmless in the DB constraint. No action needed.

---

## admin_alerts Event Type Schema Verification

**Migration file:** `2026-05-30_admin_alerts.sql`

**Schema for event_type:**
```sql
event_type  TEXT  NOT NULL,
```

**VERIFIED:** `event_type` is free-form `TEXT` with only `NOT NULL` constraint. There is NO CHECK constraint limiting event_type values. This is the correct design — event types are dot-namespaced strings (e.g., "billing.payment_failed") and new types can be added to code without requiring a DB migration.

**Admin alert event types used in code:**
- `system.webhook_signature_failure`
- `billing.new_subscription`
- `billing.payment_failed`
- `subscriptions.cancelled`
- `scheduling.appointment_created_without_assignment`
- `scheduling.appointment_cancelled`
- `leads.new_schedule_request`
- `field_ops.service_completed`
- `field_ops.employee_no_show`
- `field_ops.assignment_skipped`
- `field_ops.media_uploaded`

All are valid free-form TEXT strings. No DB constraint changes needed as new alert types are added.

---

## logNotification() Function Verification

**Non-throwing:** VERIFIED — all errors caught and logged, never re-thrown

**Deduplication functions:**
1. `isDuplicateNotification(appointmentId, type)` — checks unique index on (appointment_id, notification_type) WHERE status='sent'
2. `isDuplicateProfileNotification(profileId, type, withinHours)` — checks by profile + type within time window
3. `isDuplicateByPayload(type, payloadKey, payloadValue, withinHours)` — checks by JSONB payload key+value within time window

All three dedup functions fail-open (return false on error) — correct for notifications where false negatives (duplicate sends) are preferable to blocking sends.

---

## Orphaned Type Check

**`technician_enroute`** — in DB constraint, in TypeScript union, but no active code path uses this spelling. Code uses `technician_en_route`. This is HARMLESS — the old type is just an unused entry in the constraint. It cannot cause failures.

**`appointment_rescheduled`** — in both union and constraint. Wiring was confirmed in `customerAppointments.ts` per prior sprint. Still valid.

**`appointment_canceled_employee`** and **`appointment_canceled_customer`** — in both. These appear to be alternative cancellation types that may be used in extended cancellation flows. No current code path was found using these exact types in this sprint's file reads, but they exist in the constraint from prior migrations.

---

## Summary

| Check | Result |
|-------|--------|
| TypeScript union matches DB constraint | PERFECT MATCH (28 types each) |
| Types in TS not in DB (would cause silent failures) | ZERO |
| Types in DB not in TS (orphaned) | ZERO — all have TS entries |
| admin_alerts event_type is free-form TEXT | VERIFIED — no constraint needed |
| logNotification() non-throwing | VERIFIED |
| Deduplication functions fail-open | VERIFIED |
| Dual spelling (technician_en_route) handled | Both in union AND constraint |

---

## Assessment

**PASS** — TypeScript notification types and DB CHECK constraint are in perfect alignment. Zero types would cause silent DB failures. The admin_alerts table correctly uses free-form TEXT for event types. All three deduplication functions are implemented correctly with fail-open behavior.
