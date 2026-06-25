# GPS Snapshot Tracking Report
**Date:** 2026-05-31

## Architecture

Mode: **Arrival Snapshot Only** (not continuous tracking)

GPS is captured at three status transition points:
1. `en_route` — employee leaving for the job
2. `in_progress` (via arrive endpoint) — employee at the property
3. `completed` — job finished

Each capture is optional. If the employee's browser denies geolocation or GPS is unavailable, the status update succeeds without location data.

## Database: `employee_location_pings`

New table created by `db/migrations/2026-05-31_employee_location_pings.sql`:

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE
assignment_id uuid REFERENCES assignments(id) ON DELETE SET NULL
latitude decimal(10, 7) NOT NULL
longitude decimal(10, 7) NOT NULL
accuracy_meters decimal(8, 2)
speed_mps decimal(8, 2)        -- not captured in snapshot mode
heading_degrees decimal(6, 2)  -- not captured in snapshot mode
captured_at timestamptz NOT NULL DEFAULT now()
status_trigger text            -- 'en_route', 'arrived', 'completed', etc.
source text NOT NULL DEFAULT 'browser' CHECK IN ('browser', 'simulated')
is_test boolean NOT NULL DEFAULT false
```

RLS policies:
- Admin: full access
- Employee: SELECT own pings only

## Client-Side Capture (AssignmentDetail.tsx)

```typescript
async function capturePosition() {
  if (!navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude, longitude, accuracy }),
      () => resolve(null),   // denied or unavailable → null
      { timeout: 6000, enableHighAccuracy: true }
    );
  });
}
```

Called before `updateStatus()`. Timeout: 6 seconds. If GPS unavailable after 6 seconds, returns null. Status update proceeds regardless.

The `latitude`, `longitude`, and `accuracy` are spread into the request body:
```typescript
body: JSON.stringify({ status: newStatus, ...geo })
// geo = null → only { status: "completed" }
// geo = {lat, lng, acc} → { status: "completed", latitude: 33.7, longitude: -117.9, accuracy: 5 }
```

## Server-Side Storage (employeeAssignments.ts)

GPS capture in status endpoint (fire-and-forget, non-blocking):
```typescript
void (async () => {
  const empData = await fetchEmployeeGpsConsent(actor.employeeId);
  if (!empData?.gps_consent_at) return; // no consent → skip

  await db.from("employee_location_pings").insert({
    employee_id: actor.employeeId,
    assignment_id: id,
    latitude, longitude,
    accuracy_meters: accuracy,
    status_trigger: status,
    source: empData.is_test ? "simulated" : "browser",
    is_test: empData.is_test,
  });

  // Update geo columns on assignments
  if (status === "in_progress") {
    await db.from("assignments").update({ geo_arrive: `SRID=4326;POINT(${longitude} ${latitude})` }).eq("id", id);
  }
  if (status === "completed") {
    await db.from("assignments").update({ geo_complete: `SRID=4326;POINT(${longitude} ${latitude})` }).eq("id", id);
  }
})();
```

The GPS block cannot break the status update response — it runs after the 200 is sent.

## assignments.geo_arrive and geo_complete

These PostGIS geography columns already existed in the schema. They are now populated:
- `geo_arrive` set when status → `in_progress` (arrive action)
- `geo_complete` set when status → `completed`

Using WKT format: `SRID=4326;POINT(longitude latitude)` (note: PostGIS uses lon/lat order, not lat/lon).

## Blocked Scenarios (GPS Does Not Fire)

| Scenario | Behavior |
|----------|----------|
| Employee has no gps_consent_at | GPS block returns early; status update succeeds |
| Browser denies geolocation | Client sends status with no lat/lng; server stores nothing |
| GPS timeout (6 seconds) | Same as denied — status update proceeds |
| No coordinates in request body | Server skips GPS block entirely |
| Any GPS insert fails | Error is logged; status response is unaffected |

## What Is NOT Implemented (Deferred)

- Continuous `watchPosition` tracking between status transitions
- Live admin map with real-time employee positions
- Geofence verification (checking if employee is within X meters of property)
- Rate limiting on pings (relevant for continuous tracking only)
- Location data retention expiry (90-day cleanup job)
- Location history export
