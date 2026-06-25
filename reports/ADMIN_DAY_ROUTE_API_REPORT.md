# Admin Day Route API Report
**Date:** 2026-06-01

---

## Endpoints

### `POST /api/admin/routes/day/generate`

Body: `{ date: "YYYY-MM-DD", max_stops_per_tech?: number }`

Generates draft routes for all active technicians for the given date. Skips technicians who already have a draft or approved route. Creates assignments as needed.

**Idempotency:** Safe to call multiple times. Existing routes are not modified.

Returns: `{ routes[], unassigned_appointments[], message }`

---

### `GET /api/admin/routes/day?date=YYYY-MM-DD`

Returns all routes for the date, enriched with:
- `employee_name`, `employee_email`
- `stop_count`, `completed_count`
- `confidence`, `conflict_notes`
- `status`, `approved_at`, `published_at`, `total_distance_miles`

Used by the Day Planner UI to render the route cards grid.

---

### `POST /api/admin/routes/day/approve`

Body: `{ date: "YYYY-MM-DD" }`

Bulk-approves all `status = 'draft'` routes for the date. Sets `approved_at` and `approved_by`.

Writes `route_approved` audit log for each route with `metadata: { bulk: true, date }`.

Returns: `{ approved: N, message }`

---

### `POST /api/admin/routes/day/publish`

Body: `{ date: "YYYY-MM-DD" }`

Bulk-publishes all `status IN ('approved', 'draft')` routes for the date. Sets `published_at` and `locked_at`. Fires one admin notification alert for the entire day's publish event.

Writes `route_published` audit log for each route.

Returns: `{ published: N, message }`

---

### `GET /api/admin/routes/day/unassigned?date=YYYY-MM-DD`

Returns all `status = 'scheduled'` appointments for the date that are NOT on any route with `status IN ('draft', 'approved', 'published', 'in_progress')`.

Used to show the "Unassigned Appointments" warning section in the day planner UI.

Returns: `{ date, unassigned[], total }`

---

### `POST /api/admin/routes/day/rebuild`

Body: `{ date: "YYYY-MM-DD" }`

Deletes all `status IN ('draft', 'approved')` routes for the date (and their stops via CASCADE). Does NOT affect `published` or `in_progress` routes.

Writes `route_discarded` audit log for each deleted route.

Returns: `{ discarded: N, message }`

---

## Error Handling

| Scenario | Response |
|----------|---------|
| Missing date | 400 `date required` |
| Not admin | 403 `Admin required` |
| No active technicians | 200 `{ routes: [], message: "No active technicians found" }` |
| All appointments already routed | 200 `{ routes: [], message: "All appointments are already on approved routes" }` |
| DB error during route creation | Partial — successful routes returned; failed appointments in unassigned list |

---

## Duplicate Prevention Logic

In `POST /api/admin/routes/day/generate`:
```typescript
const { data: existingDraft } = await db
  .from("routes")
  .select("id, status")
  .eq("employee_id", tech.id)
  .eq("date", date)
  .in("status", ["draft", "approved"])
  .limit(1)
  .maybeSingle();

if (existingDraft) {
  continue; // Skip — don't create duplicate
}
```

This ensures calling generate twice does not produce two routes for the same technician on the same date.
