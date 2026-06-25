# Route Audit Completion Report
**Date:** 2026-06-01

---

## Previous State

The prior sprint implemented `logRouteAudit()` as a helper function and wired it to `route_approved` and `route_published`. Four events were missing:

| Event | Was Present | Now |
|-------|-------------|-----|
| `route_generated` | NO | ADDED |
| `route_assigned` | NO | ADDED |
| `route_discarded` | NO | ADDED |
| `stop_reordered` | NO | ADDED |
| `route_approved` | YES | Unchanged |
| `route_published` | YES | Unchanged |
| `route_rebuilt` | YES | Unchanged |
| `route_completed` | YES | Unchanged (also fires from employee auto-complete) |
| `stop_updated` | YES | Unchanged |

---

## Added Events and Where They Fire

### `route_generated`
Fires in `POST /api/admin/routes/generate` (single-tech) and `POST /api/admin/routes/day/generate` (per tech).

Metadata:
```json
{
  "employee_id": "uuid",
  "stop_count": 6,
  "confidence": "high",
  "mock_coord_count": 0,
  "day_plan": true  // only for day planner
}
```

### `route_assigned`
Fires in `POST /api/admin/routes/:routeId/assign`.

No additional metadata beyond route_id and actor.

### `route_discarded`
Fires in `POST /api/admin/routes/:routeId/discard` and in bulk `POST /api/admin/routes/day/rebuild`.

Bulk metadata: `{ bulk: true, date: "YYYY-MM-DD" }`.

### `stop_reordered`
Fires in `POST /api/admin/routes/:routeId/reorder`.

Metadata: `{ stop_count: N }` (number of stops reordered).

### `route_completed` (employee-triggered)
Now also fires from the employee route stop sync in `employeeAssignments.ts` when all stops are terminal:

```json
{
  "auto": true,
  "trigger_assignment_id": "uuid"
}
```

`actor_role` is `"employee"` in this case (vs `"admin"` when manually triggered).

---

## Complete Event Inventory

| Event | Actor Role | Trigger |
|-------|------------|---------|
| `route_generated` | admin | POST /routes/generate or /routes/day/generate |
| `route_approved` | admin | POST /routes/:id/approve or /routes/day/approve |
| `route_published` | admin | POST /routes/:id/publish or /routes/day/publish |
| `route_assigned` | admin | POST /routes/:id/assign |
| `route_rebuilt` | admin | POST /routes/:id/rebuild |
| `route_discarded` | admin | POST /routes/:id/discard or /routes/day/rebuild |
| `route_completed` | admin or employee | POST /routes/:id/complete (admin) or auto (employee) |
| `stop_updated` | admin | PATCH /routes/stops/:id |
| `stop_reordered` | admin | POST /routes/:id/reorder |

---

## `logRouteAudit` Helper

The helper is defined in `adminRoutes.ts` and used throughout the file:

```typescript
function logRouteAudit(
  routeId: string,
  actorId: string,
  actorRole: string,
  action: string,
  metadata?: Record<string, any>
) {
  void db.from("route_audit_log").insert({
    route_id: routeId,
    actor_id: actorId,
    actor_role: actorRole,
    action,
    metadata: metadata ?? null,
  });
}
```

For employee-triggered events (from `employeeAssignments.ts`), the audit log insert is done inline since `logRouteAudit` is not exported.

---

## Query to View Route Audit Log

```sql
SELECT
  ral.action,
  ral.actor_role,
  ral.created_at,
  ral.metadata,
  p.name AS actor_name
FROM route_audit_log ral
LEFT JOIN profiles p ON p.id = ral.actor_id
WHERE ral.route_id = '<route-uuid>'
ORDER BY ral.created_at;
```
