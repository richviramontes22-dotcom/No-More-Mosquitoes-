# Employee Workflow Verification
**Date:** 2026-06-08
**Basis:** Source code inspection — employeeAssignments.ts, employeeAuth.ts, employeeShifts.ts, employeeMessages.ts, adminRoutes.ts (employee/routes/today), employeeOnboarding.ts, adminRoutes.ts

---

## Employee Authentication

| Check | Status | Evidence |
|-------|--------|---------|
| Employee login via Supabase email/password | ✅ | employeeAuth.ts |
| JWT validated on every request | ✅ | getAuthenticatedEmployee() — all routes |
| Employee record linked via user_id | ✅ | employees.user_id FK |
| Status must be 'active' | ✅ | .eq("status", "active") in employee lookup |
| Employee role check in postLoginRoleCheck | ✅ | Redirects to /employee on role='employee' |
| Onboarding blocking gate | ✅ | blocks_assignments flag on forms |

---

## Onboarding Flow

| Step | Status | Evidence |
|------|--------|---------|
| Admin invites employee → creates Supabase account | ✅ | POST /api/admin/employees/invite |
| Employee receives invite email | ✅ | Supabase auth invite |
| Employee sets password + logs in | ✅ | /employee/login |
| Onboarding forms assigned on first login | ✅ | adminOnboarding routes |
| Employee views and signs forms | ✅ | /employee/onboarding page |
| GPS consent captured separately | ✅ | gps_consent_at column |
| Assignment access blocked until required forms complete | ✅ | blocks_assignments check in /assignments/:id |
| Onboarding progress visible to admin | ✅ | GET /api/admin/onboarding/progress |
| Completion logged with timestamp | ✅ | signed_at in employee_onboarding_assignments |

---

## Day-of-Service Flow

| Step | Status | Evidence |
|------|--------|---------|
| Employee views today's route | ✅ | GET /api/employee/routes/today |
| Route shows published routes only | ✅ | status IN (published, assigned, in_progress) |
| Route enriched with customer name, phone, address | ✅ | Profile + property joins in today route endpoint |
| Assignment list loaded | ✅ | GET /api/employee/assignments |
| Assignment enriched with customer + property data | ✅ | Batch enrichment in assignments endpoint |
| Assignment detail view | ✅ | GET /api/employee/assignments/:id |
| Pre-service checklist | ✅ | GET/POST /api/employee/assignments/:id/checklist |
| Mark en_route | ✅ | POST /status {status: "en_route"} |
| GPS snapshot on en_route (if consent) | ✅ | employee_location_pings insert |
| Mark arrived | ✅ | POST /api/employee/assignments/:id/arrive |
| Mark in_progress | ✅ | POST /status {status: "in_progress"} |
| Mark completed | ✅ | POST /status {status: "completed"} |
| Appointment auto-completed on assignment complete | ✅ | Cascade in employeeAssignments.ts |
| Service completion email sent to customer | ✅ | buildServiceCompletionEmail() fire-and-forget |
| Admin alerted on completion | ✅ | notifyAdmin() field_ops.service_completed |
| Mark no_show | ✅ | POST /status {status: "no_show"} |
| Admin alerted on no_show | ✅ | notifyAdmin() field_ops.employee_no_show |
| Mark skipped | ✅ | POST /status {status: "skipped"} |
| Admin alerted on skipped | ✅ | notifyAdmin() field_ops.assignment_skipped |
| Upload job media (photos) | ✅ | POST /api/employee/assignments/:id/media |
| Admin alerted on media upload | ✅ | notifyAdmin() field_ops.media_uploaded |

---

## Route Stop Synchronization

| Check | Status | Evidence |
|-------|--------|---------|
| Route stop status synced from assignment status | ✅ | stopStatusMap in employeeAssignments.ts |
| Route status → in_progress when first stop started | ✅ | Cascade update on en_route/in_progress |
| Route auto-completed when all stops terminal | ✅ | allDone check → routes.status = 'completed' |
| Route audit log entry on auto-complete | ✅ | route_audit_log insert with auto:true |

---

## GPS Tracking

| Check | Status | Evidence |
|-------|--------|---------|
| GPS consent gate enforced | ✅ | gps_consent_at checked before any insert |
| Location ping stored on each status update | ✅ | employee_location_pings table |
| Arrival geo column updated | ✅ | geo_arrive on in_progress/arrived |
| Completion geo column updated | ✅ | geo_complete on completed |
| Test employees use 'simulated' source tag | ✅ | is_test flag → source: "simulated" |
| Admin can view GPS history | ✅ | Admin EmployeeTracking page |

---

## Messaging

| Check | Status | Evidence |
|-------|--------|---------|
| Employee can send/receive messages | ✅ | employeeMessages.ts routes |
| Admin can message employees | ✅ | Admin Messages page |
| Messages linked to employee + admin user_id | ✅ | message_threads table |

---

## Shift Management

| Check | Status | Evidence |
|-------|--------|---------|
| Employee can log shift start/end | ✅ | employeeShifts.ts |
| Shift persists to Supabase | ✅ | employee_shifts table |
| Admin can view timesheets | ✅ | Admin Timesheets page |

---

## En-Route Customer Notification

| Check | Status | Evidence |
|-------|--------|---------|
| Customer with phone → SMS via Twilio | ✅ | sendEnRouteSMS() in adminAppointments.ts dispatch |
| Customer without phone → email fallback | ✅ | buildEnRouteFallbackEmail() in employeeAssignments.ts |
| SMS suppressed for test employees | ✅ | is_test check before SMS/email send |
| Notification logged | ✅ | logNotification() technician_en_route type |

---

## Test Employee Safety

| Check | Status | Evidence |
|-------|--------|---------|
| Test employees flagged via is_test column | ✅ | employees.is_test boolean |
| Test employees skip blocking onboarding check | ✅ | if (!actor.isTest) gate in /assignments/:id |
| Test employees do not send customer emails | ✅ | if (!actor.isTest) gate on completion/en_route |
| Test GPS data tagged is_test=true | ✅ | employee_location_pings.is_test |
| Test employees use simulated GPS source | ✅ | source: "simulated" if is_test |

---

## Gaps

| Gap | Severity | Notes |
|-----|----------|-------|
| No offline mode / cache for field use | MEDIUM | Mobile browser must have connectivity; no PWA caching |
| No native mobile app — browser-only | MEDIUM | iOS/Android Safari PWA; field use depends on data signal |
| Route published to employee at time of publish — no push notification | MEDIUM | Employee must manually check app; SMS/push notification for "your route is ready" not implemented |
| No photo upload to cloud storage — url field only | MEDIUM | job_media stores a URL but no built-in Supabase Storage upload integration; employee must supply external URL |
| GPS accuracy dependent on browser permissions | LOW | Consent gate exists; no fallback if browser blocks GPS |
