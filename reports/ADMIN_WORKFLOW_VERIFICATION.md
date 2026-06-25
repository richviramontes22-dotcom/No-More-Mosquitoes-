# Admin Workflow Verification
**Date:** 2026-06-08
**Basis:** Source code inspection — adminAppointments.ts, adminRoutes.ts, adminCustomers.ts, adminEmployees.ts, adminAlerts.ts, adminMetrics.ts, adminSettings.ts, adminStripe.ts, and corresponding client pages

---

## Admin Authentication

| Check | Status | Evidence |
|-------|--------|---------|
| requireAdmin middleware enforces Bearer JWT | ✅ | middleware/requireAdmin.ts |
| Checks profiles.role = 'admin' | ✅ | requireAdmin middleware |
| Sets req.adminUserId on success | ✅ | Used in all admin routes |
| adminApi() client helper injects Bearer token | ✅ | client/data/admin.ts adminApi() |
| Admin pages wrapped in AdminLayout | ✅ | client/pages/admin/AdminLayout.tsx |
| Non-admin redirected to /login | ✅ | AdminLayout role check |

---

## Appointment Management

| Action | Status | Evidence |
|--------|--------|---------|
| List all appointments with filters | ✅ | GET /api/admin/appointments |
| View appointment detail | ✅ | Linked from admin Appointments page |
| Dispatch appointment (en_route) | ✅ | POST /api/admin/appointments/:id/dispatch |
| SMS notification on dispatch | ✅ | sendEnRouteSMS() fire-and-forget |
| Cancel appointment | ✅ | PATCH /api/admin/appointments/:id/cancel |
| Cancellation email sent | ✅ | buildCancellationEmail() fire-and-forget |
| Assignment cascade on cancel | ✅ | Linked assignments → skipped |
| Employee notified on assignment cancel | ✅ | notifyEmployeeAssignmentCancelled() |
| Admin alert fired on cancel | ✅ | notifyAdmin() scheduling.appointment_cancelled |
| Create manual assignment | ✅ | POST /api/admin/assignments |
| Employee assignment email | ✅ | notifyEmployeeAssigned() |

---

## Route Planning

| Action | Status | Evidence |
|--------|--------|---------|
| Generate single-tech route | ✅ | POST /api/admin/routes/generate |
| Generate full day plan (multi-tech) | ✅ | POST /api/admin/routes/day/generate |
| Technician availability respected | ✅ | isTechnicianAvailable() before generation |
| Capacity limit enforced per technician | ✅ | getEffectiveDailyCapacity() |
| Company blackout blocks generation | ✅ | blackout_dates scope='all' check |
| Coordinate-based routing (nearest-neighbor) | ✅ | optimizeRoute() in routeOptimization.ts |
| Mock coordinate fallback with warning | ✅ | resolveCoordinates() with conflict_notes |
| Route confidence scoring | ✅ | high/medium/low based on mock count |
| View day plan summary | ✅ | GET /api/admin/routes/day |
| Approve day plan | ✅ | POST /api/admin/routes/day/approve |
| Publish routes to employees | ✅ | POST /api/admin/routes/day/publish |
| Workforce validation gate on publish | ✅ | validateDayPlanForWorkforce() (feature-flagged) |
| Force-override available with logging | ✅ | force:true parameter + audit log |
| Discard draft routes | ✅ | POST /api/admin/routes/day/rebuild |
| Unassigned appointments report | ✅ | GET /api/admin/routes/day/unassigned |
| Route audit log | ✅ | route_audit_log table + logRouteAudit() |
| Admin alert on publish | ✅ | notifyAdmin() scheduling.route_published |
| Admin alert if no technicians available | ✅ | notifyAdmin() workforce.no_technicians_available |

---

## Customer Management

| Action | Status | Evidence |
|--------|--------|---------|
| List all customers | ✅ | GET /api/admin/customers |
| View customer profile + subscriptions | ✅ | Admin Customers page |
| Invite customer (magic link) | ✅ | POST /api/admin/customers/invite |
| View customer appointments | ✅ | Linked from customer detail |
| View customer payment history | ✅ | Admin Billing page |

---

## Employee Management

| Action | Status | Evidence |
|--------|--------|---------|
| List employees | ✅ | GET /api/admin/employees |
| Invite employee | ✅ | POST /api/admin/employees/invite |
| Edit employee profile | ✅ | PATCH /api/admin/employees/:id |
| Deactivate employee | ✅ | PATCH /api/admin/employees/:id/deactivate |
| View employee GPS tracking | ✅ | Admin EmployeeTracking page |
| View employee onboarding status | ✅ | GET /api/admin/onboarding/progress |
| Export onboarding CSV | ✅ | GET /api/admin/onboarding/export |
| Set workforce schedules | ✅ | POST /api/admin/workforce/schedules |
| Set capacity profiles | ✅ | POST /api/admin/workforce/capacity |
| Set time off | ✅ | POST /api/admin/workforce/time-off |

---

## Billing / Revenue

| Action | Status | Evidence |
|--------|--------|---------|
| View revenue overview | ✅ | Admin Revenue page + /api/admin/stripe/revenue |
| List all subscriptions | ✅ | Admin Billing page |
| View payment history | ✅ | Admin Billing page |
| Cancel subscription in Stripe | ✅ | POST /api/admin/stripe/cancel-subscription |
| Refund payment | ✅ | POST /api/admin/stripe/refund |
| View marketplace orders | ✅ | Admin Orders page + /api/admin/marketplace/orders |

---

## Operational Alerts

| Alert Type | Severity | Status |
|------------|----------|--------|
| billing.payment_failed | critical | ✅ Webhook → notifyAdmin |
| billing.new_subscription | info | ✅ Webhook → notifyAdmin |
| subscriptions.cancelled | warning | ✅ Webhook → notifyAdmin |
| leads.new_schedule_request | info | ✅ POST /api/schedule → notifyAdmin |
| field_ops.service_completed | info | ✅ Employee status update → notifyAdmin |
| field_ops.employee_no_show | warning | ✅ Employee marks no_show → notifyAdmin |
| field_ops.assignment_skipped | info | ✅ Employee marks skipped → notifyAdmin |
| field_ops.media_uploaded | info | ✅ Employee uploads job photo → notifyAdmin |
| scheduling.appointment_cancelled | warning | ✅ Admin cancels → notifyAdmin |
| scheduling.route_published | info | ✅ Route publish → notifyAdmin |
| workforce.no_technicians_available | critical | ✅ Day generate with no techs → notifyAdmin |
| Alert badge counts | ✅ | GET /api/admin/alerts/counts |
| Acknowledge alert | ✅ | POST /api/admin/alerts/:id/acknowledge |
| Resolve alert | ✅ | POST /api/admin/alerts/:id/resolve |

---

## Settings Management

| Feature | Status | Evidence |
|---------|--------|---------|
| Business hours CRUD | ✅ | adminBusinessHours.ts |
| Blackout dates CRUD | ✅ | adminBlackoutDates.ts |
| Service areas management | ✅ | adminServiceAreas.ts |
| Promo codes management | ✅ | adminPromos.ts |
| Service plans management | ✅ | adminPlans.ts |
| CMS content slots | ✅ | adminCms.ts |
| Site content (FAQs, blog) | ✅ | adminContent.ts |
| Legal compliance documents | ✅ | LegalCompliance page |

---

## Admin Metrics / Overview

| Feature | Status | Evidence |
|---------|--------|---------|
| Appointment counts by status | ✅ | GET /api/admin/metrics/appointments |
| Active subscriptions count | ✅ | GET /api/admin/metrics/subscriptions |
| Revenue metrics | ✅ | GET /api/admin/metrics/revenue |
| Debug system state panel | ✅ | GET /api/admin/debug/status (feature-flagged) |

---

## Gaps

| Gap | Severity | Notes |
|-----|----------|-------|
| Admin debug panel disabled by default | LOW | Requires ENABLE_ADMIN_DEBUG_PANEL=true; intentionally off in prod |
| No bulk appointment cancellation | LOW | Individual only; acceptable for beta scale |
| No admin-initiated subscription refund automation | MEDIUM | Manual Stripe Dashboard refund + admin route for API refund |
| Workforce schedule setup not yet done for beta technicians | MEDIUM | Must configure technician_schedule_templates + capacity_profiles before launch |
| admin_alerts table migration pending Supabase run | HIGH | Alerts written by server will fail with DB error until migration is applied |
