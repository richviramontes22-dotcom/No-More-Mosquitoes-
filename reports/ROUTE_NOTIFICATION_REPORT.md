# Route Notification Report
**Date:** 2026-05-31

---

## Implemented Notifications

### Admin Notification: `scheduling.route_published`

Triggered in `POST /api/admin/routes/:routeId/publish`.

```typescript
notifyAdmin({
  event_type: "scheduling.route_published",
  severity: "info",
  title: `Route published — N stops for YYYY-MM-DD`,
  entity_type: "route",
  entity_id: routeId,
  metadata: { employee_id, stop_count },
});
```

This fires the existing `notifyAdmin()` from `adminNotificationService.ts` which:
- Inserts to `admin_alerts` table
- Sends email to OWNER_EMAIL if configured
- Shows in admin bell notification center

---

## Employee Notification (Not Yet Implemented as Push)

The employee route view at `/employee/route` polls every 2 minutes for route changes. When a route is published:
- Employee refreshes (or waits up to 2 minutes)
- The "No route yet" state transitions to the full route view
- Last-published timestamp is shown

**True push notification to employee** (e.g., SMS or in-app badge) is deferred. The polling approach is sufficient for beta where admin manually dispatches.

Future implementation:
- Add `employee_notifications` table or reuse `admin_alerts` with employee targets
- Employee dashboard badge showing "Route published for today"
- Optional SMS: "NMM: Your route for [date] is ready — N stops. Log in to view."

---

## Route Audit Log Entries

All route lifecycle events are written to `route_audit_log`:

| Action | Trigger |
|--------|---------|
| `route_generated` | POST /routes/generate (not yet wired — existing code predates audit log) |
| `route_approved` | POST /routes/:id/approve |
| `route_published` | POST /routes/:id/publish |
| `route_rebuilt` | POST /routes/:id/rebuild |
| `route_completed` | POST /routes/:id/complete |
| `stop_updated` | PATCH /routes/stops/:id |

The `route_generated` event is not yet written because the generate endpoint was pre-existing code that wasn't modified. Add `logRouteAudit(routeData.id, user.user.id, "admin", "route_generated")` to the generate endpoint to close this gap.

---

## Admin Alert Event Type

`scheduling.route_published` is a free-form text event_type in the `admin_alerts` table (no CHECK constraint on event_type). This is consistent with how all admin_alerts event_types work in this codebase.
