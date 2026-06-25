# Admin Scheduling Alerts Report

**Date:** 2026-05-30  
**File:** `server/routes/schedule.ts`  
**Status:** IMPLEMENTED

## Implemented Scheduling Alerts

### New Schedule Request (`leads.new_schedule_request`)
- **Severity:** info
- **Trigger:** Successful POST /api/schedule insert
- **Email:** Yes (owner/admin notified immediately)
- **SMS:** No (info severity)
- **Metadata:** name, email, phone, zip, service type
- **Action required:** Review request in admin dashboard, confirm availability, schedule appointment

## Context

The schedule request flow captures leads from:
1. The public website quote/schedule form
2. The customer onboarding flow (authenticated users)

Both paths hit the same `/api/schedule` endpoint and trigger the same admin alert. The alert fires after the `schedule_requests` DB insert succeeds but the exact timing is fire-and-forget (non-blocking).

## Deduplication

- Dedup window: 60 minutes per lead entity (schedule_request UUID)
- Prevents duplicate alerts if webhook or scheduler retries the same insert

## Future Scheduling Alerts (not yet implemented)

| Event | Severity | Trigger |
|-------|---------|---------|
| Appointment cancelled by customer | warning | POST /api/customer/appointments/:id/cancel |
| Appointment rescheduled | info | PATCH /api/customer/appointments/:id |
| Scheduling conflict detected | warning | Availability check failure |
