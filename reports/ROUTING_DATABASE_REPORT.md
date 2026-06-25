# Routing Database Report
**Date:** 2026-05-31

## Pre-Existing Schema (from 2025-11-10_employee_portal.sql)

The `routes` and `route_stops` tables existed but used different column names than the application code:
- `routes.route_date` vs code expected `date`
- `route_stops.seq` vs code expected `sequence_number`
- `route_stops.eta` vs code expected `arrival_eta`

This meant the routing code was effectively broken at the DB level.

## Migration: `2026-05-31_extend_routes.sql`

### Column Renames (idempotent)
- `routes.route_date` → `date`
- `route_stops.seq` → `sequence_number`
- `route_stops.eta` → `arrival_eta`

### Status CHECK Updates

`routes.status` expanded to:
```
('draft','approved','assigned','published','in_progress','completed','canceled')
```
Previously: `('draft','assigned','in_progress','completed')`

`route_stops.status` expanded to:
```
('pending','scheduled','arrived','skipped','completed')
```
Previously: `('scheduled','skipped','completed')` — was missing 'pending' (the code's default) and 'arrived'

### New Columns on `routes`

| Column | Type | Purpose |
|--------|------|---------|
| `created_by` | uuid → auth.users | Who generated the route |
| `approved_at` | timestamptz | When approved |
| `approved_by` | uuid → auth.users | Who approved |
| `published_at` | timestamptz | When published to employee |
| `locked_at` | timestamptz | When locked (same as published_at) |
| `total_distance_miles` | decimal(8,2) | Sum of all stop distances |
| `total_duration_minutes` | decimal(8,2) | Total estimated drive time |
| `algorithm_version` | text | 'nearest-neighbor-v1' (current) |
| `confidence` | text | 'high'/'medium'/'low' |
| `conflict_notes` | text[] | Array of detected conflicts |

### New Columns on `route_stops`

| Column | Type | Purpose |
|--------|------|---------|
| `departure_eta` | timestamptz | When employee should leave stop |
| `distance_from_prev_miles` | decimal(8,3) | Drive distance from previous stop |
| `duration_from_prev_minutes` | decimal(8,2) | Drive time from previous stop |
| `appointment_id` | uuid → appointments | Direct FK for enrichment |
| `estimated_duration_minutes` | int | Service time at this stop (default 45) |
| `notes` | text | Admin notes for this stop |

### New Table: `route_audit_log`

```sql
id, route_id, actor_id, actor_role, action, metadata jsonb, created_at
```

Actions logged: route_generated, route_approved, route_published, route_rebuilt, route_completed, route_canceled, stop_reordered, stop_updated

### Route Lifecycle

```
draft → approved → published → in_progress → completed
                             ↘ canceled
```

- `draft`: Generated, not yet reviewed
- `approved`: Admin reviewed, ready to publish
- `published`: Employee notified; route is locked
- `in_progress`: Employee has started first stop
- `completed`: All stops done
- `canceled`: Route discarded after publish
