# Employee Route View Implementation Report
**Date:** 2026-05-31
**File:** `client/pages/employee/Route.tsx`
**Route:** `/employee/route`
**Nav:** Employee sidebar → "Today's Route"

---

## Overview

New employee page showing today's published route in stop sequence order. Displays ETA, customer info, navigation deep link, and links to full assignment detail per stop.

Polls for route updates every 2 minutes (catches admin edits after initial load).

---

## Features

### Summary Bar
Three cards: total stops, completed count, total miles.

### Route Update Banner
Shows route published time and last refresh time. Employee knows if the route was recently changed.

### Stop Cards (ordered by sequence_number)

Each stop shows:
- **Sequence badge** — numbered circle (green ✓ if completed, primary for next stop, muted for future)
- **"Next Stop" label** — first non-completed, non-skipped stop
- **Customer name** (masked for test employees — future)
- **Address** (city shown)
- **ETA** — formatted time + estimated duration
- **Admin notes** (if set on the stop)

**Stop background colors:**
- pending: default card
- arrived: blue tint
- completed: green tint
- skipped: gray tint

**Actions per stop:**
- "Navigate" button → opens Google Maps or Apple Maps deep link (only if coordinates available)
- "Detail →" link → `/employee/assignments/:id` for full assignment detail, status update, checklist, media upload

### Completion Celebration
When all stops are completed: green banner "All stops completed! Great work."

### No-Route Fallback
If no published route exists for today: shows empty state with link to `/employee/assignments` (flat list).

---

## Data Flow

```
GET /api/employee/routes/today
  → finds routes WHERE employee_id = actor.employeeId AND date = today
    AND status IN ('published','assigned','in_progress')
  → fetches route_stops ordered by sequence_number
  → batch-enriches with: assignments → appointments → profiles + properties
  → returns { route, stops, has_route }
```

The endpoint is in `adminRoutes.ts` (router) mounted at both `/api/admin` and `/api/employee`. The employee-facing client calls `/api/employee/routes/today`.

---

## Navigation Integration

Uses existing `navUrl()` from `client/lib/employee/deepLinks.ts`:
```typescript
navUrl(stop.lat, stop.lng)
// → Apple Maps deep link on iOS
// → Google Maps deep link otherwise
```

Employee's default_nav preference is NOT yet wired into Route.tsx (uses navUrl which auto-detects iOS). Future: pass employee.default_nav to navUrl.

---

## Polling

Route data refreshes every 120 seconds (2 minutes) via `setInterval`. If admin publishes a route update, employee sees it within 2 minutes without manual refresh.

Manual "Refresh" button also available.

---

## Missing from Route View (Future)

- Map with all stops as numbered pins
- Real-time assignment status sync (currently requires manual detail page open to update)
- Ability to report delay/issue from route view
- Route-level "I'm done for the day" button
