# 08 — Customer Service App Audit Report

**Date:** 2026-07-03

---

## Route Guard

**File:** `client/components/auth/RequireCustomerService.tsx`

Allowed roles: `["admin", "customer_service"]`

Redirect for unauthorized: → `/admin/login`

**Verified:** A technician or plain employee cannot reach customer-service routes.

---

## Customer Service Portal Routes

All accessed via `/employee/login` with `customer_service` role:

| Route | Component | Status |
|---|---|---|
| `/employee` (dashboard) | EmployeeDashboard → CustomerServicePanel | ✅ Role-aware dashboard |
| `/employee/tickets` | AdminTickets (reused) | ✅ Full ticket queue |
| `/employee/satisfaction` | AdminSatisfaction (reused) | ✅ NPS + satisfaction responses |
| `/employee/reschedule-requests` | AdminRescheduleRequests (reused) | ✅ Reschedule management |

---

## CustomerServicePanel

**File:** `client/pages/employee/CustomerServicePanel.tsx` (214 lines)

**Data endpoints:**
- `GET /api/admin/customer-service/dashboard` → open_tickets, escalated_tickets, pending_detractors, pending_reschedule_requests, recent_activity
- `GET /api/admin/customer-service/customers?search=...` → customer search

**Metrics displayed:**
- Open ticket count
- Escalated ticket count
- Pending detractors (NPS responses needing follow-up)
- Pending reschedule requests
- Recent activity feed

---

## Employee Layout Navigation (Customer Service Role)

**File:** `client/pages/employee/EmployeeLayout.tsx`

```typescript
const CUSTOMER_SERVICE_NAV = [
  { label: "Dashboard", to: "/employee" },
  { label: "Tickets", to: "/employee/tickets" },
  { label: "Satisfaction", to: "/employee/satisfaction" },
  { label: "Reschedule Requests", to: "/employee/reschedule-requests" },
];
```

Navigation is role-aware — customer_service users see CS nav, technicians see technician nav.

---

## Customer Data Boundaries

| Check | Status |
|---|---|
| Customer service can view tickets | ✅ |
| Customer service can view NPS/satisfaction | ✅ |
| Customer service can view reschedule requests | ✅ |
| Customer service CANNOT access billing/payments | ✅ No route/endpoint for CS billing access |
| Customer service CANNOT access employee tracking | ✅ No route for CS tracking access |
| Customer service CANNOT access admin-only routes | ✅ RequireAdmin blocks /admin/* |
| Unauthorized redirect | ✅ → /admin/login (correct for CS role attempting admin routes) |

---

## Issues Found

### Issue 1: Unauthorized redirect for CS role goes to /admin/login (MINOR)
**Finding:** `RequireCustomerService.tsx` redirects to `/admin/login` if the role is wrong. However, customer_service users login via `/employee/login`. If a customer_service user's session expires, they would be redirected to `/admin/login` which is the wrong login form.
**Risk:** Low — the admin login and employee login both accept the same Supabase JWT. Either form works for any role. But it's slightly confusing UX.
**Recommendation:** Change redirect to `/employee/login` in RequireCustomerService for better UX. Low priority.

### Issue 2: CS preview in QA Center points to /employee routes
**Status:** Correct and intentional — CS portal lives under /employee, not /admin. QA Center reflects this accurately.

---

## Summary

Customer service portal is well-implemented with correct role isolation. One minor UX issue with redirect destination. All three CS-specific routes (tickets, satisfaction, reschedule requests) are functional. Data boundary is correct — CS cannot access billing or employee tracking.
