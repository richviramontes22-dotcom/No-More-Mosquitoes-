# Phase 1 — Employee System Audit
**Date:** 2026-05-31
**Project:** No More Mosquitoes — Employee Operations Sprint

---

## Summary Verdict

The employee system is **substantially built but operationally incomplete**. A working portal exists with authentication, assignment lifecycle management, media upload, messaging, timesheets, and navigation deep-links. However, GPS is captured but not persisted, checklists are not saved, the routing tables are never used, the in-memory routes are inconsistent with direct Supabase writes on the client, and the entire onboarding/legal layer is absent.

---

## Client Routes (App.tsx)

| Route | Component | Status |
|-------|-----------|--------|
| `/employee/login` | EmployeeLogin.tsx | Working |
| `/employee` | EmployeeDashboard.tsx | Working |
| `/employee/assignments` | EmployeeAssignments.tsx | Working |
| `/employee/assignments/:id` | AssignmentDetail.tsx | Working (checklist not persisted) |
| `/employee/messages` | EmployeeMessages.tsx | Partial (no customer name enrichment) |
| `/employee/timesheets` | EmployeeTimesheets.tsx | Working |
| `/employee/profile` | EmployeeProfile.tsx | Working |

All routes are guarded by `RequireEmployee.tsx`, which checks `AuthContext.isAuthenticated` and role, redirecting unauthenticated users to `/employee/login`.

---

## Server API Routes

| Route | File | Status |
|-------|------|--------|
| `POST /api/employee/login` | employeeAuth.ts | **STUB — returns 501** |
| `GET /api/employee/assignments` | employeeAssignments.ts | Working |
| `GET /api/employee/assignments/:id` | employeeAssignments.ts | Working |
| `POST /api/employee/assignments/:id/status` | employeeAssignments.ts | Working |
| `POST /api/employee/assignments/:id/arrive` | employeeAssignments.ts | Working |
| `POST /api/employee/assignments/:id/media` | employeeAssignments.ts | Working |
| `POST /api/employee/shifts/clock-in` | employeeShifts.ts | **IN-MEMORY ONLY** |
| `POST /api/employee/shifts/clock-out` | employeeShifts.ts | **IN-MEMORY ONLY** |
| `GET /api/employee/timesheets` | employeeShifts.ts | **IN-MEMORY ONLY** |
| `GET /api/employee/messages` | employeeMessages.ts | **IN-MEMORY ONLY** |
| `POST /api/employee/messages` | employeeMessages.ts | **IN-MEMORY ONLY** |
| `GET /api/admin/employees` | adminEmployees.ts | Working |
| `POST /api/admin/employees/invite` | adminEmployees.ts | Working |
| `PATCH /api/admin/employees/:id` | adminEmployees.ts | Working |

---

## Employee Dashboard — What Exists

### 1. Clock In / Out Widget
- Component: `ClockWidget.tsx`
- Dashboard.tsx directly writes to Supabase `shifts` table (not through API route)
- Captures device geolocation on clock-in/out via `navigator.geolocation.getCurrentPosition`
- Geolocation coords obtained but **NOT stored** in any database column
- `time_events.geo` geography column exists in DB — never populated
- Shows today's stop count and completed count from assignments

### 2. Assignments List (`/employee/assignments`)
- Lists today's assignments for the authenticated employee
- Status badges: completed (green), en_route (blue), in_progress (indigo), assigned (amber), no_show (red), skipped (gray)
- Displays: scheduled time, customer name, address, city
- Default date = today; date param accepted from query string
- Links each row to `/employee/assignments/:id`

### 3. Assignment Detail (`/employee/assignments/:id`)
- **Customer & Property Info:** Address, city/zip, customer phone (tel: link), service type, appointment notes
- **Property Coordinates:** lat/lng from `properties` table shown in MiniMap (placeholder display only)
- **Status Buttons:**
  - "En Route" → transitions to `en_route`, sets `en_route_at`
  - "Arrive" → transitions to `in_progress`, sets `arrived_at` and `started_at`
  - "Complete" → transitions to `completed`, sets `completed_at`; also updates appointment status
  - "No Show" / "Skip" → sets status with notification + admin alert
- **Navigation:** Deep link opens Google Maps or Apple Maps based on employee preference
- **In-App Messaging:** Real-time thread with customer; writes directly to Supabase `message_threads` and `messages` tables
- **Pre-Service Checklist:** Six hardcoded items (PPE, pets, hazards, products, customer notified, safety zones) — **checkboxes are client-side only, NOT persisted to DB**
- **Job Media Upload:** Writes to Supabase `job_media` table; supports camera capture; stores URL, media_type (photo/video/doc), caption
- **Status Timeline:** Shows en_route_at, arrived_at, started_at, completed_at timestamps

### 4. Timesheets (`/employee/timesheets`)
- Weekly view with week navigation
- Reads from Supabase `shifts` table (fetched via `useEmployeeTimesheets` hook)
- Columns: Date, Clock In, Clock Out, Break, Hours Worked
- CSV export button
- **Note:** `employeeShifts.ts` server route uses in-memory db — not the same data source as Dashboard.tsx Supabase writes

### 5. Messages (`/employee/messages`)
- Lists message threads for the employee's assignments
- Shows last activity date
- **Missing:** Customer name/address enrichment (shows placeholder text)
- Links to assignment detail for full thread

### 6. Profile (`/employee/profile`)
- Editable: phone number, vehicle description, default navigation app
- Read-only: email, role, status, employee ID
- Saves to `employees` table via Supabase direct write

---

## Employee Actions — Capabilities Summary

| Action | Implemented | Persisted |
|--------|-------------|-----------|
| Clock in/out | YES | YES (Supabase — shifts table) |
| GPS capture on clock-in | YES (capture) | NO (not stored) |
| View today's assignments | YES | YES |
| View assignment detail | YES | YES |
| Update assignment status (en_route/arrive/complete) | YES | YES |
| Mark no-show / skip | YES | YES |
| Navigate to customer address | YES (deep link) | N/A |
| Send in-app message to customer | YES | YES (Supabase) |
| Upload job media (photo/video) | YES | YES (Supabase) |
| Pre-service checklist | YES (UI) | NO (not persisted) |
| View timesheet history | YES | YES |
| Export timesheet CSV | YES | N/A |
| Update profile | YES | YES |
| Receive push notifications | NO | N/A |
| View route/map | Placeholder only | N/A |
| Real-time GPS tracking | NO | N/A |
| View customer property notes | YES (appointment notes) | YES |

---

## Admin Capabilities for Employee Management

| Action | Implemented | Notes |
|--------|-------------|-------|
| Invite employee (send setup email) | YES | Supabase `admin.inviteUserByEmail()` |
| Set role (technician/dispatcher/admin) | YES | On invite + edit |
| Set phone, vehicle, default nav | YES | On invite + edit |
| Activate / deactivate employee | YES | PATCH status |
| View all employees list | YES | With profile enrichment |
| Dispatch appointment to employee | YES | adminAppointments.ts |
| Cancel employee assignment | YES | adminAppointments.ts |
| View assignment status | YES | Via assignments table |
| View job media | Partial | No dedicated admin UI for media |
| Receive admin alerts (complete/no-show/skip) | YES | adminNotificationService |
| View employee GPS location | NO | Not implemented |

---

## Data Model — Key Tables

| Table | Status | Notes |
|-------|--------|-------|
| `employees` | Active | role, phone, vehicle, default_nav, status |
| `shifts` | Active | clock_in_at, clock_out_at, break_minutes |
| `time_events` | Defined but unused | geo column exists, never populated |
| `assignments` | Active | Full lifecycle timestamps present |
| `job_media` | Active | photo/video/doc uploads |
| `routes` | Defined, NEVER USED | draft/assigned/in_progress/completed |
| `route_stops` | Defined, NEVER USED | seq, eta, status |
| `job_checklists` | Defined, NEVER USED | checklist items table exists |
| `message_threads` | Active | assignment-linked threads |
| `messages` | Active | direction, channel, delivered_at, read_at |

---

## Critical Inconsistencies

### 1. Shift Persistence Split
- `Dashboard.tsx` writes shifts directly to Supabase
- `employeeShifts.ts` route uses in-memory `db` from `memory.ts`
- These are NOT the same data source — shifts written by Dashboard won't appear via the API route
- **Risk:** Timesheet data may be incomplete or duplicated

### 2. Messages Route vs Direct Write
- `AssignmentDetail.tsx` writes messages directly to Supabase
- `employeeMessages.ts` route uses in-memory db
- The API route is effectively dead code for the current client

### 3. GPS Capture Without Storage
- `ClockWidget.tsx` captures geolocation coordinates
- Coordinates are passed to `handleClockIn(geo)` but the Dashboard handler does not save them to any column
- `time_events.geo` column exists — never written to

### 4. Checklist Not Persisted
- `AssignmentDetail.tsx` has 6-item pre-service checklist
- UI state only — no API call, no DB write
- `job_checklists` table exists in schema — never referenced in code

### 5. MiniMap Is Placeholder
- `MiniMap.tsx` shows diagonal stripe background with coordinate text
- No mapping library (Mapbox, Leaflet, Google Maps) integrated
- Cannot show real employee location or route

### 6. Routes/Route_Stops Never Used
- Two tables exist in DB schema for route management
- Zero code references these tables in any server route or client hook
- Full routing feature is absent from current implementation

### 7. Offline Queue Unused
- `client/lib/employee/offlineQueue.ts` exports queue functions
- Never imported by any component or hook
- Dead code

### 8. employeeAuth.ts Returns 501
- Login route registered but not implemented
- Auth relies entirely on Supabase Auth (which works correctly)
- Route is misleadingly registered but non-functional

---

## Assessment

| Dimension | Score | Notes |
|-----------|-------|-------|
| Assignment lifecycle | 9/10 | Complete end-to-end with timestamps and notifications |
| Media upload | 8/10 | Works; no admin view UI |
| Messaging | 7/10 | Works; inconsistent server route |
| Timesheet | 6/10 | Works but split data source is a bug |
| GPS tracking | 1/10 | Captured, not stored, no real-time |
| Route management | 0/10 | Tables exist, zero code |
| Onboarding | 0/10 | Nothing exists |
| Legal/compliance | 0/10 | Nothing exists |
| Offline support | 0/10 | Queue defined, never used |
| Checklist persistence | 0/10 | UI exists, not saved |

**Overall employee system readiness: 5/10**
Strong operational core. Missing: legal layer, GPS persistence, routing, checklist persistence, and consistent data sources.
