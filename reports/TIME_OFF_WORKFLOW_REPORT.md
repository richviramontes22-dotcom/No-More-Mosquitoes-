# Time Off Workflow Report
**Date:** 2026-06-01

---

## Overview

A complete time-off workflow has three actors: the employee who requests, the admin who approves or rejects, and the system which enforces the decision in route planning.

**None of this currently exists.** The entire workflow must be built.

---

## Request Types

| Type | Description | Paid? | Admin Approval Required? |
|------|-------------|-------|--------------------------|
| `pto` | Paid Time Off | YES | YES |
| `unpaid` | Unpaid time off | NO | YES |
| `sick` | Sick day | YES (typically) | Optional (may auto-approve) |
| `personal` | Personal day | Depends on policy | YES |
| `unavailable` | Scheduling conflict, non-illness | NO | YES |

**Platform stance:** The system tracks the type but does not calculate pay. Payroll is handled externally (Gusto, QuickBooks, etc.). The platform only determines whether the technician should receive route assignments.

---

## Employee Workflow

### Step 1: Submit Request
Employee opens `/employee/schedule` → clicks "Request Time Off" → fills form:
- **Request type**: PTO / Sick / Personal / Unavailable
- **Start date** and **End date**
- **Partial day toggle**: If yes, which hours are blocked
- **Reason** (optional text)
- Submits → status = `pending`

### Step 2: Wait for Decision
Employee sees the request in their schedule view with status indicator:
- 🟡 Pending review
- ✅ Approved
- ❌ Rejected
- 🚫 Canceled (by employee before review)

Employee can cancel a pending request before admin reviews it.

### Step 3: Notification
Employee receives notification (in-app + email) when admin approves or rejects.

---

## Admin Workflow

### Step 1: Review Request
Admin sees pending requests on `/admin/workforce/time-off`.

For each pending request, admin sees:
- Employee name, request type, dates
- **Conflict check**: "This employee has 3 assigned appointments during this period" with appointment details
- **Route conflict**: "This employee is on 2 published routes during this period"

### Step 2: Approve or Reject

**On Approve:**
1. `status` → `approved`, `reviewed_by`, `reviewed_at` set
2. System writes `technician_date_overrides` for each date in the range with `is_available = false`
3. If conflicting assignments exist: admin alert generated ("Approved time off conflicts with N scheduled assignments")
4. Employee notified

**On Reject:**
1. `status` → `rejected`, `admin_note` optionally set
2. Employee notified with admin note

### Step 3: Conflict Resolution
Admin must manually handle any assignment conflicts:
- Reassign the appointment to another technician
- Reschedule the appointment
- Leave it as-is with a warning

The system does NOT auto-reassign — this is intentional (admin control is required).

---

## Sick Day Reporting

Sick days are a special case — the employee is already absent when they report it. The workflow is:
1. Employee opens app at start of shift → taps "Report Sick Day" (or admin does it for them)
2. System creates a time-off request with `type = 'sick'`, `status = 'approved'` (auto-approved for today only)
3. Route planner marks technician unavailable for today
4. Admin receives urgent alert: "Luis called out sick — N appointments need reassignment"
5. Admin manually reassigns or cancels affected appointments

**Auto-approve rule for sick days:** Only for the current date and only if the request is created before 9 AM (configurable). Admin can still override.

---

## Conflict Detection

When a time-off request is submitted or approved, the system should detect:

### 1. Active Assignment Conflicts
```sql
SELECT a.id, apt.scheduled_date, apt.window_label
FROM assignments a
JOIN appointments apt ON apt.id = a.appointment_id
WHERE a.employee_id = $employee_id
  AND apt.scheduled_date BETWEEN $start_date AND $end_date
  AND a.status NOT IN ('completed', 'canceled', 'skipped', 'no_show')
```

### 2. Published Route Conflicts
```sql
SELECT r.id, r.date
FROM routes r
WHERE r.employee_id = $employee_id
  AND r.date BETWEEN $start_date AND $end_date
  AND r.status IN ('approved', 'published', 'in_progress')
```

Conflicts are stored in `conflicting_assignment_ids[]` on the request record and displayed to admin.

---

## Route Planner Enforcement

When a time-off request is **approved**:
1. `technician_date_overrides` is populated for every date in the range
2. Route planner checks `isTechnicianAvailable()` before assigning → technician excluded
3. Existing published routes are NOT automatically changed (admin must handle manually)
4. Draft/approved routes for the blocked dates: technician's route is flagged with conflict note

---

## Admin Alerts for Time-Off Events

| Event | Alert Severity | Alert Text |
|-------|---------------|------------|
| New PTO request | info | "Luis Martinez requested 3 days PTO (July 4–6)" |
| Sick day reported | warning | "Carlos Rivera called out sick today — 4 appointments at risk" |
| Time-off approved with conflicts | warning | "Approved time off conflicts with 2 published routes for Luis" |
| Time-off rejected | — | No admin alert (employee notified) |

---

## Out of Scope

- Accrual tracking (how many PTO hours an employee has earned)
- Carry-over calculations
- Pay calculations for PTO vs unpaid
- FMLA or legal leave tracking
- Multi-level approval chains

These are handled by the external payroll provider (Gusto, etc.).
