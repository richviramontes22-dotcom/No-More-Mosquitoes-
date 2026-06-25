# ADMIN FEATURE INVENTORY
## Generated: 2026-05-29
## Scope: Full audit of all admin pages, routes, components, and UI elements

---

## 1. Admin Page Inventory

All admin pages live at `/admin/*` and are wrapped in `RequireAdmin > AdminLayout` (file: `client/pages/admin/AdminLayout.tsx`). Navigation is defined in `client/data/navigation.ts` as `ADMIN_NAV_LINKS`.

### 1.1 Overview / Dashboard
| Property | Value |
|----------|-------|
| **Feature Name** | Admin Overview |
| **Route** | `/admin` (index) |
| **Purpose** | KPI monitoring, operational alerts, upcoming appointments, recent tickets, newest customers |
| **Client File** | `client/pages/admin/Overview.tsx` |
| **Server Route(s)** | Direct Supabase calls + `GET /api/admin/subscriptions/needs-scheduling` + `GET /api/admin/subscriptions/past-due` + `POST /api/admin/appointments` (from "Schedule" alert action) |
| **DB Tables Used** | `profiles`, `appointments`, `tickets`, `payments`, `messages` (direct), `subscriptions` (via admin API) |
| **Status** | Partially Functional |
| **Notes** | KPI widgets load from real Supabase data. The "Past-due subscriptions" KPI shows `—` in static JSX but loads actual count from `/api/admin/subscriptions/past-due`. Revenue trend shows real 30-day comparison. The "Schedule" button in the needs-scheduling alert panel calls `POST /api/admin/appointments` but does NOT assign a technician — technician must be assigned separately. `messages` table count query assumes `is_read` boolean column which may not exist in all deployments. |

**KPI Widgets:**
- Active Customers (count from `profiles` where role=customer)
- Appointments Today (count from `appointments` today)
- Open Tickets (count from `tickets` where status != resolved)
- MTD Revenue (sum from `payments` this month)
- Past-Due Subscriptions (count from subscriptions API)
- Unread Messages (count from `messages` where is_read=false)

**Panels:**
- Upcoming Appointments table (next 5, status=scheduled)
- Recent Support Tickets table (last 5)
- Newest Customers table (last 5 by created_at)
- Needs-Scheduling Alert panel (subscriptions with no upcoming appointment)
- Past-Due Alert panel (subscriptions in past_due status)

---

### 1.2 Customers
| Property | Value |
|----------|-------|
| **Feature Name** | Customer Database |
| **Route** | `/admin/customers` |
| **Purpose** | View all customer profiles, search/filter, invite new customers, view customer detail |
| **Client File** | `client/pages/admin/Customers.tsx` |
| **Server Route(s)** | `POST /api/admin/customers/invite` (server-side); direct Supabase for list/detail |
| **DB Tables Used** | `profiles`, `properties`, `subscriptions` |
| **Status** | Partially Functional |
| **Notes** | Customer list loads from Supabase via direct anon client. Search works by name/email/phone. Status filter works. "View Details" sheet loads profile + properties + subscription status. Activity tab and Finance tab are placeholders (show `AdminEmptyState` with link buttons to other pages — no customer-specific data). "Add Customer" button calls `/api/admin/customers/invite` — sends Supabase auth invite email. No phone number is passed to the status select value (status field in dialog is cosmetic only — invite API doesn't accept status). |

**CustomerDetailsSheet Tabs:**
- Profile: shows phone, join date, user ID, system role — Status: Working
- Properties: shows property table — Status: Working
- Activity: placeholder with links to /admin/appointments, /admin/messages, /admin/tickets — Status: Placeholder
- Finance: placeholder with links to /admin/billing, /admin/revenue — Status: Placeholder

---

### 1.3 Properties
| Property | Value |
|----------|-------|
| **Feature Name** | Property Management |
| **Route** | `/admin/properties` |
| **Purpose** | View all customer properties, search by address, add new properties manually |
| **Client File** | `client/pages/admin/Properties.tsx` |
| **Server Route(s)** | Direct Supabase only |
| **DB Tables Used** | `profiles`, `properties` |
| **Status** | Partially Functional |
| **Notes** | Loads all properties with customer name join. Search by address/customer. "Add Property" dialog writes directly to `properties` table. No delete functionality. Acreage, city, state, zip shown. No link from a property row to the customer record. |

---

### 1.4 Appointments
| Property | Value |
|----------|-------|
| **Feature Name** | Appointment Control |
| **Route** | `/admin/appointments` |
| **Purpose** | View all appointments, assign technicians, reschedule, dispatch, cancel, manage blackout dates |
| **Client File** | `client/pages/admin/Appointments.tsx` |
| **Server Route(s)** | `POST /api/admin/assignments`, `POST /api/admin/appointments/:id/dispatch`, `PATCH /api/admin/appointments/:id/cancel`, `GET /api/admin/blackout-dates`, `POST /api/admin/blackout-dates`, `DELETE /api/admin/blackout-dates/:id`, `GET /api/admin/subscriptions/needs-scheduling` |
| **DB Tables Used** | `appointments`, `profiles`, `properties`, `employees`, `assignments`, `blackout_dates` |
| **Status** | Fully Functional |
| **Notes** | Multi-filter (search, plan type, technician, city/zip, date range). Bulk selection + bulk assignment to technician. Dispatch sends en-route SMS. Cancel sends cancellation email. Modify dialog shows linked marketplace orders. Blackout dates panel is fully functional. Scheduling queue panel shows subscribers needing appointments. |

**Sub-panels:**
- Scheduling Queue Panel — shows active subscribers with no upcoming appointment
- Blackout Dates Panel — add/delete blocked dates with reason

**Dialogs:**
- Reschedule/Modify Dialog (date, time, technician, linked marketplace orders) — Working
- Cancel Confirmation Dialog — Working

---

### 1.5 Visits
| Property | Value |
|----------|-------|
| **Feature Name** | Visit History |
| **Route** | `/admin/visits` |
| **Purpose** | View all completed appointments (historical visits), filter by date and technician |
| **Client File** | `client/pages/admin/Visits.tsx` |
| **Server Route(s)** | Direct Supabase only |
| **DB Tables Used** | `appointments` (status=completed), `profiles`, `properties`, `assignments` |
| **Status** | Partially Functional |
| **Notes** | Shows last 100 completed appointments. Joins technician name via `assignments` → `employees` → `profiles`. No per-visit job media shown (video_url column referenced in type but not fetched from `job_media` table). No chemical log data displayed. No checklist data. Effectively a read-only completed-appointment list. |

---

### 1.6 Messages
| Property | Value |
|----------|-------|
| **Feature Name** | Messages |
| **Route** | `/admin/messages` |
| **Purpose** | View message threads between customers and admin, reply to messages |
| **Client File** | `client/pages/admin/Messages.tsx` |
| **Server Route(s)** | Direct Supabase only |
| **DB Tables Used** | `message_threads`, `assignments`, `profiles` |
| **Status** | Unknown — Likely Broken |
| **Notes** | Queries `message_threads` table joined to `assignments` and `profiles`. The `message_threads` table was added in the employee portal migration and may not have data seeded in production. No server-side send endpoint referenced — the UI has a Send button but it is not wired to any API call visible in the file. The "Send" icon button is present but requires tracing the rest of the file. |

---

### 1.7 Tickets
| Property | Value |
|----------|-------|
| **Feature Name** | Support Tickets |
| **Route** | `/admin/tickets` |
| **Purpose** | View all support tickets in Kanban columns (open, in_progress, resolved), update status |
| **Client File** | `client/pages/admin/Tickets.tsx` |
| **Server Route(s)** | Direct Supabase only |
| **DB Tables Used** | `tickets`, `profiles` |
| **Status** | Partially Functional |
| **Notes** | Kanban view with columns for open/in_progress/resolved. Loads all tickets with customer profile join. Status updates write directly to Supabase. No reply-to-customer functionality. No ticket assignment to staff (assigned_to column exists in schema but is not shown in the Kanban cards). No create-ticket-from-admin capability. |

---

### 1.8 Employees
| Property | Value |
|----------|-------|
| **Feature Name** | Employee Management |
| **Route** | `/admin/employees` |
| **Purpose** | View employee roster, invite employees, edit employee details, activate/deactivate employees |
| **Client File** | `client/pages/admin/Employees.tsx` |
| **Server Route(s)** | `GET /api/admin/employees`, `POST /api/admin/employees/invite`, `PATCH /api/admin/employees/:id` |
| **DB Tables Used** | `employees`, `profiles` |
| **Status** | Fully Functional |
| **Notes** | Full CRUD except delete (deactivate via status=inactive is the soft-delete). Invite sends Supabase auth email. Edit dialog updates role, phone, vehicle, nav preference, status. Requires SUPABASE_SERVICE_ROLE_KEY for invite functionality. |

---

### 1.9 Route Planning
| Property | Value |
|----------|-------|
| **Feature Name** | Route Planning |
| **Route** | `/admin/route-planning` |
| **Purpose** | Build and view daily route plans for employees |
| **Client File** | `client/pages/admin/RoutePlanning.tsx` |
| **Server Route(s)** | `GET /api/admin/employees`, `GET /api/admin/routes` (via adminApi), `POST /api/admin/routes` |
| **DB Tables Used** | `employees`, `routes`, `route_stops`, `assignments` |
| **Status** | Partially Functional |
| **Notes** | UI allows selecting an employee + date and generating a route. Route generation calls adminApi to create route with stops. Routes/route_stops tables exist in DB. No map visualization of the route in this page (map is in EmployeeTracking). No drag-to-reorder stops. |

---

### 1.10 Employee Tracking
| Property | Value |
|----------|-------|
| **Feature Name** | Employee Location Monitoring |
| **Route** | `/admin/employee-tracking` |
| **Purpose** | View employee assignment status and location |
| **Client File** | `client/pages/admin/EmployeeTracking.tsx` |
| **Server Route(s)** | `GET /api/admin/tracking/employees` |
| **DB Tables Used** | `employees`, `profiles`, `assignments`, `appointments`, `properties` |
| **Status** | Partially Functional |
| **Notes** | CRITICAL: `location` field in the API response is always `null`. GPS tracking is not implemented. The comment in `server/routes/adminTracking.ts` explicitly states "GPS location is not implemented — no live device tracking exists yet." The map component (`EmployeeMap`) has no real data to render. Employee status (idle, en_route, in_progress) is real. Auto-refreshes every 5 seconds. |

---

### 1.11 Billing
| Property | Value |
|----------|-------|
| **Feature Name** | Billing & Payments |
| **Route** | `/admin/billing` |
| **Purpose** | View all payment transactions, marketplace orders, unified billing timeline, Stripe status |
| **Client File** | `client/pages/admin/Billing.tsx` |
| **Server Route(s)** | `GET /api/admin/stripe/status`, `GET /api/admin/marketplace/orders/:id`, `PATCH /api/admin/marketplace/orders/:id/fulfillment` |
| **DB Tables Used** | `payments`, `profiles`, `marketplace_orders`, `marketplace_order_items`, `properties` |
| **Status** | Partially Functional |
| **Notes** | Three sections: payment summary cards (succeeded/pending/failed totals), unified timeline (subscription payments + marketplace orders), and Stripe status indicator. No subscription detail or cancel/refund capability from here. Marketplace order detail dialog shows items + allows fulfillment status change. Refunds must be done in Stripe dashboard. |

---

### 1.12 Revenue
| Property | Value |
|----------|-------|
| **Feature Name** | Revenue & Analytics |
| **Route** | `/admin/revenue` |
| **Purpose** | Live revenue monitoring from Stripe, 30-day chart, Stripe invoice list |
| **Client File** | `client/pages/admin/Revenue.tsx` |
| **Server Route(s)** | `GET /api/admin/stripe/status`, `GET /api/admin/stripe/revenue?days=30`, `GET /api/admin/stripe/invoices?limit=20` |
| **DB Tables Used** | None (all Stripe API calls) |
| **Status** | Partially Functional |
| **Notes** | Revenue chart is real Stripe data (last 30 days by payment intent). Invoice list is Stripe live data. Trend percentages on summary cards ("+8.4%", "+12.1%") are HARDCODED — not calculated from real data. No MRR/ARR calculation. No churn rate. No plan-type revenue breakdown. |

---

### 1.13 Content / Website Manager
| Property | Value |
|----------|-------|
| **Feature Name** | Content Management |
| **Route** | `/admin/content` |
| **Purpose** | Manage site content (blog posts, CMS blocks) |
| **Client File** | `client/pages/admin/Content.tsx` |
| **Server Route(s)** | `GET/POST/PATCH/DELETE /api/admin/cms/*` |
| **DB Tables Used** | Unknown (depends on CMS backend) |
| **Status** | Unknown |
| **Notes** | File not read in full — CMS routes exist in `server/routes/adminCms.ts` and `server/routes/adminContent.ts`. |

---

### 1.14 Pricing & Plans
| Property | Value |
|----------|-------|
| **Feature Name** | Pricing & Plans |
| **Route** | `/admin/pricing` |
| **Purpose** | View and edit service plan prices, manage Stripe price IDs |
| **Client File** | `client/pages/admin/Pricing.tsx` |
| **Server Route(s)** | `GET /api/admin/plans`, `PATCH /api/admin/plans/:id` |
| **DB Tables Used** | `service_plans` (or `plans`) |
| **Status** | Partially Functional |
| **Notes** | Can view all plans and edit price_cents. Cannot create or delete plans from the UI. No ability to sync price changes to Stripe. Stripe price IDs are static database values. |

---

### 1.15 Service Areas
| Property | Value |
|----------|-------|
| **Feature Name** | Service Areas |
| **Route** | `/admin/service-areas` |
| **Purpose** | Manage service ZIP codes and capacity |
| **Client File** | `client/pages/admin/ServiceAreas.tsx` |
| **Server Route(s)** | `GET /api/admin/service-areas`, `POST /api/admin/service-areas`, `PATCH /api/admin/service-areas/:id` |
| **DB Tables Used** | `service_areas` |
| **Status** | Fully Functional |
| **Notes** | Add/remove/toggle ZIP codes. Capacity field exists in schema. Active/inactive toggle works. No polygon-based geographic visualization. |

---

### 1.16 Promos
| Property | Value |
|----------|-------|
| **Feature Name** | Promo Codes & Campaigns |
| **Route** | `/admin/promos` |
| **Purpose** | Create/manage promo codes and marketing campaigns |
| **Client File** | `client/pages/admin/Promos.tsx` |
| **Server Route(s)** | `GET /api/admin/promos/codes`, `POST /api/admin/promos/codes`, `DELETE /api/admin/promos/codes/:id`, `GET /api/admin/promos/campaigns`, `POST /api/admin/promos/campaigns` |
| **DB Tables Used** | `promo_codes`, `campaigns` |
| **Status** | Partially Functional |
| **Notes** | Tabbed interface for codes and campaigns. Can create percent/fixed discount codes with expiry, max uses. Stripe promotion code ID field stored. Campaigns link to promo codes. No code validation at checkout (promo application during checkout not confirmed). |

---

### 1.17 Reports
| Property | Value |
|----------|-------|
| **Feature Name** | Reports & Exports |
| **Route** | `/admin/reports` |
| **Purpose** | CSV export of live data |
| **Client File** | `client/pages/admin/Reports.tsx` |
| **Server Route(s)** | Direct Supabase only |
| **DB Tables Used** | `profiles`, `properties`, `appointments`, `tickets`, `subscriptions` |
| **Status** | Fully Functional |
| **Notes** | 5 export buttons: customers, properties, appointments, tickets, subscriptions. All use direct Supabase queries (bypasses server). No date range filtering. No custom column selection. No scheduled exports. |

---

### 1.18 Business Hours
| Property | Value |
|----------|-------|
| **Feature Name** | Business Hours |
| **Route** | `/admin/business-hours` |
| **Purpose** | Configure operational days and service time windows |
| **Client File** | `client/pages/admin/BusinessHours.tsx` |
| **Server Route(s)** | `GET /api/admin/business-hours`, `PATCH /api/admin/business-hours/:id` |
| **DB Tables Used** | `business_hours` |
| **Status** | Fully Functional |
| **Notes** | Shows all 7 days. Toggle operational on/off per day. Windows (morning/afternoon) with time ranges and max_jobs_per_tech are stored in JSONB. Changes persist to DB and affect scheduling availability. |

---

### 1.19 Notifications
| Property | Value |
|----------|-------|
| **Feature Name** | Notification Log |
| **Route** | `/admin/notifications` |
| **Purpose** | View history of all outbound notifications (email/SMS) |
| **Client File** | `client/pages/admin/Notifications.tsx` |
| **Server Route(s)** | `GET /api/admin/notifications` (registered in adminStripe.ts) |
| **DB Tables Used** | `notification_log` |
| **Status** | Fully Functional |
| **Notes** | Read-only log. Filter by status (sent/failed/pending/skipped) and notification type. Shows recipient, channel, type, subject, status, provider, error message, timestamp. Last 200 entries. No ability to resend a failed notification from UI. |

---

### 1.20 Settings
| Property | Value |
|----------|-------|
| **Feature Name** | Settings |
| **Route** | `/admin/settings` |
| **Purpose** | Configure team members, feature flags, integrations |
| **Client File** | `client/pages/admin/Settings.tsx` |
| **Server Route(s)** | `GET/POST /api/admin/settings` (via `useAdminSettings` hook) |
| **DB Tables Used** | Unknown (uses `useAdminSettings` hook — likely a `settings` or `admin_config` table) |
| **Status** | Partially Functional |
| **Notes** | Team member management (add/remove admin/support roles). Feature flags (autoAssignTickets, requireCompletionVideo, enableReserviceRequests, smsReminders). Integration config panel shows Supabase/Stripe/SendGrid/Twilio/Google Maps keys — CAUTION: secret key fields appear editable in UI which is a security risk if keys are stored in DB. |

---

## 2. Admin Components Inventory

### Components in `client/components/admin/`

| Component | Purpose | File |
|-----------|---------|------|
| `AdminActionMenu` | Dropdown context menu for table rows | `AdminActionMenu.tsx` (new) |
| `AdminDataTable` | Generic data table component | `AdminDataTable.tsx` (new) |
| `QuickFilter` | Filter chip component | `QuickFilter.tsx` (new) |
| `StatusBadge` | Colored status badge for appointment statuses | `StatusBadge.tsx` (new) |
| `AdminOwnershipBadge` | Badge for "operational", "future", "visibility" notes | Referenced in multiple pages |
| `AdminState` | `AdminLoadingState`, `AdminEmptyState`, `AdminErrorState` | Referenced in multiple pages |
| `EmployeeMap` | Map component for employee location tracking | Used in EmployeeTracking.tsx |

---

## 3. Navigation Gaps

The following nav items exist in `ADMIN_NAV_LINKS` but are NOT in the numbered list above:
- `WebsiteManager` (`/admin/website-manager`) — exists as a file, purpose: marketing site management
- `Promos` is shown but promo code validation at checkout is not confirmed

The following features are NOT in the nav but exist as routes:
- None found — all registered routes have nav links

---

## Summary Status Table

| Page | Status |
|------|--------|
| Overview | Partially Functional |
| Customers | Partially Functional |
| Properties | Partially Functional |
| Appointments | Fully Functional |
| Visits | Partially Functional |
| Messages | Unknown (likely broken) |
| Tickets | Partially Functional |
| Employees | Fully Functional |
| Route Planning | Partially Functional |
| Employee Tracking | Partially Functional (GPS = null always) |
| Billing | Partially Functional |
| Revenue | Partially Functional (hardcoded trends) |
| Content | Unknown |
| Pricing | Partially Functional |
| Service Areas | Fully Functional |
| Promos | Partially Functional |
| Reports | Fully Functional |
| Business Hours | Fully Functional |
| Notifications | Fully Functional |
| Settings | Partially Functional |
