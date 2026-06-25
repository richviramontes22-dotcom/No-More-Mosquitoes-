# Phase 12 — Employee Operations Implementation Plan
**Date:** 2026-05-31
**Project:** No More Mosquitoes — Employee Operations Sprint

---

## Executive Summary

The employee portal has a solid operational core — assignment lifecycle, media, messaging, timesheets, and navigation all work. The critical gaps are:

1. **Data consistency bugs** (in-memory routes used where Supabase should be)
2. **GPS captured but not stored**
3. **Checklist not persisted**
4. **No legal/onboarding system at all**
5. **Route optimization tables exist but zero code uses them**
6. **No worker classification or test employee support**

This plan sequences work from lowest-risk/highest-impact to highest-risk/most-complex.

---

## Sprint 0: Data Integrity Fixes (Do This First — No New Features)
**Effort:** 1-2 days | **Risk:** Low

These are existing bugs that corrupt data today.

| Fix | File(s) | Change |
|-----|---------|--------|
| Fix shift persistence | `server/routes/employeeShifts.ts`, `client/pages/employee/Dashboard.tsx` | Remove in-memory db from employeeShifts.ts; write to Supabase; Dashboard.tsx calls API instead of direct Supabase write |
| Fix messages route | `server/routes/employeeMessages.ts` | Replace in-memory db with Supabase queries (same pattern as employeeAssignments.ts) |
| Fix GPS storage | `server/routes/employeeAssignments.ts` | Accept lat/lng in status and arrive requests; write to `employee_location_pings` table; set `geo_arrive`/`geo_complete` on assignments |
| Persist checklist | `server/routes/employeeAssignments.ts` + new endpoint | `POST /api/employee/assignments/:id/checklist`; write to `job_checklists` table |
| Remove in-memory | `server/lib/memory.ts` (or equivalent) | Delete in-memory shift/message storage; use Supabase everywhere |

---

## Sprint 1: Worker Classification + Test Employee (1-2 days)
**Effort:** Small | **Risk:** Low (additive DB fields only)

### Database Migration
```sql
ALTER TABLE employees
  ADD COLUMN worker_type text NOT NULL DEFAULT 'employee'
    CHECK (worker_type IN ('employee', 'contractor', 'vendor', 'test')),
  ADD COLUMN is_test boolean NOT NULL DEFAULT false,
  ADD COLUMN emergency_contact_name text,
  ADD COLUMN emergency_contact_phone text,
  ADD COLUMN emergency_contact_relation text;
```

### Admin UI Changes
- Employees invite form: add "Worker Type" select (employee/contractor/vendor/test)
- Employees invite form: add "Test Account" toggle (sets is_test = true)
- Employees list: show worker_type badge and is_test indicator
- Allow hard delete for `is_test = true` employees only

### Server Changes (`adminEmployees.ts`)
- Accept `worker_type` and `is_test` in invite and PATCH endpoints
- When `generate_temp_password: true` and `is_test: true`: use `supabaseAdmin.auth.admin.createUser()` with generated password instead of email invite
- `DELETE /api/admin/employees/:id` — only for `is_test = true`
- Assignment response: mask customer PII when employee `is_test = true`

### Employee Dashboard
- Show "⚠ TEST ACCOUNT" banner when employee.is_test

---

## Sprint 2: GPS Consent Gate + Snapshot Tracking (2-3 days)
**Effort:** Medium | **Risk:** Medium (legal compliance required)

**Prerequisite:** Attorney must review and approve GPS consent disclosure text before this goes live.

### Database Migration
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
  captured_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'browser'
    CHECK (source IN ('browser', 'manual', 'simulated')),
  consent_version_id uuid,
  is_test boolean NOT NULL DEFAULT false
);
CREATE INDEX idx_location_pings_employee ON employee_location_pings(employee_id, captured_at DESC);
```

### Server Changes
- `POST /api/employee/assignments/:id/status` — accept optional `latitude`, `longitude`, `accuracy`; write to `employee_location_pings`; update `geo_arrive`/`geo_complete` on assignments
- `GET /api/admin/employees/locations` — return last ping per active employee (within 30 min)
- Consent check: before storing any ping, verify `employee.gps_consent_version_id IS NOT NULL`

### Client Changes
- GPS consent gate on first use: modal explains tracking before requesting permission
- Status buttons in AssignmentDetail.tsx: request current position before submitting status
- GPS status indicator on employee profile page

### Defer to Phase 2
- Continuous watchPosition tracking
- Live admin map
- Geofence arrival verification

---

## Sprint 3: Onboarding Form Management — Foundation (3-5 days)
**Effort:** Large | **Risk:** Medium

### Database Migrations
Five new tables (see Phase 4 schema):
- `onboarding_forms`
- `onboarding_form_versions`
- `employee_onboarding_assignments`
- `employee_form_signatures` (immutable after insert)
- `employee_document_uploads`
- `onboarding_audit_log`

### Admin Implementation
- `/admin/settings/legal` — legal & compliance settings tab
- CRUD for onboarding forms (create, upload PDF, add version, activate/deactivate)
- Per-employee onboarding completion view
- Export signed records

### Server Implementation
```
GET  /api/admin/onboarding/forms
POST /api/admin/onboarding/forms
POST /api/admin/onboarding/forms/:id/versions
GET  /api/admin/onboarding/employees/:employeeId
GET  /api/employee/onboarding
GET  /api/employee/onboarding/:assignmentId
POST /api/employee/onboarding/:assignmentId/sign
POST /api/employee/onboarding/:assignmentId/upload
```

### Client Implementation (Employee)
- `/employee/onboarding` — list of pending/completed forms
- Acknowledgment modal: read text → checkbox → type name → submit
- PDF viewer (embedded iframe or new tab) for pdf_view forms
- Upload flow for document uploads (e.g., driver's license)
- Dashboard banner: "N documents pending"

### Auto-Assignment on Invite
In `adminEmployees.ts` `POST /api/admin/employees/invite`:
- After creating employee: query `onboarding_forms` where `required_for` contains worker_type and `is_active = true`
- For each active form version: insert `employee_onboarding_assignments` row

### IP Capture
Sign endpoint: capture `req.ip` and `req.headers['user-agent']` server-side. Never trust client-supplied values.

---

## Sprint 4: Checklist Persistence + Photo Labeling (1 day)
**Effort:** Small | **Risk:** Low

- `POST /api/employee/assignments/:id/checklist` — save checklist item states to `job_checklists`
- `GET /api/employee/assignments/:id` — return saved checklist state
- Add `photo_type` ('before' | 'after' | 'issue' | 'general') to media upload flow
- Show uploaded photo thumbnails inline in assignment detail

---

## Sprint 5: Route Management — Admin Proposal UI (3-5 days)
**Effort:** Large | **Risk:** Low (well-defined algorithm, no AI)

### Database Migration
Extend existing `routes` and `route_stops` tables (see Phase 8 schema addendum).

### Server Implementation
```
POST /api/admin/routes/generate   — run MVP algorithm, return proposal
POST /api/admin/routes            — save draft
PATCH /api/admin/routes/:id/stops — reorder/reassign
POST /api/admin/routes/:id/approve — create assignments, notify employees
GET  /api/employee/routes/today    — employee's ordered route
```

### Algorithm Implementation
File: `server/services/routing/routingEngine.ts`
- Group by ZIP → sort by priority → assign to technicians by capacity
- Haversine distance estimates between stops
- Conflict detection (overlap, missing coords, over-capacity)
- Returns `RouteProposal` object

### Admin UI
- New page `/admin/routes`
- Date picker → Generate → Review proposal → Drag to reorder → Approve & Notify

### Employee UI
- Upgrade `/employee/assignments` to show route sequence order when route exists
- New `/employee/route` page with ordered stop list
- "Navigate to Next Stop" button

---

## Sprint 6: Map Integration (2-3 days)
**Effort:** Medium | **Risk:** Low (library integration only)

### Recommended: Mapbox GL JS
- Free tier: 50,000 map loads/month (sufficient for this scale)
- Add to package.json: `mapbox-gl` and `react-map-gl`
- `VITE_MAPBOX_TOKEN` environment variable

### Replace MiniMap.tsx
- Show real satellite/street map centered on property coordinates
- Property pin with address popup
- "Navigate" deep link button

### Employee Route Map
- All today's stops as numbered pins
- Employee current location dot (if GPS consent given)
- Connecting lines in sequence order

### Admin Route Map (in Route Proposal UI)
- Stop pins per technician (different color per tech)
- Sequence numbers on pins
- Unassigned stops as gray pins

---

## Sprint 7: Upcoming Assignments + Dashboard Improvements (1 day)
**Effort:** Small | **Risk:** Low

- Add "This Week" tab to `/employee/assignments`
- Group by date, sorted by seq/scheduled_at
- Dashboard quick stat: "Next 7 days: N stops"
- Assignment accept/decline flow for 'scheduled' status

---

## Deferred (Post-Beta)

| Feature | Reason to Defer |
|---------|----------------|
| Continuous GPS tracking (watchPosition) | Requires more battery/UX testing |
| Live admin map with real-time employee positions | Depends on continuous tracking |
| Auto-route mode (no admin approval) | Too much operational risk before validation |
| Google Maps Distance Matrix real drive times | Cost; MVP algorithm sufficient to start |
| Document export (PDF of signatures) | Nice-to-have; CSV export sufficient |
| Offline queue (service worker, IndexedDB) | Requires significant client architecture |
| Break time enforcement (CA 4-hour rule) | UI exists; calculation enforcement complex |
| Arbitration agreement | Attorney must review before adding |
| Contractor onboarding | Legal classification review required first |
| Employee notifications in-app bell | After in-app notification infrastructure added |

---

## Migration Order

Run these migrations in order before any sprint:

```
Sprint 0:  (no migration — code fixes only)
Sprint 1:  2026-05-31_worker_type_and_test_employee.sql
Sprint 2:  2026-05-31_employee_location_pings.sql
Sprint 3:  2026-05-31_onboarding_form_management.sql (5 tables)
Sprint 4:  (no migration — job_checklists exists; add photo_type to job_media)
Sprint 5:  2026-05-31_extend_routes_and_route_stops.sql
Sprint 6:  (no migration — Mapbox is client-only)
```

---

## Team Checkpoints Before Each Sprint

| Before Sprint | Checkpoint |
|---------------|------------|
| Sprint 2 | Attorney reviews GPS consent disclosure text |
| Sprint 3 | Attorney reviews: which forms are legally required vs. recommended |
| Sprint 3 | Owner decides: W2 only at launch, or include contractor path? |
| Sprint 5 | Owner validates: proposal-mode routing with test data before approve flow built |
| Post-beta | Attorney reviews arbitration agreement before adding |
| Post-beta | Consult CA DPR on pesticide applicator documentation requirements |
