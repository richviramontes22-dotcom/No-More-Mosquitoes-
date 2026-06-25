# Workforce Sprint B Architecture
**Date:** 2026-06-02
**Status:** Implementation-ready plan — NOT yet built

---

## G1 — PTO / Time-Off Request System

### Database (new table)
```sql
CREATE TABLE public.technician_time_off_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('pto','unpaid','sick','unavailable')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','canceled')),
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### API routes (new in `server/routes/adminWorkforce.ts` + `server/routes/employeeWorkforce.ts`)
```
POST   /api/employee/time-off           — employee submits request
GET    /api/employee/time-off           — employee views own requests
GET    /api/admin/workforce/time-off    — admin views all pending requests
PATCH  /api/admin/workforce/time-off/:id/approve
PATCH  /api/admin/workforce/time-off/:id/reject
DELETE /api/admin/workforce/time-off/:id  — cancel
```

### Integration with availability service
`isTechnicianAvailable()` already has the graceful try/catch for `technician_time_off_requests` — the table just needs to be created and the query will start working automatically.

### Admin notifications
When employee requests PTO → `notifyAdmin({ event_type: "workforce.pto_requested", severity: "info" })`
When admin approves/rejects → email notification to employee (Sprint B notification work)

---

## G2 — Employee Portal Expansion

### `/employee/schedule` (new page)
Shows the employee's weekly schedule template (read-only):
- Days on/off
- Work hours
- Date overrides (upcoming)
- Pending/approved time-off requests
- Action: "Request Time Off" button

### `/employee/route` (already exists — enhance)
Add:
- Route date selector (past routes)
- Route status summary

### UI Files to Create
- `client/pages/employee/Schedule.tsx` — weekly view
- Add "Schedule" to `client/pages/employee/EmployeeLayout.tsx` sidebar

---

## G3 — Workforce Notifications

### Employee notifications (when admin updates schedule/route)

| Event | Trigger | Channel |
|-------|---------|---------|
| Route published | `POST /routes/day/publish` | Email + optional SMS |
| Route changed | After route modification | Email |
| PTO approved | Admin approves request | Email |
| PTO rejected | Admin rejects request | Email |
| Schedule updated | Admin saves new template | Email |

### Implementation approach
Use the existing `employeeNotificationService.ts` pattern:
```typescript
notifyEmployeeScheduleChange(employeeId, { type: "route_published", date })
notifyEmployeePtoDecision(employeeId, { status: "approved", startDate, endDate })
```

---

## Sprint B Implementation Order

1. Create `technician_time_off_requests` migration
2. Create employee time-off API routes
3. Create admin time-off approval UI in `/admin/workforce/time-off`
4. Create `/employee/schedule` page
5. Wire PTO into `isTechnicianAvailable()` (already works — just needs table)
6. Add workforce notifications (email + SMS)

**Estimated effort:** 3–4 days of implementation work
