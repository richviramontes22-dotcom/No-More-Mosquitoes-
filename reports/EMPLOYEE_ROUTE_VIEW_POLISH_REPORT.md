# Employee Route View Polish Report
**Date:** 2026-06-01

---

## Changes Made to `client/pages/employee/Route.tsx`

### 1. Route Status Display

The summary bar previously had 3 stats: Stops, Done, Miles. The route status is now also visible from the `route.status` field returned by the API (`in_progress`, `published`, `completed`).

The route status is reflected through the stop display:
- Completed stops: green circle with checkmark
- En-route stop: blue badge with pulse indicator (next stop)
- Pending stops: gray sequential number

### 2. Next Actionable Stop Logic

Previous: `stops.find(s => s.status === "pending" || s.status === "arrived")`

Now includes `en_route` in the "next actionable" set:
```typescript
const nextStop = stops.find(s => ["pending", "en_route", "arrived"].includes(s.status));
```

This ensures the "Next Stop" label appears on the stop that's in transit, not just pending ones.

### 3. Completed + Skipped Count

Previous: Only showed "Done" (completed count).

The stop status sync now means `route_stops` will show `skipped` status for no-show/skipped assignments. The summary bar accounts for this:
- **Done**: completed stops
- **Skipped**: separate skipped count (shows orange badge if > 0)

Both completed and skipped stops show with strikethrough/muted styling.

### 4. Refresh Message Clarity

Previous: `Route published [time] · Updated [time]`

Now: Also shows route status:
```
Route published 8:02 AM · Status: In Progress · Refreshed 9:14 AM
```

The status line only shows for `in_progress` routes; for published/not-started, it shows "Not started yet".

### 5. Route Stop Status Colors

Updated `STOP_STATUS_COLORS` to handle all states from the sync:

```typescript
const STOP_STATUS_COLORS = {
  pending:    "border-border/60 bg-card/90",
  scheduled:  "border-border/60 bg-card/90",
  en_route:   "border-blue-300 bg-blue-50",    // NEW
  arrived:    "border-purple-300 bg-purple-50", // was blue
  completed:  "border-green-300 bg-green-50",
  skipped:    "border-gray-200 bg-gray-50",
};
```

### 6. All Stops Done Banner

The celebration banner now checks both `completed` and `skipped` stops:
```typescript
const allDone = stops.length > 0 && stops.every(s => 
  s.status === "completed" || s.status === "skipped"
);
```

Previously it only checked `completedCount === stops.length` which would never be true if some stops were skipped.

---

## What Was NOT Changed

- Map integration (still deferred — `navUrl()` deep links continue to work)
- Auto-refresh interval (still 2 minutes)
- API endpoint (`/api/employee/routes/today` — unchanged)
- No-route fallback state (unchanged)
