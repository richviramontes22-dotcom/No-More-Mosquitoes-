# Workforce Notification Requirements Report
**Date:** 2026-06-01

---

## Admin Notifications (via `admin_alerts` table + email/SMS to owner)

| Event | Trigger | Severity | Suggested Text |
|-------|---------|----------|---------------|
| Time-off requested | Employee submits request | info | "[Name] requested [N] days [type] — [dates]. Review in Workforce." |
| Sick day reported | Employee reports sick today | warning | "[Name] reported sick today. [N] appointments may need reassignment." |
| Time-off with conflicts | Admin approves time-off that conflicts with routes | warning | "Approved [Name]'s PTO conflicts with [N] published routes on [dates]." |
| No technician available | Day planner finds no available techs | critical | "No technicians available for [date] — cannot generate routes." |
| Technician at capacity | Day planner overflows appointments | warning | "[Name] at capacity — [N] appointments unassigned for [date]." |
| Route blocked by tech unavailability | Existing route exists for tech now approved as unavailable | warning | "[Name]'s approved time-off conflicts with route on [date]. Manual reassignment required." |

---

## Employee Notifications (in-app + optional email)

| Event | Trigger | Suggested Text |
|-------|---------|---------------|
| Time-off approved | Admin approves | "Your [type] request for [dates] has been approved." |
| Time-off rejected | Admin rejects | "Your [type] request for [dates] was not approved. [Admin note]" |
| Schedule updated by admin | Admin edits schedule template | "Your work schedule has been updated starting [date]. Tap to view." |
| Route published for upcoming day | Route publish event | "Your route for [date] is ready — [N] stops. Tap to view." |
| Route updated after schedule change | Admin modifies route due to availability | "Your route for [date] has been updated." |
| Assignment on new date (added to route) | New stop added to existing route | "A new stop has been added to your route for [date]." |

---

## Notification Channels

| Channel | Use Case | Configuration |
|---------|---------|---------------|
| In-app (admin_alerts) | All admin workforce events | Always on |
| Email (Resend) | Time-off decisions, schedule changes | When RESEND_API_KEY set |
| SMS (Twilio) | Sick day alerts (warning/critical severity) | When TWILIO configured |

---

## Notification Types to Add to `notification_log`

The existing `notification_log` CHECK constraint for `notification_type` needs new entries for workforce:

```sql
-- Add to the next notification constraint migration:
'time_off_approved',
'time_off_rejected',
'time_off_requested',
'sick_day_reported',
'schedule_updated',
'route_conflict_time_off'
```

---

## Admin Alert Event Types to Add

The `admin_alerts.event_type` is free-form TEXT (no constraint), so these can be used immediately without a migration:

```
workforce.time_off_requested
workforce.sick_day_reported
workforce.time_off_conflict_route
workforce.no_technicians_available
workforce.technician_over_capacity
workforce.route_availability_conflict
```

---

## Deduplication Windows

Following the same pattern as existing `notifyAdmin()` dedup logic:

| Event | Dedup Window | Reasoning |
|-------|-------------|-----------|
| `time_off_requested` | None (per request) | Each request is unique |
| `sick_day_reported` | 24 hours per employee | Avoid multiple alerts for same sick day |
| `no_technicians_available` | 1 hour per date | Don't spam if admin tries generate multiple times |
| `technician_over_capacity` | 4 hours per technician/date | Inform once per dispatch session |

---

## Out of Scope

- Push notifications (native mobile app not built)
- SMS for all time-off events (only sick days warrant SMS urgency)
- Payroll system integration notifications
- FMLA legal notifications
