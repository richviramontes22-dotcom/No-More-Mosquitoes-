# Phase 10 — Employee Route View Report
**Date:** 2026-05-31
**Project:** No More Mosquitoes — Employee Operations Sprint

---

## Current State

Employees see a flat list of today's assignments sorted by `scheduled_at`. There is no concept of route order (sequence), no map, no estimated travel time between stops, and no way to see if their route has been updated.

The `routes` and `route_stops` tables exist in the database but are never queried by any client code.

---

## Proposed Employee Route View

### Entry Point
`/employee` dashboard → "Today's Route" card with stop count and next stop.
`/employee/route` → full route view (new page).
`/employee/assignments` → existing list view (keep, but sort by `route_stops.seq` when a route exists).

---

## Route View Page Layout

```
Today's Route — Tuesday, June 3
5 stops · Est. 4.5 hours · Start: 8:00 AM

[Map View]  [List View]

────────────────────────────────────────
✓ Stop 1   9:00 AM   123 Oak St, Irvine
           COMPLETED at 9:38 AM

▶ Stop 2   10:00 AM  456 Maple Ave, Irvine    ← NEXT
           En Route → [Navigate]
           ETA: ~12 min

  Stop 3   10:52 AM  789 Pine Rd, Tustin
  Stop 4   11:45 AM  321 Elm Ct, Orange
  Stop 5   12:30 PM  654 Cedar Dr, Orange
────────────────────────────────────────

[Report Issue / Delay]
```

---

## Route Card States

| State | Display |
|-------|---------|
| Upcoming (not started) | Gray, shows ETA |
| Next stop | Blue highlight, "NEXT" badge, [Navigate] button |
| En Route | Blue, "En Route" badge |
| Completed | Green check, crossed out, actual completion time |
| Skipped | Gray strikethrough |
| No Show | Red badge |

---

## Map View

When map integration is added (Mapbox GL JS):
- Numbered pins for each stop (color: gray=pending, blue=next, green=complete, red=skipped)
- Lines connecting stops in order
- Employee's current location dot (if GPS consent given)
- Tap any pin → shows address and status

Fallback before map library integrated:
- Keep existing list view as default
- Add "Open in Maps" button per stop that deep-links to full route in Google/Apple Maps

---

## Route Updates

When admin modifies a published route (reorders stops, adds/removes stops):
- Employee sees banner: "⚠ Your route has been updated. Tap to refresh."
- Server sends notification (in-app + optionally SMS)
- New sequence numbers applied

**Implementation:** Employee route view polls `GET /api/employee/routes/today` every 60 seconds (or on focus). If `routes.published_at` has changed since last load, show update banner.

---

## Navigate to Next Stop

"Navigate" button on the current/next stop:
- Calls `navUrl(lat, lng)` from `deepLinks.ts` (already exists)
- Opens Apple Maps or Google Maps based on `employee.default_nav`
- Shows as prominent action button, not buried in detail page

---

## Status Update from Route View

Each stop in the route list has:
- Tap to expand → shows mini-detail (address, customer name, notes)
- Status buttons inline: [En Route] [Arrived] [Complete] [Skip]
- Eliminates need to navigate to full `/employee/assignments/:id` for simple status updates
- Full detail still accessible via "View Details" link

---

## Issue / Delay Reporting

"Report Issue / Delay" button at bottom of route:
Opens a quick form:
```
Type: [Running Late ▾]
      Running Late
      Vehicle Issue
      Customer Not Home
      Weather Delay
      Other

Notes: [____________]

Estimated delay: [30 minutes ▾]

[Report to Admin]
```

This creates an `admin_alerts` entry: `field_ops.technician_delay`, severity: info.
Admin is notified. No route change is made automatically.

---

## No Route Published Fallback

If admin has not yet published a route for today:
- Employee sees assignments list (by `scheduled_at` order)
- Banner: "Your route for today has not been finalized yet. Showing appointments by schedule time."

---

## Server Route Required

```
GET /api/employee/routes/today
```

Response:
```typescript
{
  route_id: string | null;
  route_date: string;
  published_at: string | null;
  locked_at: string | null;
  stops: Array<{
    seq: number;
    assignment_id: string;
    appointment_id: string;
    address: string;
    city: string;
    zip: string;
    lat: number | null;
    lng: number | null;
    customer_name: string;
    customer_phone: string;
    service_type: string;
    notes: string;
    scheduled_at: string;
    estimated_arrival: string | null;
    estimated_duration_minutes: number;
    travel_from_prev_minutes: number | null;
    status: string;
    completed_at: string | null;
  }>;
  unrouted_assignments: Array<...>;  // assignments not on the route
}
```

Query logic:
1. Find today's `routes` row for `employee_id` with status in ('approved', 'published')
2. Join `route_stops` with assignments, appointments, properties, profiles
3. Return ordered by `seq ASC`
4. If no route: fall back to returning assignments by `scheduled_at`

---

## Implementation Dependencies

| Dependency | Status | Required Before Route View |
|------------|--------|---------------------------|
| `routes` table | Exists | YES |
| `route_stops` table | Exists | YES |
| Route proposal admin UI | Not built | YES (must create routes first) |
| Mapbox GL JS integration | Not built | NO (list view first) |
| GPS consent | Not built | NO (route view works without GPS) |
| Property lat/lng populated | Partial | For map only |

**Sequence:** Build admin route proposal UI first (Phase 9) → routes exist in DB → employee route view can query them.
