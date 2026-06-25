# Route Stop Status Sync Report
**Date:** 2026-06-01

---

## Problem

Route stop status (`route_stops.status`) was never updated by employee actions. An employee could complete all their assignments and the route would still show every stop as "pending" in the admin view. The route itself would never advance to "in_progress" or "completed" automatically.

---

## Solution

Added a fire-and-forget sync block to `POST /api/employee/assignments/:id/status` in `employeeAssignments.ts`.

This runs **after** the status update response is sent — it cannot delay or break the employee's status update.

---

## Status Mapping

| Assignment Status | Route Stop Status |
|-----------------|------------------|
| `en_route` | `en_route` |
| `in_progress` (arrived) | `arrived` |
| `completed` | `completed` |
| `skipped` | `skipped` |
| `no_show` | `skipped` |

---

## Route Auto-Progression

### Draft / Published → In Progress
When assignment transitions to `en_route` or `in_progress`, the linked route advances from `published` or `assigned` to `in_progress`:

```typescript
if (status === "en_route" || status === "in_progress") {
  await db.from("routes")
    .update({ status: "in_progress" })
    .eq("id", stop.route_id)
    .in("status", ["published", "assigned"]);
}
```

Only advances forward — a route already in `in_progress` or `completed` is not changed.

### In Progress → Completed (auto)
When an assignment transitions to a terminal state (`completed`, `skipped`, `no_show`), the system checks whether ALL stops are now in terminal states:

```typescript
const TERMINAL = ["completed", "skipped"];
const allDone = allStops.every(s => TERMINAL.includes(s.status));
if (allDone) {
  await db.from("routes").update({ status: "completed" }).eq("id", stop.route_id);
  // Writes route_completed audit log
}
```

This means the admin never has to manually mark a route complete — it completes automatically when the last stop is finished.

---

## Database Requirement

The `en_route` status must exist in the `route_stops` status CHECK constraint. This is added by:

```
db/migrations/2026-05-31_route_stops_en_route.sql
```

Without this migration, the sync would fail silently (the fire-and-forget catches all errors) when trying to set `en_route` on a route stop.

---

## Sync Code Location

`server/routes/employeeAssignments.ts` — after the assignment status update success and before the `console.log`:

```typescript
void (async () => {
  try {
    const stopStatusMap = { en_route: "en_route", in_progress: "arrived", ... };
    const routeStopStatus = stopStatusMap[status];
    if (!routeStopStatus) return;

    const { data: stop } = await db.from("route_stops")
      .select("id, route_id")
      .eq("assignment_id", id)
      .maybeSingle();

    if (!stop) return; // Assignment not on any route — skip

    await db.from("route_stops").update({ status: routeStopStatus }).eq("id", stop.id);
    // ... route status progression ...
  } catch (syncErr: any) {
    console.error("[RouteSync] Failed to sync route stop:", syncErr.message);
  }
})();
```

---

## Failure Modes

| Scenario | Behavior |
|----------|----------|
| Assignment not on any route | `maybeSingle()` returns null → sync skips silently |
| `en_route` migration not applied | DB rejects update → caught by try/catch → logged |
| Route already completed | Auto-complete check is a no-op (already completed) |
| DB error during sync | Logged to console; employee status update is NOT affected |

---

## Employee Route View Impact

The employee route view polls `/api/employee/routes/today` every 2 minutes. When a stop status syncs, the next poll will show the updated stop status (e.g., `arrived`, `completed`). The employee sees the route progress in near-real-time without any extra client changes.
