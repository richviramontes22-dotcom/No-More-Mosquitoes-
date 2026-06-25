# Multi-Technician Day Planner Report
**Date:** 2026-06-01

---

## Overview

The day planner generates one draft route per active technician for a selected date, distributing unrouted appointments across technicians by geographic cluster.

## Algorithm

### Step 1: Filter Eligible Appointments
Query `appointments` where:
- `status = 'scheduled'`
- `scheduled_at` falls on the target date (midnight to midnight UTC)

### Step 2: Exclude Already-Routed Appointments
Query `route_stops` for those appointment IDs on routes with `status IN ('approved', 'published', 'in_progress')`. Exclude any appointments that already appear on an active route.

### Step 3: Get Active Technicians
Query `employees` where `status = 'active'` and `role IN ('technician', 'dispatcher')`.

### Step 4: Group by ZIP Code
Group remaining appointments by `properties.zip`. Each ZIP code becomes a cluster.

### Step 5: Assign ZIP Clusters to Technicians (Round-Robin by Load)
Sort ZIP clusters by size (largest first). Assign each cluster to the technician with the fewest assigned stops. This tends to:
- Keep stops in the same area together (minimizes inter-stop travel)
- Balance workload across technicians

### Step 6: Respect Capacity
Default: 8 stops per technician per day (`max_stops_per_tech`, configurable in request body).
Stops beyond capacity go to the `unassigned_appointments` return value.

### Step 7: Create/Reuse Assignments
For each appointment assigned to a technician, find or create an `assignments` row linking the appointment to that technician.

### Step 8: Optimize and Create Route
Run nearest-neighbor optimization on the technician's assigned stops. Insert `routes` + `route_stops` rows.

### Step 9: Duplicate Prevention
If a technician already has a draft or approved route for the date, skip route creation for them (no duplicate routes). The endpoint is safe to call multiple times.

## Return Value

```json
{
  "success": true,
  "date": "2026-06-02",
  "routes": [
    {
      "id": "uuid",
      "employee_id": "uuid",
      "date": "2026-06-02",
      "status": "draft",
      "confidence": "high",
      "stop_count": 6,
      "total_distance_miles": 14.3,
      "conflict_notes": []
    }
  ],
  "unassigned_appointments": [],
  "message": "Created 2 draft route(s). 0 appointment(s) unassigned."
}
```

## Limitations (Known)

| Limitation | Impact | Fix Path |
|------------|--------|---------|
| No technician availability awareness | May assign to unavailable tech | Add availability table or tech-level block dates |
| No customer time-window enforcement | ETA may fall outside customer window | Add window comparison to confidence scoring |
| Round-robin ZIP assignment is not true TSP | Suboptimal for complex geographies | Use Google Distance Matrix in future sprint |
| Start location assumed to be first appointment | Real-world techs start from home/depot | Add optional `start_lat`/`start_lng` per technician |
| Capacity is a flat number | Doesn't account for job complexity | Add `estimated_duration_minutes` per appointment |

## Operational Notes

- Admin should review all draft routes before approving/publishing
- `Low confidence` routes are especially important to review manually
- Unassigned appointments should be manually assigned via single-tech generate or drag-to-assign (future)
- The day planner does NOT automatically publish — admin must explicitly approve then publish
