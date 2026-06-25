# SYSTEM DISCOVERY REPORT — No More Mosquitoes
## Generated: 2026-05-28
## Scope: Full codebase read-only inventory

---

## Section 1: Route Inventory

### 1.1 Public/Marketing Routes

All wrapped in `<MainLayout>` (nav + footer).

| Path | Component | Auth Guard | File Exists |
|------|-----------|------------|-------------|
| `/` | `Index` | None | Yes — `client/pages/Index.tsx` |
| `/pricing` | `Pricing` | None | Yes — `client/pages/Pricing.tsx` |
| `/services` | `Services` | None | Yes — `client/pages/Services.tsx` |
| `/our-story` | `OurStory` | None | Yes — `client/pages/OurStory.tsx` |
| `/reviews` | `Reviews` | None | Yes — `client/pages/Reviews.tsx` |
| `/service-area` | `ServiceArea` | None | Yes — `client/pages/ServiceArea.tsx` |
| `/faq` | `FAQ` | None | Yes — `client/pages/FAQ.tsx` |
| `/blog` | `Blog` | None | Yes — `client/pages/Blog.tsx` |
| `/blog/:slug` | `BlogPost` | None | Yes — `client/pages/BlogPost.tsx` |
| `/contact` | `Contact` | None | Yes — `client/pages/Contact.tsx` |
| `/safety` | `Safety` | None | Yes — `client/pages/Safety.tsx` |
| `/licenses` | `Licenses` | None | Yes — `client/pages/Licenses.tsx` |
| `/schedule` | `Schedule` | None | Yes — `client/pages/Schedule.tsx` |
| `/login` | `Login` | None | Yes — `client/pages/Login.tsx` |
| `/forgot-password` | `ForgotPassword` | None | Yes — `client/pages/ForgotPassword.tsx` |
| `/reset-password` | `ResetPassword` | None | Yes — `client/pages/ResetPassword.tsx` |
| `/admin/login` | `AdminLogin` | None | Yes — `client/pages/admin/AdminLogin.tsx` |
| `/privacy` | `Privacy` | None | Yes — `client/pages/Privacy.tsx` |
| `/terms` | `Terms` | None | Yes — `client/pages/Terms.tsx` |
| `/guarantee` | `Guarantee` | None | Yes — `client/pages/Guarantee.tsx` |

### 1.2 Checkout Route

Rendered inside `<CheckoutLayout>` (no nav/footer).

| Path | Component | Auth Guard | File Exists |
|------|-----------|------------|-------------|
| `/onboarding` | `Onboarding` | `RequireAuth` | Yes — `client/pages/Onboarding.tsx` |

### 1.3 Customer Dashboard Routes (`/dashboard/*`)

All wrapped in `RequireCustomer > DashboardLayout`.

| Path | Component | Auth Guard | File Exists |
|------|-----------|------------|-------------|
| `/dashboard` (index) | `Dashboard` | `RequireCustomer` | Yes — `client/pages/Dashboard.tsx` |
| `/dashboard/appointments` | `DashboardAppointments` | `RequireCustomer` | Yes — `client/pages/dashboard/Appointments.tsx` |
| `/dashboard/billing` | `DashboardBilling` | `RequireCustomer` | Yes — `client/pages/dashboard/Billing.tsx` |
| `/dashboard/properties` | `DashboardProperties` | `RequireCustomer` | Yes — `client/pages/dashboard/Properties.tsx` |
| `/dashboard/marketplace` | `DashboardMarketplace` | `RequireCustomer` | Yes — `client/pages/dashboard/Marketplace.tsx` |
| `/dashboard/orders` | Navigate → `/dashboard/marketplace` | — | Redirect only |
| `/dashboard/messages` | Navigate → `/dashboard/help` | — | Redirect only |
| `/dashboard/support` | Navigate → `/dashboard/help` | — | Redirect only |
| `/dashboard/videos` | Navigate → `/dashboard/appointments` | — | Redirect only |
| `/dashboard/help` | `DashboardHelp` | `RequireCustomer` | Yes — `client/pages/dashboard/Help.tsx` |
| `/dashboard/profile` | `DashboardProfile` | `RequireCustomer` | Yes — `client/pages/dashboard/Profile.tsx` |

**Note:** `DashboardVideos` (`client/pages/dashboard/Videos.tsx`) exists as a file but is NOT registered as an active route — it redirects to `/dashboard/appointments`. The Videos page file is real and functional but currently unreachable except by direct component import.

**Note:** `DashboardOrders` (`client/pages/dashboard/Orders.tsx`) exists and is embedded inside `DashboardMarketplace` as a tab — it is NOT a standalone route.

### 1.4 Admin Routes (`/admin/*`)

All wrapped in `RequireAdmin > AdminLayout`.

| Path | Component | Auth Guard | File Exists |
|------|-----------|------------|-------------|
| `/admin` (index) | `AdminOverview` | `RequireAdmin` | Yes — `client/pages/admin/Overview.tsx` |
| `/admin/customers` | `AdminCustomers` | `RequireAdmin` | Yes — `client/pages/admin/Customers.tsx` |
| `/admin/properties` | `AdminProperties` | `RequireAdmin` | Yes — `client/pages/admin/Properties.tsx` |
| `/admin/appointments` | `AdminAppointments` | `RequireAdmin` | Yes — `client/pages/admin/Appointments.tsx` |
| `/admin/visits` | `AdminVisits` | `RequireAdmin` | Yes — `client/pages/admin/Visits.tsx` |
| `/admin/messages` | `AdminMessages` | `RequireAdmin` | Yes — `client/pages/admin/Messages.tsx` |
| `/admin/tickets` | `AdminTickets` | `RequireAdmin` | Yes — `client/pages/admin/Tickets.tsx` |
| `/admin/route-planning` | `AdminRoutePlanning` | `RequireAdmin` | Yes — `client/pages/admin/RoutePlanning.tsx` |
| `/admin/billing` | `AdminBilling` | `RequireAdmin` | Yes — `client/pages/admin/Billing.tsx` |
| `/admin/revenue` | `AdminRevenue` | `RequireAdmin` | Yes — `client/pages/admin/Revenue.tsx` |
| `/admin/employee-tracking` | `AdminEmployeeTracking` | `RequireAdmin` | Yes — `client/pages/admin/EmployeeTracking.tsx` |
| `/admin/website-manager` | `AdminWebsiteManager` | `RequireAdmin` | Yes — `client/pages/admin/WebsiteManager.tsx` |
| `/admin/content` | `AdminContent` | `RequireAdmin` | Yes — `client/pages/admin/Content.tsx` |
| `/admin/pricing` | `AdminPricing` | `RequireAdmin` | Yes — `client/pages/admin/Pricing.tsx` |
| `/admin/promos` | `AdminPromos` | `RequireAdmin` | Yes — `client/pages/admin/Promos.tsx` |
| `/admin/service-areas` | `AdminServiceAreas` | `RequireAdmin` | Yes — `client/pages/admin/ServiceAreas.tsx` |
| `/admin/employees` | `AdminEmployees` | `RequireAdmin` | Yes — `client/pages/admin/Employees.tsx` |
| `/admin/reports` | `AdminReports` | `RequireAdmin` | Yes — `client/pages/admin/Reports.tsx` |
| `/admin/business-hours` | `AdminBusinessHours` | `RequireAdmin` | Yes — `client/pages/admin/BusinessHours.tsx` |
| `/admin/notifications` | `AdminNotifications` | `RequireAdmin` | Yes — `client/pages/admin/Notifications.tsx` |
| `/admin/settings` | `AdminSettings` | `RequireAdmin` | Yes — `client/pages/admin/Settings.tsx` |

### 1.5 Employee Routes (`/employee/*`)

All wrapped in `RequireEmployee > EmployeeLayout`.

| Path | Component | Auth Guard | File Exists |
|------|-----------|------------|-------------|
| `/employee/login` | `EmployeeLogin` | None | Yes — `client/pages/employee/Login.tsx` |
| `/employee` (index) | `EmployeeDashboard` | `RequireEmployee` | Yes — `client/pages/employee/Dashboard.tsx` |
| `/employee/assignments` | `EmployeeAssignments` | `RequireEmployee` | Yes — `client/pages/employee/Assignments.tsx` |
| `/employee/assignments/:id` | `EmployeeAssignmentDetail` | `RequireEmployee` | Yes — `client/pages/employee/AssignmentDetail.tsx` |
| `/employee/messages` | `EmployeeMessages` | `RequireEmployee` | Yes — `client/pages/employee/Messages.tsx` |
| `/employee/timesheets` | `EmployeeTimesheets` | `RequireEmployee` | Yes — `client/pages/employee/Timesheets.tsx` |
| `/employee/profile` | `EmployeeProfile` | `RequireEmployee` | Yes — `client/pages/employee/Profile.tsx` |

---

## Section 2: Customer Dashboard Page Inventory

### 2.1 Dashboard Overview — `client/pages/Dashboard.tsx`

- **Data hooks:** `useDashboardData(user.id)`, `useSubscriptions(user.id)`, `useProfile()`, `useProperties(user.id)`, `useCart()`
- **API routes called:** All via Supabase directly (no REST API calls)
- **Hardcoded/mock data:** None — all state-driven from hooks
- **TODO/FIXME:** None found
- **Notes/Issues:**
  - Shows "pre-customer" view if `is_onboarded === false` and no active subscription → redirects to `/onboarding`
  - Active subscription check uses `subscriptions` table, not Stripe directly
  - `upcomingVisits` and `recentVideos` come from `useDashboardData` which queries appointments + job_media
  - Delete Account button (line 376–378 in Profile.tsx) renders as a button but has no `onClick` handler — it is a dead UI element

### 2.2 Appointments — `client/pages/dashboard/Appointments.tsx`

- **Data hooks:** `useAppointments(user.id)`, `useMarketplaceOrders(user.id)`, `useCart()`
- **API routes called:**
  - `GET /api/availability?days=45` (in RescheduleDialog, called on open)
  - `POST /api/appointments/:id/reschedule` (rescheduling)
- **Hardcoded/mock data:** None
- **TODO/FIXME:**
  - Line 405: `title: "Reminders coming in Phase 2"` — the "Add Reminders" button has a toast saying reminder subscriptions are not yet implemented
- **Feature completeness:**
  - Appointment list: COMPLETE — reads from `appointments` table via hook
  - Reschedule dialog: COMPLETE — calls `/api/availability` and `/api/appointments/:id/reschedule`
  - Visit Recaps tab: COMPLETE — renders `VideoRecapGrid` component
  - "Add Reminders" button: PLACEHOLDER — toast only, no backend

### 2.3 Properties — `client/pages/dashboard/Properties.tsx`

- **Data hooks:** `useProperties(user.id)`
- **API routes called:** Supabase direct client calls to `properties` table (update gate code, delete property)
- **Hardcoded/mock data:** `isMock` flag on properties (from hook; mock properties have delete disabled)
- **TODO/FIXME:** None found
- **Feature completeness:** COMPLETE — CRUD on properties, gate code edit, `AddPropertyDialog` component

### 2.4 Billing — `client/pages/dashboard/Billing.tsx`

- **Data hooks:** `useProperties(user.id)`, `useSubscriptions(user.id)`, `useProfile()`
- **API routes called:**
  - `POST /api/billing/create-portal-session`
  - `POST /api/billing/cancel-subscription`
  - `GET /api/billing/invoices?limit=10`
  - Plan change → `POST /api/billing/update-subscription-plan` (via `PlanChangeDialog`)
  - Cadence change → `POST /api/billing/update-subscription-cadence` (via `CadenceChangeDialog`)
  - Payment method → `POST /api/billing/attach-payment-method` (via `PaymentMethodDialog`)
- **Hardcoded/mock data:**
  - Default card display: `cardLast4: "4242"`, `cardBrand: "Visa"`, `cardExpiry: "12/2026"` — defaults shown when `profile.card_last4` is null (lines 95–98). Real data requires Stripe webhook to populate `profiles.card_last4`.
  - `handlePaymentMethodSuccess` hardcodes Mastercard 5555 on success (line 273–277) — not reading actual added card info back from Stripe
- **TODO/FIXME:** None found
- **Feature completeness:** MOSTLY COMPLETE — portal, cancellation, invoices, plan/cadence changes all wired. Payment method update uses a mock success handler that does not read real card data back.

### 2.5 Marketplace — `client/pages/dashboard/Marketplace.tsx`

- **Data hooks:** `useCatalogItems()`, `useCart()`, `useAppointments(user.id)`, `useMarketplaceOrders(user.id)`
- **API routes called:**
  - `POST /api/marketplace/create-payment-intent` (checkout)
  - Promo validation via `CheckoutReview` component (calls `/api/marketplace/validate-promo`)
- **Hardcoded/mock data:** None — catalog loaded from `marketplace_catalog` table
- **TODO/FIXME:** None found
- **Feature completeness:** COMPLETE — full browse/cart/checkout/orders flow wired end-to-end

### 2.6 Help — `client/pages/dashboard/Help.tsx`

- **Data hooks:** `useMessages(user.id)` (for message threads)
- **API routes called:** Supabase direct calls to `tickets`, `messages`, `message_threads` tables
- **Hardcoded/mock data:** None
- **TODO/FIXME:** None found
- **Feature completeness:** COMPLETE — ticket creation, re-service request, message thread view and reply all functional

### 2.7 Profile — `client/pages/dashboard/Profile.tsx`

- **Data hooks:** `useProfile()`
- **API routes called:** Supabase direct calls (`profiles` table update, `supabase.auth.updateUser`)
- **Hardcoded/mock data:** Notification prefs default to `localStorage` when DB column `notification_preferences` is null
- **TODO/FIXME:** None found
- **Issues:**
  - Delete Account button (line 376): renders as ghost button with `Trash2` icon but has no `onClick` handler — dead UI
- **Feature completeness:** MOSTLY COMPLETE — contact edit, password change, notification prefs, email change with confirmation; Delete Account is missing implementation

### 2.8 Orders — `client/pages/dashboard/Orders.tsx`

Not a standalone route. Embedded inside `DashboardMarketplace` as the "My Orders" tab. Reads from `marketplace_orders` via `useMarketplaceOrders` hook.

### 2.9 Videos — `client/pages/dashboard/Videos.tsx`

- **Data hooks:** None (direct Supabase calls)
- **API routes called:** Supabase direct — `appointments → assignments → job_media`
- **Hardcoded/mock data:** `duration: "—"` (line 130) — video duration not available in `job_media` schema; hardcoded dash
- **TODO/FIXME:** Comment at line 133: `// real thumbnails not yet available in job_media`
- **Route status:** NOT ACCESSIBLE — the route `/dashboard/videos` redirects to `/dashboard/appointments`. The file exists and is functional but unreachable.
- **Feature completeness:** COMPLETE as a component, UNREACHABLE as a route

---

## Section 3: Admin Dashboard Page Inventory

### 3.1 Overview — `client/pages/admin/Overview.tsx`

- **Route:** `/admin`
- **Purpose:** KPI dashboard, upcoming appointments, support tickets, newest customers, operational alerts
- **Backend routes:** `supabase` direct (profiles, appointments, tickets, payments, messages), `/api/admin/subscriptions/needs-scheduling`, `/api/admin/subscriptions/past-due`, `/api/admin/employees`, `/api/admin/appointments` (POST to create)
- **DB tables:** `profiles`, `appointments`, `tickets`, `payments`, `messages`, `subscriptions`
- **Completeness:** COMPLETE (real data) with one issue: **fallback dummy tickets** (lines 221–234) — if the `tickets` table query returns empty or fails, two hardcoded fake tickets are displayed in the UI. This would mislead admins into thinking there are open tickets when there may not be.
- **Issues:** MTD revenue KPI reads from a `payments` table that is only populated when `invoice.paid` webhook fires — no data until real invoices exist.

### 3.2 Customers — `client/pages/admin/Customers.tsx`

- **Route:** `/admin/customers`
- **Purpose:** Customer list, search, detail drill-down, create customer, link to appointments/subscriptions
- **Backend routes:** Supabase direct (`profiles`, `subscriptions`, `appointments`)
- **DB tables:** `profiles`, `subscriptions`, `appointments`
- **Completeness:** MOSTLY COMPLETE — list/search/detail are real. Line 97: `status: (p.role === "admin" ? "active" : "active") as any, // Placeholder status mapping` — customer status is always hardcoded to "active" regardless of subscription status. Line 456: note in code describes the customer detail as "placeholder establishes future customer context model"

### 3.3 Properties — `client/pages/admin/Properties.tsx`

- **Route:** `/admin/properties`
- **Purpose:** All properties across all customers, CRUD
- **Backend routes:** Supabase direct (`properties`, `profiles`)
- **DB tables:** `properties`, `profiles`
- **Completeness:** COMPLETE — real data, search, edit/add/remove

### 3.4 Appointments — `client/pages/admin/Appointments.tsx`

- **Route:** `/admin/appointments`
- **Purpose:** Full appointment table, bulk technician assignment, reschedule, cancel, dispatch, blackout date management, scheduling queue
- **Backend routes:**
  - Supabase direct: `appointments`, `assignments`, `profiles`, `properties`, `employees`
  - `/api/admin/blackout-dates` (GET, POST, DELETE)
  - `/api/admin/subscriptions/needs-scheduling` (GET)
  - `/api/admin/appointments/:id/dispatch` (POST)
  - `/api/admin/appointments/:id/cancel` (PATCH)
  - `/api/admin/marketplace/orders/by-appointment/:id` (GET — linked orders in reschedule dialog)
- **DB tables:** `appointments`, `assignments`, `profiles`, `properties`, `employees`, `blackout_dates`
- **Completeness:** COMPLETE — most feature-rich admin page. Full CRUD, dispatch with SMS, cancellation with email, blackout dates, scheduling queue panel.

### 3.5 Visits — `client/pages/admin/Visits.tsx`

- **Route:** `/admin/visits`
- **Purpose:** Completed visits log with technician info and video links
- **Backend routes:** Supabase direct (`appointments`, `profiles`, `properties`, `assignments`)
- **DB tables:** `appointments`, `profiles`, `properties`, `assignments`
- **Completeness:** COMPLETE — reads real completed appointments, resolves technician name via employees/profiles join

### 3.6 Employees — `client/pages/admin/Employees.tsx`

- **Route:** `/admin/employees`
- **Purpose:** Employee roster management (hire, view, edit, deactivate)
- **Backend routes:** Supabase direct (`employees`, `profiles`), `/api/admin/employees` (via adminApi)
- **DB tables:** `employees`, `profiles`
- **Completeness:** MOSTLY COMPLETE — list/create/edit functional; employee onboarding creates both a `profiles` record and an `employees` record

### 3.7 Employee Tracking — `client/pages/admin/EmployeeTracking.tsx`

- **Route:** `/admin/employee-tracking`
- **Purpose:** Live map of technician GPS locations and current assignments
- **Backend routes:** `/api/admin/tracking/employees` (GET, auto-refresh every 5s)
- **DB tables:** `employees`, `assignments`, `profiles` (via server route)
- **Completeness:** MOSTLY COMPLETE — map component exists (`EmployeeMap`), data polled every 5s. GPS coordinates depend on employees actively updating location (no mobile app push — data must be set via employee portal or backend update).

### 3.8 Route Planning — `client/pages/admin/RoutePlanning.tsx`

- **Route:** `/admin/route-planning`
- **Purpose:** Build optimized daily routes for technicians
- **Backend routes:** `/api/admin/routes` (GET/POST), `/api/admin/routes/:id` (DELETE), `/api/admin/routes/:id/stops/:stopId` (PATCH)
- **DB tables:** Implied `routes`, `route_stops` — not confirmed in migrations read
- **Completeness:** PARTIAL — UI is complete with real API calls, but `routes`/`route_stops` tables are not in the reviewed migrations (could be in Supabase without a migration file)

### 3.9 Billing — `client/pages/admin/Billing.tsx`

- **Route:** `/admin/billing`
- **Purpose:** Payment history, marketplace order management, fulfillment status updates
- **Backend routes:**
  - Supabase direct: `payments`, `profiles`
  - `useAdminMarketplaceOrders` hook → Supabase `marketplace_orders`, `marketplace_order_items`, `profiles`, `properties`
  - `/api/admin/marketplace/orders/:id/fulfill` (POST — fulfill an order)
- **DB tables:** `payments`, `marketplace_orders`, `marketplace_order_items`, `profiles`, `properties`
- **Completeness:** COMPLETE — real payment data, real order management, fulfillment status update

### 3.10 Revenue — `client/pages/admin/Revenue.tsx`

- **Route:** `/admin/revenue`
- **Purpose:** Stripe revenue analytics, 30-day trend chart, invoice list
- **Backend routes:** `/api/admin/stripe/status`, `/api/admin/stripe/revenue?days=30`, `/api/admin/stripe/invoices?limit=20`
- **DB tables:** None directly (reads from Stripe via server routes)
- **Completeness:** COMPLETE — real Stripe data, recharts chart, invoice table

### 3.11 Messages — `client/pages/admin/Messages.tsx`

- **Route:** `/admin/messages`
- **Purpose:** Message threads between admins/technicians and customers
- **Backend routes:** Supabase direct (`message_threads`, `messages`, `profiles`)
- **DB tables:** `message_threads`, `messages`, `profiles`
- **Completeness:** COMPLETE — thread list, message read, reply send

### 3.12 Tickets — `client/pages/admin/Tickets.tsx`

- **Route:** `/admin/tickets`
- **Purpose:** Support ticket management with status updates
- **Backend routes:** Supabase direct (`tickets`, `profiles`)
- **DB tables:** `tickets`, `profiles`
- **Completeness:** COMPLETE — list, status update, priority filter

### 3.13 Business Hours — `client/pages/admin/BusinessHours.tsx`

- **Route:** `/admin/business-hours`
- **Purpose:** Configure operational days and arrival windows (morning/afternoon)
- **Backend routes:** `/api/admin/business-hours` (GET), `/api/admin/business-hours/:id` (PATCH)
- **DB tables:** `business_hours`
- **Completeness:** COMPLETE — toggle day on/off, configure windows; directly feeds the availability system

### 3.14 Notifications — `client/pages/admin/Notifications.tsx`

- **Route:** `/admin/notifications`
- **Purpose:** Notification log viewer (emails and SMS sent/failed/skipped)
- **Backend routes:** `/api/admin/notifications` (GET)
- **DB tables:** `notification_log`
- **Completeness:** COMPLETE — real log data, status/type filters

### 3.15 Settings — `client/pages/admin/Settings.tsx`

- **Route:** `/admin/settings`
- **Purpose:** Display current environment variable configuration status (read-only)
- **Backend routes:** Supabase direct (`site_settings` table if configured)
- **DB tables:** `site_settings` (implied)
- **Completeness:** PARTIAL — primarily displays API key configuration status (Supabase, Stripe, SendGrid/Resend, Twilio, Google Maps, Sentry). Cannot save settings through UI — requires env var changes.

### 3.16 Content — `client/pages/admin/Content.tsx`

- **Route:** `/admin/content`
- **Purpose:** Manage blog posts, FAQs, and marketplace catalog items
- **Backend routes:** `/api/admin/cms/*` routes via `cmsApi()` helper
- **DB tables:** `cms_pages`/`cms_content` (via adminCms route), `marketplace_catalog`
- **Completeness:** COMPLETE — real CRUD for all three content types

### 3.17 Website Manager — `client/pages/admin/WebsiteManager.tsx`

- **Route:** `/admin/website-manager`
- **Purpose:** CMS for static site content — hero text, images, FAQs, services, blog posts, testimonials
- **Backend routes:** `/api/admin/cms/*` via `cmsApi()`, Supabase storage (`site-images` bucket)
- **DB tables:** `cms_content`, Supabase storage
- **Completeness:** COMPLETE — rich CMS with image upload, text content management, live preview toggle

### 3.18 Pricing — `client/pages/admin/Pricing.tsx`

- **Route:** `/admin/pricing`
- **Purpose:** Manage service pricing tiers (acreage-based, cadence-based)
- **Backend routes:** Supabase direct (`service_plans` table)
- **DB tables:** `service_plans`
- **Completeness:** COMPLETE — CRUD for pricing tiers that feed `findStripePriceAsync()`

### 3.19 Promos — `client/pages/admin/Promos.tsx`

- **Route:** `/admin/promos`
- **Purpose:** Manage promo codes and discount campaigns
- **Backend routes:** Supabase direct (`promo_codes` table)
- **DB tables:** `promo_codes`
- **Completeness:** COMPLETE — create/deactivate promo codes with Stripe promotion code ID linkage

### 3.20 Service Areas — `client/pages/admin/ServiceAreas.tsx`

- **Route:** `/admin/service-areas`
- **Purpose:** Manage ZIP codes / cities served
- **Backend routes:** Supabase direct (`service_areas` table)
- **DB tables:** `service_areas`
- **Completeness:** COMPLETE — add/remove ZIP codes and city entries

### 3.21 Reports — `client/pages/admin/Reports.tsx`

- **Route:** `/admin/reports`
- **Purpose:** CSV data exports (customers, properties, appointments, payments, orders)
- **Backend routes:** Supabase direct queries then client-side CSV generation
- **DB tables:** `profiles`, `properties`, `appointments`, `payments`, `marketplace_orders`, `marketplace_order_items`
- **Completeness:** COMPLETE — all exports generate real CSV from live data

---

## Section 4: Employee App Page Inventory

### 4.1 Employee Dashboard — `client/pages/employee/Dashboard.tsx`

- **Route:** `/employee`
- **Purpose:** Today's assignments overview for the logged-in technician
- **Backend routes called:** Supabase direct (`employees`, `assignments`, `appointments`, `properties`, `profiles`)
- **DB tables:** `employees`, `assignments`, `appointments`, `properties`, `profiles`
- **Completeness:** COMPLETE

### 4.2 Assignments — `client/pages/employee/Assignments.tsx`

- **Route:** `/employee/assignments`
- **Purpose:** Full assignment list for the technician (past + upcoming)
- **Backend routes called:** Supabase direct
- **DB tables:** `assignments`, `appointments`, `properties`
- **Completeness:** COMPLETE

### 4.3 Assignment Detail — `client/pages/employee/AssignmentDetail.tsx`

- **Route:** `/employee/assignments/:id`
- **Purpose:** Individual job detail with status transitions, customer info, map, messaging, pre-service checklist
- **Backend routes called:** Supabase direct (`assignments`, `appointments`, `profiles`, `properties`, `message_threads`, `messages`)
- **DB tables:** `assignments`, `appointments`, `profiles`, `properties`, `message_threads`, `messages`
- **Job completion flow:**
  - Status transitions: `en_route` → `in_progress` → `completed` via `updateStatus()` — WIRED (writes to `assignments` table)
  - Map: Shows `MiniMap` if `lat`/`lng` present; **GPS coordinates are always null** — `lat: null, lng: null` hardcoded on line 90 — properties table lacks lat/lng columns or they are not being fetched
  - Navigation deep link: `navUrl(lat, lng)` only available when coords exist — effectively disabled
  - In-app messaging: COMPLETE — reads/sends messages via `message_threads`/`messages`
  - Pre-service checklist: STATIC HTML — checkboxes with labels ("PPE on", "Pets accounted for", etc.) with no persistence; checking them does nothing
  - **Photo/video upload: ABSENT** — no file upload UI or API call exists in this page
- **Completeness:** PARTIAL — status flow works, messaging works; photo upload and GPS navigation are missing/broken

### 4.4 Timesheets — `client/pages/employee/Timesheets.tsx`

- **Route:** `/employee/timesheets`
- **Backend routes called:** `/api/employee/shifts` (via server/routes/employeeShifts.ts)
- **DB tables:** `employee_shifts`
- **Completeness:** COMPLETE — clock in/out, hours summary

### 4.5 Messages — `client/pages/employee/Messages.tsx`

- **Route:** `/employee/messages`
- **Backend routes called:** Supabase direct (`message_threads`, `messages`)
- **DB tables:** `message_threads`, `messages`
- **Completeness:** COMPLETE

### 4.6 Profile — `client/pages/employee/Profile.tsx`

- **Route:** `/employee/profile`
- **Backend routes called:** Supabase direct (`employees`, `profiles`)
- **DB tables:** `employees`, `profiles`
- **Completeness:** COMPLETE — view/edit contact details, vehicle info

---

## Section 5: Stripe Inventory

### 5.1 Server Route Files

```
server/routes/billingStripe.ts       — Customer billing endpoints
server/routes/webhooksStripe.ts      — Stripe webhook handler
server/routes/adminStripe.ts         — Admin Stripe analytics
server/routes/marketplaceStripe.ts   — Marketplace payment intents
```

### 5.2 billingStripe.ts Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/billing/create-checkout-session` | Hosted Checkout redirect (legacy path, still functional) |
| POST | `/api/billing/create-payment-intent` | Inline PaymentElement checkout (primary path) — handles subscription, one_time, annual |
| POST | `/api/billing/confirm-booking` | Called after client Stripe confirmation succeeds; creates appointment + subscription record |
| POST | `/api/billing/create-portal-session` | Opens Stripe Customer Portal |
| POST | `/api/billing/update-subscription-plan` | Change plan/tier; creates subscription if none exists |
| POST | `/api/billing/update-subscription-cadence` | Change service frequency |
| POST | `/api/billing/create-and-attach-payment-method` | Test-mode only — attaches via Stripe test token |
| POST | `/api/billing/attach-payment-method` | Production — attaches PaymentMethod ID to customer |
| POST | `/api/billing/cancel-subscription` | Cancel at period end via Stripe DELETE |
| GET | `/api/billing/invoices` | Customer's paid invoice list from Stripe |

### 5.3 webhooksStripe.ts — Webhook Event Handlers

| Event | Action Taken |
|-------|-------------|
| `checkout.session.completed` | For marketplace: creates `marketplace_orders` + `marketplace_order_items` records, fetches line items from Stripe API, creates service_order. For subscription: upserts `subscriptions` table, creates first `appointments` record from metadata, persists `service_preferences` to `properties`. For one_time payment: creates service_order + appointment. |
| `invoice.paid` | Records payment to `payments` table, upserts `subscriptions` (status=active, period end), marks user `is_onboarded=true`, creates `service_order` for billing period |
| `invoice.payment_failed` | Updates `subscriptions.status = 'past_due'` |
| `checkout.session.expired` | Marks pending marketplace orders as `expired` |
| `customer.subscription.updated` | Syncs non-active status changes (canceled, paused, etc.) to `subscriptions` — deliberately does NOT set active to avoid premature activation |
| `customer.subscription.deleted` | Sets `subscriptions.status = 'canceled'` |
| `payment_intent.succeeded` | For marketplace purchases: updates order to `completed`, creates service_order, increments promo used_count (atomic RPC with fallback) |
| `payment_intent.payment_failed` | Marks marketplace order as `failed` |
| `charge.refunded` | Marks `marketplace_orders.status = 'refunded'`, `payments.status = 'refunded'`, calls `markServiceOrderRefunded()` |

### 5.4 Billing Flow Completeness

| Flow | Complete Server Route? | Notes |
|------|------------------------|-------|
| New subscription (onboarding checkout) | YES | `create-payment-intent` → `confirm-booking` (inline) OR `create-checkout-session` → `checkout.session.completed` webhook |
| Subscription renewal (`invoice.paid`) | YES | Webhook handles: payment record, subscription sync, service_order creation |
| Plan change/upgrade | YES | `update-subscription-plan` — finds existing Stripe subscription by property_id metadata, updates item |
| Service frequency change | YES | `update-subscription-cadence` — finds subscription, swaps price |
| Cancellation | YES | `cancel-subscription` (at_period_end=true via Stripe DELETE) + `customer.subscription.deleted` webhook |
| One-time marketplace payment | YES | `marketplaceStripe.ts create-payment-intent` → `payment_intent.succeeded` webhook |
| Annual plan | YES | `create-payment-intent` with `program=annual` creates flat PaymentIntent from `ANNUAL_TIERS_SERVER` lookup |
| Failed payment handling | PARTIAL | `invoice.payment_failed` marks subscription `past_due`. Admin overview shows past-due alert. No customer-facing dunning email is sent (Stripe handles dunning via dashboard settings) |

---

## Section 6: Availability System

### 6.1 Server Route

**`server/routes/availability.ts`** — `GET /api/availability`

- Query params: `date_from`, `date_to`, `days` (max 60), `service_area_id`
- Logic:
  1. Fetches `blackout_dates` for date range from Supabase
  2. Fetches `business_hours` (global + area-specific overrides)
  3. Counts active appointments per date+window via `supabaseAdmin` (bypasses RLS)
  4. Computes capacity using `MVP_TECHNICIAN_COUNT = 1` (hardcoded; comment explicitly notes "until employee scheduling is implemented")
  5. Returns `days[]` array with `is_operational`, `is_blackout`, and `windows[]` with `available`, `remaining`, `booked`

### 6.2 adminBusinessHours Route

**`server/routes/adminBusinessHours.ts`** — manages `business_hours` table:
- `GET /api/admin/business-hours` — list all rows
- `PATCH /api/admin/business-hours/:id` — toggle `is_operational`, update windows JSON

### 6.3 adminBlackoutDates Route

**`server/routes/adminBlackoutDates.ts`** — manages `blackout_dates` table:
- `GET /api/admin/blackout-dates` — list all
- `POST /api/admin/blackout-dates` — add date (reports count of affected existing appointments)
- `DELETE /api/admin/blackout-dates/:id` — remove

### 6.4 Migration File

**`db/migrations/2026-05-16_phase1_reliable_availability.sql`** — EXISTS. Creates `business_hours` and `blackout_dates` tables with proper indexes and RLS policies. Seeds default business hours (Mon–Sat operational, morning + afternoon windows, max_jobs_per_tech=3).

### 6.5 Is Availability Wired Into Booking?

**YES — fully wired for both new bookings and rescheduling.**

- `client/components/schedule/ScheduleFlow.tsx` (line 260): calls `fetch('/api/availability?date_from=...&days=45')` during the scheduling step. Availability data drives calendar disabled-dates and window selection.
- `client/pages/dashboard/Appointments.tsx` (RescheduleDialog, line 83): calls `fetch('/api/availability?days=45')` on dialog open; re-fetches on 409 conflict.
- `server/routes/schedule.ts`: server-side re-validates the window availability before confirming a booking (function `checkWindowAvailability` at line 32).

**Verdict: The availability system is fully wired — not decorative.**

**Gap:** Technician capacity uses `MVP_TECHNICIAN_COUNT = 1` hardcoded. Real multi-technician capacity is not yet implemented (comment at line 159 of availability.ts confirms this).

---

## Section 7: Appointment Lifecycle Trace

### Step 1: Customer Books

**Component:** `client/components/schedule/ScheduleFlow.tsx`

Flow:
1. Customer selects plan, adds property, picks availability preferences, selects date/window
2. `ScheduleFlow` calls `/api/availability` to populate calendar
3. Customer selects date + window, submits payment via Stripe `PaymentElement`
4. On Stripe confirmation: calls `POST /api/billing/confirm-booking` with `paymentIntentId`, `scheduledDate`, `windowId`, etc.
5. `confirm-booking` verifies PI status with Stripe, creates `appointments` record, upserts `subscriptions` record, marks `is_onboarded=true`

**Tables written:** `appointments`, `subscriptions`, `properties` (service_preferences), `profiles` (is_onboarded)

**Wired to next step:** YES — appointment created, subscription record exists

### Step 2: Server Creates Appointment

**Route:** `POST /api/billing/confirm-booking` (primary) + `checkout.session.completed` webhook (redundant safety net)

Both paths include idempotency checks to avoid duplicate appointments. The appointment is created with status `"scheduled"`, `scheduled_date`, `window`, `window_label`, `scheduled_at`.

**Table:** `appointments`

### Step 3: Admin Sees Appointments

**Component:** `client/pages/admin/Appointments.tsx`

- Queries `appointments` directly via Supabase client
- Joins `profiles` (customer names) and `properties` (addresses) via separate parallel queries
- Resolves technician name from `assignments → employees → profiles`
- Status shown via `StatusBadge` component
- Admin can modify date/time, assign technician (bulk upsert to `assignments`), dispatch (triggers SMS), cancel (sends cancellation email)

**Route:** Direct Supabase queries (no API endpoint for list — reads as admin with supabase client)

**Wired to next step:** YES — "Assign technician" button upserts to `assignments` table

### Step 4: Employee Gets Assigned

**Mechanism:** Admin bulk-assigns in `admin/Appointments.tsx` by selecting appointments and choosing a technician → `supabase.from("assignments").upsert(...)` with `appointment_id` + `employee_id` + `status: "pending"`

**Table:** `assignments`

**Employee sees assignment:** `client/pages/employee/Dashboard.tsx` and `client/pages/employee/Assignments.tsx` query `assignments` filtered by `employee_id` (resolved from `employees` table via auth user ID)

**Wired to next step:** YES

### Step 5: Employee Completes Job

**Component:** `client/pages/employee/AssignmentDetail.tsx`

- `updateStatus("en_route")` → writes `assignments.status = "en_route"`, `en_route_at = now`
- `updateStatus("in_progress")` → writes `assignments.status = "in_progress"`, `started_at = now`
- `updateStatus("completed")` → writes `assignments.status = "completed"`, `completed_at = now`

**GAPS:**
- No photo/video upload from employee portal — `job_media` table is written by other means (not the employee app)
- Checklist is static HTML (no persistence)
- No automatic `appointments.status` update on assignment completion — admin must manually change appointment status

**Table:** `assignments`

**Wired to next step:** PARTIAL — completion status written to `assignments`, but no automatic cascade to `appointments.status = "completed"` or video upload trigger

### Step 6: Customer Sees Recap

**Component:** `client/components/dashboard/VideoRecapGrid.tsx`

- Fetches `appointments → assignments → job_media` (all `media_type = "video"`) for the customer
- Video URL rendered as external link (`<a href={video.url} target="_blank">`)
- No in-app video player — links to external URL

**Table:** `job_media`

**Wired:** YES for display — but `job_media` records must be created externally (no upload path from employee app). The recap video must be uploaded by an admin or external process.

---

## Section 8: Notification Inventory

### 8.1 Notification Infrastructure

- **Email provider:** Resend (`server/services/notifications/resendClient.ts`) — configured via `RESEND_API_KEY` and `RESEND_FROM_EMAIL` env vars
- **SMS provider:** Twilio (`server/services/notifications/twilioClient.ts`) — configured via `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` env vars
- **Dedup/logging:** `notification_log` table via `server/services/notifications/notificationLogger.ts` — records every sent/failed/skipped notification

### 8.2 Notification Type Matrix

| Notification | Implemented? | Triggered By | Scheduled? |
|-------------|--------------|--------------|------------|
| Welcome/confirmation email (appointment) | YES | `server/routes/schedule.ts` line 214 calls `sendAppointmentConfirmation()` after booking created | No — fire-and-forget on booking |
| 24-hour reminder email | YES | `netlify/functions/send-reminders.ts` calls `runReminderBatch(tomorrow, "reminder_24h")` | YES — `netlify.toml` schedules at `0 7 * * *` (7AM UTC daily) |
| Same-day reminder email | YES | `netlify/functions/send-reminders.ts` calls `runReminderBatch(today, "reminder_same_day")` | YES — same scheduled function |
| Reschedule confirmation | YES (email) | `server/routes/customerAppointments.ts` (reschedule endpoint) — sends via Resend | No — fire-and-forget on reschedule |
| Cancellation email | YES | `server/routes/adminAppointments.ts` `/appointments/:id/cancel` sends cancellation email via Resend | No — triggered on admin cancel action |
| Technician en-route SMS | YES | `server/routes/adminAppointments.ts` `/appointments/:id/dispatch` fires `sendEnRouteSMS()` | No — triggered on admin dispatch |
| Payment receipt | PARTIAL | Stripe sends its own invoice email natively. No custom payment receipt email is sent from this app. | N/A |
| Marketing/SMS reminders from profile | PLACEHOLDER | `notification_preferences` stored in `profiles.notification_preferences` JSON but no system reads this to actually gate sends | — |

### 8.3 Scheduled Function

**`netlify/functions/send-reminders.ts`** — Registered in `netlify.toml` as:
```
[functions.send-reminders]
  schedule = "0 7 * * *"
```
Runs daily at 7:00 AM UTC. Sends both 24h and same-day batches. Has dry-run mode via `REMINDER_DRY_RUN=true` env var. Logs all results to console (Netlify function logs).

### 8.4 SMS Implementation Status

- **En-route SMS:** FULLY WIRED — `sendEnRouteSMS()` is called by the dispatch endpoint and sends a real Twilio message if `TWILIO_*` env vars are set. If not configured, it logs "skipped" to `notification_log` and continues.
- **SMS reminders (customer preference toggle):** NOT WIRED — the profile page allows customers to toggle "SMS Visit Reminders" which writes to `profiles.notification_preferences`. However, the reminder scheduler (`reminderScheduler.ts`) sends only emails (Resend) — it does not check `notification_preferences` or send SMS.

---

## Section 9: Database Table Inventory

### 9.1 Migration Files (in order)

```
db/migrations/2025-02-23_initial_schema.sql
db/migrations/2025-05-20_admin_features_support.sql
db/migrations/2025-11-10_employee_portal.sql
db/migrations/2025-11-15_rls_security_update.sql
db/migrations/2025-11-20_seed_mock_data.sql
db/migrations/2025-11-21_add_phone_to_profiles.sql
db/migrations/2025-11-25_tickets_table.sql
db/migrations/2025-11-26_contact_inquiries.sql
db/migrations/2025-11-28_missing_tables.sql
db/migrations/2026-05-16_stripe_dual_mode.sql
db/migrations/2026-05-16_phase1_reliable_availability.sql
db/migrations/2026-05-16_phase2_notification_infrastructure.sql
db/migrations/2026-05-17_phase3a_employee_persistence.sql
db/migrations/2026-05-18_phase6b_service_preferences.sql
db/migrations/2026-05-23_add_is_onboarded_flag.sql
db/migrations/2026-05-26_parcel_lookup_cache.sql
db/migrations/2026-05-27_add_onboarding_progress.sql
```

### 9.2 Table Status

| Table | Exists in Migrations | Queried in App Code | Orphaned? |
|-------|---------------------|---------------------|-----------|
| `profiles` | YES (initial_schema) | YES — extensively | No |
| `properties` | YES (initial_schema) | YES — extensively | No |
| `subscriptions` | YES (initial_schema) | YES — billing, webhooks, overview | No |
| `appointments` | YES (initial_schema) | YES — all portals | No |
| `assignments` | YES (employee_portal) | YES — employee + admin | No |
| `employees` | YES (employee_portal) | YES — employee + admin | No |
| `job_media` | YES (employee_portal) | YES — Videos page, VideoRecapGrid | No |
| `marketplace_orders` | YES (missing_tables migration likely) | YES — marketplace | No |
| `marketplace_order_items` | YES | YES — billing admin, webhook | No |
| `marketplace_catalog` | YES | YES — useCatalogItems hook | No |
| `promo_codes` | YES | YES — promos admin, checkout review | No |
| `notification_log` | YES (phase2_notification_infrastructure) | YES — notificationLogger, admin/notifications | No |
| `business_hours` | YES (phase1_reliable_availability) | YES — availability route, admin/business-hours | No |
| `blackout_dates` | YES (phase1_reliable_availability) | YES — availability route, admin/appointments | No |
| `service_areas` | YES (initial or missing_tables) | YES — admin/service-areas | No |
| `payments` | YES | YES — admin overview, billing admin, webhook | No |
| `tickets` | YES (tickets_table) | YES — help page, admin/tickets, overview | No |
| `message_threads` | YES | YES — help, employee messages, admin messages | No |
| `messages` | YES | YES — all messaging surfaces | No |
| `plans` / `service_plans` | YES (admin_features_support likely) | YES — pricing admin, `findStripePriceAsync` | No |
| `employee_shifts` | YES (employee_portal) | YES — timesheets | No |
| `profiles_metadata` | NOT CONFIRMED in reviewed migrations | Not observed in app code | Possibly orphaned |

**Note on `profiles_metadata`:** Not observed in any migration file reviewed. Not found in app code searches. May not exist or may have been superseded by JSONB columns on `profiles` (`notification_preferences`, `subscription_metadata`, `onboarding_progress`).

---

## Section 10: Placeholder Detection

### 10.1 TODO/FIXME

| File | Line | Description |
|------|------|-------------|
| `client/pages/dashboard/Appointments.tsx` | 405 | `title: "Reminders coming in Phase 2"` — Add Reminders button is a no-op toast |

### 10.2 Coming Soon

| File | Location | Description |
|------|----------|-------------|
| `client/pages/Blog.tsx` | Line 73 | "Posts coming soon. Check back after our next service wave." — Blog page has no real posts rendered |
| `client/pages/Placeholder.tsx` | Line 25 | Generic "Coming Soon" component — used as a page shell for unfinished marketing pages |

### 10.3 Dummy / Fake / Mock Data

| File | Lines | Description |
|------|-------|-------------|
| `client/pages/admin/Overview.tsx` | 221–234 | `dummyTickets` array — 2 hardcoded fake tickets shown if real tickets fail to load or return empty |
| `client/pages/dashboard/Billing.tsx` | 95–98 | Default payment method display: `cardLast4: "4242"`, `cardBrand: "Visa"`, `cardExpiry: "12/2026"` — shown when `profile.card_last4` is null |
| `client/pages/dashboard/Billing.tsx` | 273–277 | `handlePaymentMethodSuccess` hardcodes Mastercard 5555 after successful payment method add (does not read actual card info back from Stripe) |
| `client/pages/dashboard/Videos.tsx` | 130 | `duration: "—"` hardcoded — `job_media` table has no duration column |

### 10.4 Placeholder Features

| File | Lines | Description |
|------|-------|-------------|
| `client/pages/admin/Customers.tsx` | 97 | `status: "active" // Placeholder status mapping` — all customers always shown as "active" regardless of subscription state |
| `client/pages/admin/Customers.tsx` | 456 | Description text: "This placeholder establishes the future customer context model" in customer detail panel |
| `client/pages/dashboard/Profile.tsx` | 376–378 | Delete Account button has no `onClick` handler — dead UI |
| `client/pages/employee/AssignmentDetail.tsx` | 275–284 | Pre-service checklist — static HTML checkboxes with no persistence backend |
| `client/pages/employee/AssignmentDetail.tsx` | 90 | `lat: null, lng: null` — GPS always null; map/navigation never available |

### 10.5 Hardcoded Business Data

| File | Description |
|------|-------------|
| `server/routes/billingStripe.ts` (lines 10–23) | Annual pricing tiers hardcoded in JS array (`ANNUAL_TIERS_SERVER`) — mirrors client-side array; must be kept in sync manually |
| `server/routes/availability.ts` (line 161) | `MVP_TECHNICIAN_COUNT = 1` hardcoded — capacity calculation does not use actual employee count |

---

## Section 11: Production Readiness Flags

### COMPLETE — Features that appear fully wired end-to-end

1. **New subscription checkout flow** — ScheduleFlow → create-payment-intent → Stripe PaymentElement → confirm-booking → appointment created + subscription upserted
2. **Stripe webhook pipeline** — signature verification, all critical events handled (invoice.paid, payment_failed, subscription events, marketplace)
3. **Availability system** — business_hours + blackout_dates feed a real availability API; fully integrated into booking and rescheduling flows
4. **Appointment reschedule (customer)** — calls /api/availability, then /api/appointments/:id/reschedule with conflict detection (409)
5. **Admin appointment management** — full table, bulk assignment, dispatch with SMS, cancellation with email, blackout date management
6. **Marketplace payment flow** — catalog → cart → PaymentIntent → Stripe → webhook → order + order_items recorded
7. **En-route SMS dispatch** — admin clicks Dispatch → SMS sent via Twilio (gracefully skips if not configured)
8. **Appointment reminder emails** — Netlify scheduled function (7AM UTC daily) sends 24h + same-day emails via Resend
9. **Appointment confirmation email** — sent on booking creation via schedule route
10. **Cancellation email** — sent on admin cancel action
11. **Revenue analytics** — real Stripe data via adminStripe route, 30-day chart
12. **Billing portal** — opens real Stripe Customer Portal
13. **Invoice list** — reads real paid Stripe invoices
14. **Plan/cadence change** — updates Stripe subscription item in-place
15. **Subscription cancellation** — cancels at period end in Stripe
16. **Notification log** — full audit trail in notification_log table + admin UI
17. **Customer messaging / tickets** — full bidirectional in-app messaging and ticket system
18. **Employee assignment/status flow** — en_route → in_progress → completed status chain
19. **Reports/CSV exports** — real data from all key tables
20. **Business hours and blackout date management** — admin UI with real persistence

### PARTIAL — Features that exist but have gaps or unfinished wiring

1. **Employee GPS / live tracking** — tracking page polls `/api/admin/tracking/employees` but `lat`/`lng` are always null in AssignmentDetail (properties table lacks coordinates). Map and navigation are disabled for all jobs.
2. **Job photo/video capture by employee** — no upload UI in AssignmentDetail; `job_media` records must be created by other means
3. **Appointment status completion cascade** — employee marks assignment `completed` but `appointments.status` is not automatically updated; admin must manually change appointment status
4. **Payment method display** — default card shows "Visa 4242" when `profiles.card_last4` is null; requires webhook or additional sync to populate real card info
5. **Customer "Delete Account"** — button renders but has no onClick handler
6. **SMS reminders respecting customer preferences** — `notification_preferences.smsReminders` toggle stored but reminder scheduler only sends emails; not implemented for SMS
7. **Promo code: atomic increment** — has Supabase RPC fallback (`increment_promo_used_count`) but RPC may not be deployed, falling back to non-atomic read-then-write
8. **Route planning** — full UI and API calls exist but `routes`/`route_stops` tables not confirmed in reviewed migrations
9. **Admin customer status** — always shows "active" regardless of subscription state
10. **Annual plan subscription tracking** — annual plan creates a one-time PaymentIntent (not a Stripe subscription); no recurring invoice.paid webhook fires; subscription renewal tracking is absent for annual customers

### MISSING — Features referenced or expected but not found

1. **Employee photo/video upload from field** — job_media table exists, VideoRecapGrid displays videos, but no upload mechanism exists in the employee portal
2. **Real-time GPS location push from employee app** — no WebSocket, geolocation, or push mechanism; employee location only possible via polling a static DB value
3. **Appointment auto-scheduling / recurring generation** — subscriptions have cadence_days but no cron/function generates recurring appointments; admins must manually create each appointment
4. **SMS reminder delivery** — reminder scheduler sends emails only; Twilio integration exists for en-route SMS but not for reminder batch
5. **Stripe dunning email customization** — handled by Stripe natively; app does not send custom payment failure emails
6. **`profiles_metadata` table** — referenced in section 9 but not found in migrations or app code; likely superseded
7. **Two-factor authentication** — Profile page says "Two-factor authentication is managed by your identity provider. Contact support to enable it." — no 2FA implementation
8. **Blog content** — Blog page shows "Posts coming soon"; no real posts render despite blog CMS in WebsiteManager
9. **`routes`/`route_stops` DB tables** — referenced by RoutePlanning UI but not confirmed in migrations

### HIGH-RISK — Anything that would prevent real customer signup, real payment processing, real service delivery, real technician workflow, or billing lifecycle survival

1. **CRITICAL — Annual plan has no renewal path**: Annual customers pay once via PaymentIntent (not a Stripe subscription). No `invoice.paid` fires annually, so `subscriptions` table never updates, `payments` table never receives the renewal record, and no appointment is auto-created for year 2. Annual customers effectively become invisible to the system after their first year.

2. **CRITICAL — No recurring appointment generation**: The app has `subscriptions.cadence_days` but no mechanism (no cron, no webhook, no scheduled function) to generate the next appointment after the current one is completed. Every appointment must be manually created by an admin. At scale this is an operational blocker.

3. **HIGH — Technician capacity is hardcoded at 1**: `MVP_TECHNICIAN_COUNT = 1` in availability.ts means all customers see the same single-technician capacity. A second real technician cannot expand available slots. As the company grows, overbooking cannot be prevented by the availability system.

4. **HIGH — Employee GPS is always null**: `lat: null, lng: null` is hardcoded in AssignmentDetail for every property. The `/admin/employee-tracking` live map and in-app navigation (`navUrl()`) are both permanently disabled for all real jobs. Technicians cannot get turn-by-turn navigation from the app.

5. **HIGH — No photo/video upload by technician**: Customers expect HD video recaps after each visit (explicitly promised in Dashboard UI copy). The `job_media` table exists and VideoRecapGrid displays videos, but there is no upload path from the employee portal. Videos must be uploaded manually by an admin or via external process.

6. **HIGH — Admin customer status always shows "active"**: The status mapping in `admin/Customers.tsx` line 97 hardcodes `"active"` for all customers regardless of subscription state. Admins cannot visually identify canceled or past-due customers from the customers list.

7. **MEDIUM — Stripe test key / live key mismatch risk**: `billingStripe.ts` logs warnings when test key is used in production NODE_ENV or vice versa, but does not block the request. The `findStripePriceAsync()` function resolves price IDs from `service_plans` table — if live price IDs are in the DB but a test key is configured (or vice versa), checkout will fail with "No such price." The fallback to `price_data` partially mitigates this but is not reliable for subscriptions.

8. **MEDIUM — Payment method display shows fake card data**: Default card display falls back to `"Visa 4242"` when `profiles.card_last4` is null. Real customers who have paid but whose card info was not synced to the profiles table will see fake card information in their billing page, potentially causing trust issues or confusion.

9. **MEDIUM — `assign technician` writes tech name (not employee ID) to `appointments.technician`**: In `admin/Appointments.tsx` line 543, `setItems((prev) => prev.map((a) => selectedIds.has(a.id) ? { ...a, technician: empName } : a))` — the display updates with the name. However, the actual `assignments.upsert` is correct (uses `employee_id`). The column `appointments.technician` (if it exists as a string column) would not be updated. This is a display inconsistency rather than a data loss risk, but worth verifying.

10. **LOW — Pre-service checklist in employee app is not persisted**: The checklist in AssignmentDetail is static HTML checkboxes with no state save. If an employee refreshes the page during a job, their checklist progress is lost. This is a UX/compliance risk for service documentation.

---

*Report generated by automated codebase audit. All findings based on reading actual source files. No assumptions made — if a feature was not found in code, it is reported as missing.*
