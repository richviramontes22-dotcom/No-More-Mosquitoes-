# EMPLOYEE EVENT TRACKING AUDIT
## Generated: 2026-05-29
## Scope: All employee actions, how they are stored, and admin visibility

---

## Event 1: Account Creation / Invite

| Field | Value |
|-------|-------|
| **Stored?** | Yes |
| **Table** | `auth.users` (Supabase managed) + `profiles` (role=employee) + `employees` (role, phone, vehicle, default_nav, status) |
| **Admin Visible?** | Yes |
| **Admin Location** | `/admin/employees` — employee roster table |
| **Auditable?** | Partially — `employees.created_at` and `profiles.created_at` are stored. No log of who sent the invite. |
| **Gap** | No invite log (who invited whom, when the invite was accepted vs created). `employees` table lacks an `invited_by` column. No email capture of failed invite attempts. |

---

## Event 2: Login

| Field | Value |
|-------|-------|
| **Stored?** | No |
| **Table** | Supabase Auth internal only (`auth.users.last_sign_in_at`) |
| **Admin Visible?** | No |
| **Admin Location** | Nowhere |
| **Auditable?** | No |
| **Gap** | Admin has no visibility into when an employee last logged in. Cannot determine if an employee has accepted their invite. Cannot identify employees who have never logged in. Critical for accountability. |

---

## Event 3: Profile Update

| Field | Value |
|-------|-------|
| **Stored?** | Partially — `employees` table stores current state (role, phone, vehicle, default_nav, status). `profiles` stores current name/email. |
| **Table** | `employees`, `profiles` |
| **Admin Visible?** | Yes (current state) |
| **Admin Location** | `/admin/employees` — visible in employee table and edit dialog |
| **Auditable?** | No — no history of changes |
| **Gap** | No change log. Admin cannot see that "Luis M. changed his phone number on May 15" or "Employee was deactivated by Admin X on May 20." No `updated_at` column on `employees` table (only `created_at`). |

---

## Event 4: Assignment Receipt (Notification)

| Field | Value |
|-------|-------|
| **Stored?** | Yes — assignment record created + email sent (if email configured) |
| **Table** | `assignments` — row with `status='scheduled'`, `appointment_id`, `employee_id` |
| **Admin Visible?** | Partially |
| **Admin Location** | `/admin/appointments` — `assignmentMap` shows employee_id per appointment. Employee name shown as "Unassigned" or employee name in Technician column. |
| **Auditable?** | Partially — assignment `created_at` is implicit (not selected in queries). No log of notification delivery to employee. |
| **Gap** | No timestamp showing when the employee was notified. No confirmation that the employee viewed the assignment. No read-receipt or acknowledgment. |

---

## Event 5: Assignment View (Opening AssignmentDetail)

| Field | Value |
|-------|-------|
| **Stored?** | No |
| **Table** | None |
| **Admin Visible?** | No |
| **Admin Location** | Nowhere |
| **Auditable?** | No |
| **Gap** | No record when an employee opens the AssignmentDetail page. Admin cannot determine if the employee was aware of their assignment. If an employee claims they "didn't see" the assignment, there is no way to verify. |

---

## Event 6: Status Updates (assigned → en_route → in_progress → completed / canceled)

| Field | Value |
|-------|-------|
| **Stored?** | Yes |
| **Table** | `assignments` — status field + lifecycle timestamps: `en_route_at`, `arrived_at`, `started_at`, `completed_at` |
| **Admin Visible?** | Partially |
| **Admin Location** | `/admin/employee-tracking` (current status only — idle/en_route/in_progress), `/admin/visits` (completed appointments), `/admin/appointments` (appointment status reflects assignment) |
| **Auditable?** | Partially — all four timestamps are stored for each assignment |
| **Gap** | Admin cannot see the full timeline "en_route at 8:15, arrived at 8:32, started at 8:40, completed at 9:10" in any admin page. The employee tracking page only shows current status. The visits page does not show assignment lifecycle timestamps. A dedicated "Assignment History" or "Job Detail" page does not exist in admin. |

---

## Event 7: Job Media Upload (Photo/Video)

| Field | Value |
|-------|-------|
| **Stored?** | Yes — DB row created + file stored in Supabase Storage `job-media` bucket |
| **Table** | `job_media` — `assignment_id`, `media_type`, `url`, `caption`, `created_at` |
| **Admin Visible?** | Partially — `/admin/visits` has a `video_url` column in the Visit type definition, and a Play button renders if `video_url` is truthy, BUT the query in Visits.tsx does NOT query `job_media` table. It only checks a `video_url` column on the appointments table (which may not exist). |
| **Auditable?** | No — no admin page shows the full `job_media` table |
| **Gap** | **Critical gap**: Admin has no way to view photos uploaded by employees. The `job_media` table is populated by the employee portal but admin has no query or UI that reads from it. The Visits page references `video_url` as if it were on the appointment record — not as a join from `job_media`. The storage bucket exists and RLS allows read by authenticated users, but no admin UI renders it. |

---

## Event 8: Job Notes

| Field | Value |
|-------|-------|
| **Stored?** | Partially — `assignments` table does not have a dedicated notes column. `appointments.notes` can be written but is also used for scheduling notes. `job_checklists` table exists. |
| **Table** | `appointments.notes` (shared with scheduling notes), `job_checklists` (JSONB checklist data) |
| **Admin Visible?** | Partially — `appointments.notes` shows in the Modify dialog for admins. `job_checklists` not shown anywhere in admin. |
| **Auditable?** | No |
| **Gap** | No dedicated field for technician job completion notes (separate from scheduling notes). `job_checklists` data is invisible to admin. `chemicals_logs` data is invisible to admin. |

---

## Event 9: Route Activity / GPS Location

| Field | Value |
|-------|-------|
| **Stored?** | No |
| **Table** | `time_events` table exists with `geo geography(point,4326)` column. `assignments.geo_arrive` and `geo_complete` columns exist. But no location data is being written. |
| **Admin Visible?** | No |
| **Admin Location** | `/admin/employee-tracking` — map component renders but `location` is always `null` per `server/routes/adminTracking.ts` |
| **Auditable?** | No |
| **Gap** | **GPS tracking is not implemented.** The comment in `adminTracking.ts` explicitly says "GPS location is not implemented — no live device tracking exists yet." The employee portal (`AssignmentDetail`) does not call any GPS-reporting API. No technician app location sharing is wired. The tracking page shows a map with zero data. |

---

## Event 10: Shift Check-In/Check-Out

| Field | Value |
|-------|-------|
| **Stored?** | No |
| **Table** | `shifts` table exists with `clock_in_at`, `clock_out_at` columns. `time_events` table exists for granular events. But no UI or API writes to these tables. |
| **Admin Visible?** | No |
| **Admin Location** | Nowhere |
| **Auditable?** | No |
| **Gap** | **Shift tracking is not implemented.** Tables exist in the schema (`shifts`, `time_events`) but no employee portal route writes clock-in/clock-out events. No admin page queries `shifts`. Hours worked per employee = impossible to calculate. |

---

## Event 11: Pay / Compensation Records

| Field | Value |
|-------|-------|
| **Stored?** | No |
| **Table** | No compensation/pay table found in any migration |
| **Admin Visible?** | No |
| **Admin Location** | Nowhere |
| **Auditable?** | No |
| **Gap** | There is no pay rate, commission, or compensation model in the database. If technicians are paid per job, there is no system to calculate or track this. If salaried, there is no HR/payroll integration. |

---

## Summary Table

| Event | Stored | Admin Visible | Auditable | Gap Severity |
|-------|--------|--------------|-----------|--------------|
| Account creation | Yes | Yes | Partial | Medium |
| Login | No | No | No | High |
| Profile update | Partial | Yes (current) | No | Medium |
| Assignment receipt | Yes | Partial | Partial | Medium |
| Assignment view | No | No | No | High |
| Status updates | Yes | Partial | Partial | Medium |
| Job media upload | Yes (DB/storage) | No | No | Critical |
| Job notes | Partial | Partial | No | High |
| GPS/Route activity | No | No | No | Critical |
| Shift check-in/out | No | No | No | High |
| Pay/compensation | No | No | No | Medium |

---

## Critical Findings

### Finding 1: Job Media is Invisible to Admin
Employee photos uploaded via `job_media` table are stored in Supabase Storage but NO admin page reads from this table. The Visits page references `video_url` as a hypothetical field on appointments, but `job_media` is a separate table with an `assignment_id` foreign key. Admin genuinely cannot see job photos.

### Finding 2: GPS Tracking is Explicitly Not Implemented
The comment in `server/routes/adminTracking.ts` line 7-9 reads: "NOTE: location (lat/lng) is NOT real GPS — no live tracking is implemented. The location field is always null until Phase 3B wires real device coordinates." The Employee Tracking page is therefore showing a map with no data.

### Finding 3: Shift Tracking Schema Exists But Is Unused
`shifts` and `time_events` tables were created in `db/migrations/2025-11-10_employee_portal.sql` and `db/migrations/2025-11-28_missing_tables.sql`. No server route writes to these tables. Zero employee time-tracking data is being collected.

### Finding 4: No Assignment View Acknowledgment
There is no mechanism to know if an employee reviewed their assignment. A technician could show up late or not at all, and admin would only discover this when the appointment status is never updated to `en_route`.

### Finding 5: Assignment Status History is Stored But Not Displayed
The four lifecycle timestamps (`en_route_at`, `arrived_at`, `started_at`, `completed_at`) are stored in the `assignments` table but no admin page surfaces them. Admin cannot reconstruct the timeline of a job.
