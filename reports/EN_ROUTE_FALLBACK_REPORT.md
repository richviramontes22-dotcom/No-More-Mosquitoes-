# En-Route Fallback Email Report

**Date:** 2026-05-30

## Implementation
**File:** `server/routes/employeeAssignments.ts`
**Trigger:** Status update to `en_route` in `POST /api/employee/assignments/:id/status`

## Logic
1. When assignment status transitions to `en_route`, a fire-and-forget async block executes.
2. Fetches appointment data (user_id, property_id, scheduled_date, window_label).
3. Fetches profile (email, name, phone) and property (address, city, state).
4. **If customer HAS a phone number:** Logs intent to use SMS (no email sent). SMS is handled by the admin dispatch route (`adminAppointments.ts`) via `sendEnRouteSMS()`.
5. **If customer has NO phone number:** Sends `buildEnRouteFallbackEmail()` to the customer's email.
6. Logs to `notification_log` with `type='technician_en_route'`, `channel='email'`.

## Template
`buildEnRouteFallbackEmail()` — branded layout with:
- "Your technician is on the way!" heading
- Arrival window prominently displayed
- Address info table
- "Keep pets inside" instruction
- Dashboard CTA

## Note on Overlap with adminAppointments.ts
The existing admin dispatch route (`/api/admin/appointments/:id/dispatch`) already handles SMS via `sendEnRouteSMS()` for customers with phone numbers. The new employee-triggered en-route path provides a fallback email for customers without phone numbers when the technician updates their own status to `en_route` through the employee portal.

This creates two paths for en-route notification:
1. Admin dispatches via `/api/admin/appointments/:id/dispatch` → SMS (existing)
2. Employee updates status to `en_route` via employee portal → Email fallback if no phone (new)
