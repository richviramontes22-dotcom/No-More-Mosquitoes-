# Phase 7 — GPS Tracking System Report
**Date:** 2026-05-31
**Project:** No More Mosquitoes — Employee Operations Sprint

---

> **Legal Note:** GPS tracking of employees in California requires explicit written consent under California Labor Code §2929 and raises CCPA privacy considerations. The system must never track employees outside of active assignment windows without separate explicit consent.

---

## Current GPS State

| Feature | Status |
|---------|--------|
| Location API called | YES — `navigator.geolocation.getCurrentPosition` in ClockWidget.tsx |
| Location stored | NO — captured but passed to handler that discards it |
| `time_events.geo` column (DB) | EXISTS — never written |
| `assignments.geo_arrive` column (DB) | EXISTS — never written |
| `assignments.geo_complete` column (DB) | EXISTS — never written |
| `employee_location_pings` table | DOES NOT EXIST — must create |
| GPS consent flow | DOES NOT EXIST |
| Real-time tracking | DOES NOT EXIST |
| Admin location view | DOES NOT EXIST |
| Geofence arrival verification | DOES NOT EXIST |

---

## GPS Consent Requirements

Before any location capture, employees must:
1. Read a GPS/Location Tracking Disclosure (managed via the onboarding form system)
2. Check an acknowledgment checkbox
3. Sign with typed name
4. Timestamp is recorded server-side with IP

The GPS consent form must disclose:
- What location data is collected
- When collection occurs (during active assignments only)
- How long data is retained
- Who can see the data (admin/owner only)
- That employees can see their own tracking status
- That off-duty tracking requires separate opt-in (default: OFF)

**Platform behavior when consent not given:**
- GPS tracking disabled entirely for that employee
- Employee can still update status manually
- No location capture on clock-in/out
- Admin sees "GPS: Consent Not Given" for that employee

---

## Database Schema

### `employee_location_pings`
```sql
CREATE TABLE employee_location_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES assignments(id) ON DELETE SET NULL,
  latitude decimal(10, 7) NOT NULL,
  longitude decimal(10, 7) NOT NULL,
  accuracy_meters decimal(8, 2),
  speed_mps decimal(8, 2),
  heading_degrees decimal(6, 2),
  altitude_meters decimal(8, 2),
  captured_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'browser'
    CHECK (source IN ('browser', 'manual', 'simulated')),
  -- 'simulated' only permitted for is_test=true employees
  consent_version_id uuid REFERENCES onboarding_form_versions(id),
  -- links to the GPS consent form version active at time of capture
  session_id uuid,
  -- groups pings from a single work session
  is_test boolean NOT NULL DEFAULT false
);

CREATE INDEX idx_location_pings_employee_time
  ON employee_location_pings (employee_id, captured_at DESC);

CREATE INDEX idx_location_pings_assignment
  ON employee_location_pings (assignment_id, captured_at DESC);
```

---

## Tracking Modes

### Mode A: Arrival Snapshot (MVP — implement first)
Capture ONE location ping at each status transition:
- When employee clicks "En Route" → capture location
- When employee clicks "Arrive" → capture location, store in `assignments.geo_arrive`
- When employee clicks "Complete" → capture location, store in `assignments.geo_complete`

This is the minimum viable GPS. No continuous tracking. Low privacy risk. Still requires consent disclosure.

**Server changes needed:**
In `employeeAssignments.ts` status route — when accepting lat/lng in request body:
```typescript
// Already has status endpoint — add optional geo fields
const { status, latitude, longitude, accuracy } = req.body;
if (latitude && longitude) {
  await supabase.from('employee_location_pings').insert({
    employee_id: actor.employeeId,
    assignment_id: id,
    latitude, longitude, accuracy_meters: accuracy,
    source: 'browser',
    consent_version_id: actor.gpsConsentVersionId
  });
  // Also update assignments.geo_arrive / geo_complete
}
```

### Mode B: Active Session Tracking (Phase 2 — post-beta)
Continuous location ping every N seconds while assignment status is `en_route` or `in_progress`.

**Client behavior:**
```typescript
// Start tracking when status → en_route
const watchId = navigator.geolocation.watchPosition(
  (pos) => sendLocationPing(pos, assignmentId),
  (err) => console.warn('GPS denied', err),
  { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
);
// Stop tracking when status → completed / no_show / skipped
navigator.geolocation.clearWatch(watchId);
```

Pings sent to `POST /api/employee/assignments/:id/location` (new endpoint).

**Rate limiting:** Maximum 1 ping per 30 seconds per employee. Server enforces.

**Off-duty tracking:** Default = OFF. Separate opt-in form required. Do not implement for beta.

---

## Privacy & Retention Policy

| Setting | Default | Configurable? |
|---------|---------|---------------|
| Tracking active during | Active assignments only | No |
| Off-duty tracking | Disabled | Future opt-in |
| Location retention | 90 days | Yes (admin setting) |
| Employee can view own pings | YES | No |
| Admin can view live location | YES (during active assignment) | No |
| Third-party sharing | NEVER | No |
| Data deletion on termination | YES — all pings deleted | No |

---

## Geofence Arrival Verification

Optional enhancement: Verify employee is actually at the property when marking "Arrived".

**Implementation:**
```typescript
// Client sends location with arrive action
const geo = await getCurrentPosition();
await fetch(`/api/employee/assignments/${id}/arrive`, {
  method: 'POST',
  body: JSON.stringify({ latitude: geo.lat, longitude: geo.lng })
});

// Server checks distance from property lat/lng
const distanceMeters = haversine(
  { lat: assignment.property.lat, lng: assignment.property.lng },
  { lat: latitude, lng: longitude }
);
if (distanceMeters > 500) {
  // Log discrepancy — don't block (GPS can be imprecise)
  // Send admin alert if distance > 2000m
}
```

**Policy:** Never block the employee from marking arrived due to GPS discrepancy. Log and alert only. GPS can be inaccurate especially in rural areas.

---

## Admin GPS View

**Location:** Admin Appointments or Employee tracking page (new)
**Features:**
- See each active employee's last known location (most recent ping within last 30 minutes)
- Status: "En Route to [address]", "At [address]", "Offline"
- Cannot see location when employee is not on active assignment
- Map pins for each active technician

**API:** `GET /api/admin/employees/locations`
Returns: array of `{ employee_id, name, last_ping_at, latitude, longitude, assignment_id, status }`

---

## Employee GPS Status Indicator

On employee dashboard:
```
GPS Tracking: ● Active   — Location shared during active assignments
GPS Tracking: ○ Disabled — Location consent required
GPS Tracking: ⚠ Denied   — Enable in browser settings
```

Employee can tap to see:
- Their consent history
- What data has been captured (summary count)
- Link to privacy disclosure

---

## MVP Implementation Order

1. Add `employee_location_pings` table (migration)
2. Add GPS consent to onboarding form system
3. Check consent before any capture (server-side flag on employee record)
4. Capture snapshot pings on status transitions (arrival + completion)
5. Store `geo_arrive` and `geo_complete` on assignments
6. Admin employee list: show GPS consent status
7. (Phase 2) Continuous tracking during en_route/in_progress
8. (Phase 2) Admin live map
9. (Phase 2) Geofence arrival verification with admin alert
