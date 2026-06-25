# Route Audit Log Report
**Date:** 2026-05-31

## Table: `route_audit_log`

Created by `db/migrations/2026-05-31_extend_routes.sql`.

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
route_id uuid REFERENCES routes(id) ON DELETE CASCADE
actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
actor_role text
action text NOT NULL
metadata jsonb
created_at timestamptz NOT NULL DEFAULT now()
```

Indexes:
- `(route_id, created_at DESC)` — query audit history for a specific route
- No RLS (admin reads via service role)

## Actions Recorded

| Action | When | Metadata |
|--------|------|---------|
| `route_approved` | POST /routes/:id/approve | `{ route_id }` |
| `route_published` | POST /routes/:id/publish | `{ stop_count, employee_id }` |
| `route_rebuilt` | POST /routes/:id/rebuild | `{ employee_id }` |
| `route_completed` | POST /routes/:id/complete | — |
| `stop_updated` | PATCH /routes/stops/:id | `{ stop_id, updates }` |

## Not Yet Logged

| Action | Reason |
|--------|--------|
| `route_generated` | Pre-existing generate endpoint not modified |
| `route_assigned` | Pre-existing assign endpoint not modified |
| `route_discarded` | Pre-existing discard endpoint not modified |
| `stop_reordered` | Pre-existing reorder endpoint not modified |

These can be added by inserting `logRouteAudit()` calls into the respective existing endpoints.

## Helper Function

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

Fire-and-forget — audit log failures never propagate to the API response.

## Query Examples

```sql
-- All events for a specific route
SELECT action, actor_role, metadata, created_at
FROM route_audit_log
WHERE route_id = '...'
ORDER BY created_at;

-- All publish events today
SELECT route_id, actor_id, metadata, created_at
FROM route_audit_log
WHERE action = 'route_published'
AND created_at::date = CURRENT_DATE;
```
