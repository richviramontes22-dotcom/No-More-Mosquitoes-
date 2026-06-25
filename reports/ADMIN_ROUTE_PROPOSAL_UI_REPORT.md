# Phase 9 — Admin Route Proposal UI Report
**Date:** 2026-05-31
**Project:** No More Mosquitoes — Employee Operations Sprint

---

## Overview

This is a new admin page: `/admin/routes`. It does not currently exist. The UI allows admin to generate, review, modify, approve, and publish daily technician routes.

---

## Page: `/admin/routes`

### Layout

```
[Route Planner]                              [Date Picker] [Generate Proposal]

Tabs: [Draft] [Approved] [Published] [Completed]

────────────────────────────────────────────────────────
Technician A — Luis Martinez               5 stops | ~4.5 hrs | Confidence: High
────────────────────────────────────────────────────────
  1. 9:00 AM  123 Oak St, Irvine        Regular service     → 22 min drive
  2. 9:52 AM  456 Maple Ave, Irvine     Regular service     → 18 min drive
  3. 10:25 AM 789 Pine Rd, Tustin       Regular service     → 31 min drive
  4. 11:05 AM 321 Elm Ct, Orange        Regular service     → 19 min drive
  5. 11:35 AM 654 Cedar Dr, Orange      Regular service     → 24 min drive
                                                    Estimated finish: 12:44 PM

────────────────────────────────────────────────────────
Technician B — Carlos Rivera              4 stops | ~3.8 hrs | Confidence: Medium
────────────────────────────────────────────────────────
  ⚠ 1 stop missing coordinates — ETA estimate may be inaccurate
  ...stops...

────────────────────────────────────────────────────────
⚠ 2 Unassigned Appointments
────────────────────────────────────────────────────────
  - 987 Beach Blvd, Huntington Beach [Assign to technician ▾]
  - 135 Harbor Dr, Newport Beach [Assign to technician ▾]

────────────────────────────────────────────────────────
[Save as Draft]                        [Approve & Notify Employees]
```

---

## Interactions

### Generate Proposal
- Date picker defaults to tomorrow
- "Generate Proposal" calls `POST /api/admin/routes/generate`
- Shows loading spinner while algorithm runs (usually < 1 second for MVP)
- Results appear in the UI — not yet saved

### Drag to Reorder
- Each stop row has a drag handle (≡ icon)
- Dragging reorders stops within a technician's list
- Sequence numbers and ETAs update live
- Can also drag a stop from one technician's list to another's

### Reassign Stop
- Each stop has a "Reassign" dropdown → list of active technicians
- Moving respects capacity warnings (shows "Over capacity" badge if exceeded)

### Remove Stop
- Each stop has an "X" button
- Removed stop goes to "Unassigned" section at bottom

### Add Unassigned Stop to a Technician
- Unassigned section: each stop has "Assign to technician ▾" dropdown
- Selecting technician inserts stop at end of their list (admin can then drag to reorder)

### Conflict Badges
- Orange badge: "ETAs overlap" (two stops with less than estimated service time between them)
- Red badge: "Over capacity" (more than max stops)
- Yellow badge: "Missing coordinates" (ETA estimate unreliable)

---

## Actions

### Save as Draft
- Saves proposal to `routes` table with `status = 'draft'`
- Does NOT create assignments yet
- Does NOT notify employees
- Admin can return and edit later

### Approve & Publish
Two-step confirm dialog:
```
Are you sure you want to approve this route?

Technician A (Luis Martinez): 5 stops
Technician B (Carlos Rivera): 4 stops
2 appointments remain unassigned.

This will:
✓ Create assignments for all stops
✓ Notify technicians via in-app and email
✓ Lock the route for editing

[Cancel]  [Approve & Publish Route]
```

On confirm:
1. Create `assignments` rows for each stop (if not already existing)
2. Update `route_stops` with `seq` and `eta`
3. Set `routes.status = 'approved'`, record `approved_at`, `approved_by`
4. Publish: set `published_at`
5. Notify each technician: "Your route for [date] is ready — N stops"
6. Lock route: set `locked_at`

### Override After Lock
Admin can unlock with confirmation:
```
Unlock this route?
Employees have already been notified. Changes will require re-notifying them.
```

---

## Conflict Panel

Collapsible panel below the route lists:
```
[⚠ 3 Conflicts Detected]

1. Technician A: Stop 3 and Stop 4 overlap — insufficient time between stops.
   Fix: Add 15 minutes buffer or remove one stop.

2. Technician B: Stop 2 at 987 Beach Blvd has no GPS coordinates.
   Fix: Geocode address in property settings before routing.

3. Unassigned: 2 appointments could not be placed (capacity exceeded).
   Fix: Add technician or extend existing routes.
```

---

## Map View (Optional Enhancement)

Toggle button: [List View] [Map View]

Map view shows:
- All stops as numbered pins (1, 2, 3...) per technician (different color per tech)
- Lines connecting stops in sequence
- Unassigned stops as gray pins
- Employee start locations if available

Library: Mapbox GL JS (same library to use for employee route map).

---

## Admin Route History

Tabs on the route planner page:
- **Draft:** Proposals not yet approved
- **Approved:** Routes approved and published
- **Completed:** Routes where all stops are completed/closed
- **Archived:** Past routes for reference

Each row in history shows:
- Date, status, technician count, stop count, completion %, created_by, approved_by

---

## Notification to Employees on Publish

On publish, server sends:
1. In-app notification entry (new `employee_notifications` concept or badge count)
2. Email: "Your route for [date] is ready. You have N stops. Log in to view."
3. SMS (if employee has smsAssignmentAlerts enabled): "NMM: Your route for [date] has N stops. Log in to view details."

Notification type: `employee_route_published` (add to notification_log types).

---

## Required New Pages

| Path | Component | Description |
|------|-----------|-------------|
| `/admin/routes` | AdminRoutes.tsx | Route proposal list and planner |
| `/admin/routes/new` | AdminRouteBuilder.tsx | Generate + edit proposal |
| `/admin/routes/:id` | AdminRouteDetail.tsx | View/edit specific route |
