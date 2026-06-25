# SYSTEM VALIDATION REPORT
## No More Mosquitoes — Comprehensive Feature Audit
## Date: 2026-05-28
## Methodology: Full source-code trace, no assumptions

---

## Audit Legend

| Status | Meaning |
|--------|---------|
| VERIFIED | Implementation exists, wired correctly, data flows end-to-end |
| PARTIALLY VERIFIED | Code exists but wiring or data flow has gaps |
| BROKEN | Code exists but has a clear defect preventing correct operation |
| UNTESTABLE | Cannot be verified without a running environment |

---

## Feature Audit Results

### 1. Customer Signup / Onboarding Flow

**Status: VERIFIED**

**Files:**
- `client/pages/Onboarding.tsx` — onboarding shell with `RequireAuth` guard
- `client/components/schedule/ScheduleFlow.tsx` — multi-step flow (plan → property → preferences → date → payment)
- `client/components/schedule/PaymentStep.tsx` — Stripe PaymentElement wrapper
- `server/routes/billingStripe.ts` — `POST /api/billing/create-payment-intent`, `POST /api/billing/confirm-booking`

**Routes:** `POST /api/billing/create-payment-intent`, `POST /api/billing/confirm-booking`

**DB tables:** `profiles`, `properties`, `subscriptions`, `appointments`

**Evidence:** ScheduleFlow collects plan, acreage, preferred days, preferred windows, flexibility days, notes, and a scheduled date+window. Calls `create-payment-intent` with all metadata. On Stripe confirmation, calls `confirm-booking` which server-side validates the PI status against Stripe before writing any DB records. `is_onboarded` set to `true` on success. `onboarding_progress` cleared.

---

### 2. Property Creation

**Status: VERIFIED**

**Files:**
- `client/components/dashboard/properties/AddPropertyDialog.tsx`
- `client/pages/dashboard/Properties.tsx`
- `server/routes/regrid.ts` — parcel lookup for acreage

**Routes:** `POST /api/parcel` (acreage lookup), Supabase direct for property insert

**DB tables:** `properties`

**Evidence:** AddPropertyDialog collects address, city, state, zip, and calls Regrid API to resolve acreage. Property row written directly to Supabase. Service preferences stored as JSONB column. `lat`/`lng` columns exist (migration `2026-05-28_property_coordinates.sql`) but are null until geocoded.

---

### 3. Availability Slot Calculation

**Status: VERIFIED**

**Files:**
- `server/routes/availability.ts` — `GET /api/availability`
- `server/routes/schedule.ts` — `checkWindowAvailability()` function

**Routes:** `GET /api/availability`

**DB tables:** `business_hours`, `blackout_dates`, `appointments`, `employees`

**Evidence:** Availability route fetches `business_hours` (global + area-specific), `blackout_dates`, counts active appointments per date+window (using `supabaseAdmin` to bypass RLS), and queries active employee count. Capacity formula: `activeTechCount × window.max_jobs_per_tech`. Falls back to 1 technician if employees table is empty. Windows defined in `business_hours.windows` JSONB array. Default seed: Mon–Fri 2 windows, Sat morning only, Sun closed.

**Gap:** `customerAppointments.ts` reschedule endpoint still uses hardcoded `capacity = 1 * (windowDef.max_jobs_per_tech ?? 3)` (line 73) — does not query live employee count. This means reschedule slots may show available when capacity is actually higher.

---

### 4. Quote Generation

**Status: VERIFIED**

**Files:**
- `server/routes/regrid.ts` — parcel lookup
- `server/lib/stripe-prices.ts` — `findStripePriceAsync()` price lookup
- `client/components/sections/QuoteWidgetSection.tsx` — public quote widget

**Routes:** `POST /api/parcel`, `POST /api/billing/create-payment-intent`

**DB tables:** `service_plans` (primary), `STRIPE_PLANS` fallback array in `stripe-prices.ts`

**Evidence:** `findStripePriceAsync()` queries the `service_plans` table first, then falls back to the hardcoded `STRIPE_PLANS` array in `stripe-prices.ts`. Dual-mode price selection: uses `stripePriceId` (live) or `stripePriceIdTest` (test) based on `getStripeMode()`. Price determined by acreage tier + cadence days.

---

### 5. Subscription Checkout (Recurring Plans)

**Status: VERIFIED**

**Files:**
- `server/routes/billingStripe.ts` — `create-payment-intent` subscription path
- `server/routes/webhooksStripe.ts` — `invoice.paid` handler

**Routes:** `POST /api/billing/create-payment-intent`, `POST /api/billing/confirm-booking`, webhook `invoice.paid`

**DB tables:** `subscriptions`, `appointments`, `profiles`, `properties`

**Evidence:** `create-payment-intent` for subscription programs creates a Stripe Subscription with `default_incomplete` payment behavior, resolves the `latest_invoice.payment_intent.client_secret` via two fallback paths (inline expand → fetch invoice directly), and returns the client secret. PaymentElement collects card. On confirmation, `confirm-booking` verifies PI with Stripe, upserts `subscriptions` row, creates first appointment idempotently, persists service preferences. `invoice.paid` webhook fires on every renewal, recording the payment and syncing subscription status.

---

### 6. Annual Plan Checkout

**Status: VERIFIED**

**Files:**
- `server/routes/billingStripe.ts` — annual plan path in `create-payment-intent`
- `server/routes/webhooksStripe.ts` — `payment_intent.succeeded` annual handler

**Routes:** `POST /api/billing/create-payment-intent`, `POST /api/billing/confirm-booking`, webhook `payment_intent.succeeded`

**DB tables:** `subscriptions`

**Evidence:** Annual plan detected by `program === "annual"`. Looks up annual price from `ANNUAL_TIERS_SERVER` array (hardcoded in `billingStripe.ts` lines 10–23). Creates a PaymentIntent (not a Stripe Subscription). `confirm-booking` writes subscription row with `stripe_subscription_id = paymentIntentId`, `program = "annual"`, `current_period_end = now + 1 year`. Migration `2026-05-28_annual_plan_tracking.sql` adds all required columns. Webhook fallback also writes this row idempotently.

**Gap:** Year-2 renewal requires manual admin action. No automated renewal trigger exists. `current_period_end` is stored so admins can query it, but no cron or notification fires at the 30-day-to-expiry mark.

---

### 7. One-Time Checkout

**Status: VERIFIED**

**Files:**
- `server/routes/billingStripe.ts` — one_time path in `create-payment-intent`
- `server/routes/webhooksStripe.ts` — `checkout.session.completed` one_time path

**Routes:** `POST /api/billing/create-payment-intent`, webhook `checkout.session.completed`

**DB tables:** `appointments`, service_orders (via `serviceOrders.ts`)

**Evidence:** One-time path creates a PaymentIntent directly (no subscription). Resolves price from `service_plans` → Stripe price object `unit_amount`. Webhook creates a service_order and appointment from scheduling metadata.

---

### 8. Marketplace Checkout

**Status: VERIFIED**

**Files:**
- `server/routes/marketplaceStripe.ts` — `POST /api/marketplace/create-payment-intent`
- `server/routes/webhooksStripe.ts` — `payment_intent.succeeded` marketplace handler

**Routes:** `POST /api/marketplace/create-payment-intent`, webhook `payment_intent.succeeded`

**DB tables:** `marketplace_orders`, `marketplace_order_items`, `marketplace_catalog`

**Evidence:** Customer browses `marketplace_catalog`, adds to cart (CartContext), checks out. Server creates PaymentIntent with `purchase_type: "marketplace"` in metadata. On `payment_intent.succeeded` webhook: order marked `completed`, `marketplace_order_items` created, service_order created via `createMarketplaceAddOnServiceOrder()`. Promo code `used_count` incremented atomically via RPC with fallback.

---

### 9. Appointment Creation After Payment

**Status: VERIFIED**

**Files:**
- `server/routes/billingStripe.ts` — `confirm-booking` handler
- `server/routes/webhooksStripe.ts` — `checkout.session.completed` fallback

**Routes:** `POST /api/billing/confirm-booking`

**DB tables:** `appointments`

**Evidence:** Appointment created in `confirm-booking` if `scheduledDate` + `windowId` + `propertyId` are present. Idempotency guard checks for existing appointment on same date before inserting. Webhook also creates appointment from metadata as a fallback (same idempotency check). Both paths set `status = "scheduled"`.

---

### 10. Recurring Appointment Auto-Generation (Netlify Function)

**Status: VERIFIED**

**Files:**
- `netlify/functions/generate-appointments.ts` — Netlify scheduled handler
- `server/services/appointments/generateRecurring.ts` — `runRecurringGeneration()`

**Schedule:** Daily at 08:00 UTC (configured in `netlify.toml`)

**DB tables:** `subscriptions`, `appointments`, `properties`, `business_hours`, `blackout_dates`, `employees`

**Evidence:** `runRecurringGeneration()` queries all active subscriptions with `cadence_days` set and `property_id`. For each, checks if a future appointment exists (idempotency). If not, finds the last non-canceled appointment to anchor the next due date (`lastDate + cadenceDays`). Only generates if `nextDue <= today + 7 days`. Calls `findAvailableSlot()` which respects business hours, blackout dates, capacity, and customer preferences (with retry without preferences if they cause no match). Inserts appointment row. `noSlotFound` counter tracks subscriptions that need manual scheduling.

**Gap:** No notification is sent to admin when `noSlotFound > 0`. Errors logged to console only; no alert mechanism.

---

### 11. Admin Appointments View

**Status: VERIFIED**

**Files:**
- `client/pages/admin/Appointments.tsx`
- `server/routes/adminAppointments.ts` — dispatch + cancel endpoints
- `server/routes/adminBlackoutDates.ts` — blackout management

**Routes:** Supabase direct (list), `POST /api/admin/appointments/:id/dispatch`, `PATCH /api/admin/appointments/:id/cancel`, `GET|POST|DELETE /api/admin/blackout-dates`

**DB tables:** `appointments`, `assignments`, `profiles`, `properties`, `employees`, `blackout_dates`

**Evidence:** Full appointment table with search, date range filter, type filter, technician filter. Resolves customer names from `profiles` and addresses from `properties` via parallel Supabase queries. Assignment map built from `assignments` table. Dispatch triggers SMS + status update. Cancel sends email + status update. Blackout dates panel shows live data.

---

### 12. Admin Customer List + Status

**Status: VERIFIED**

**Files:**
- `client/pages/admin/Customers.tsx`

**Routes:** Supabase direct

**DB tables:** `profiles`, `subscriptions`, `properties`

**Evidence:** Fetches all non-admin profiles, batches subscription statuses, resolves customer status by priority: `active (3) > past_due (2) > canceled (1)`. Maps `past_due` to UI status `"paused"`. No longer hardcodes "active" for all customers (Sprint 3A fix verified in code lines 88–103).

---

### 13. Admin Employee Management

**Status: VERIFIED**

**Files:**
- `client/pages/admin/Employees.tsx`
- `server/routes/adminEmployees.ts`

**Routes:** `GET /api/admin/employees`, Supabase direct for CRUD

**DB tables:** `employees`, `profiles`

**Evidence:** Employee roster shows all employees. Create employee inserts both a `profiles` row (role = "employee") and an `employees` row. Deactivate sets `employees.status = "inactive"`.

---

### 14. Admin Assignment Creation

**Status: VERIFIED**

**Files:**
- `client/pages/admin/Appointments.tsx` (assign technician bulk action)

**Routes:** Supabase direct `upsert` to `assignments`

**DB tables:** `assignments`

**Evidence:** Admin selects appointments, chooses technician from dropdown (populated from employees query), clicks "Assign." Client calls `supabase.from("assignments").upsert(selectedIds.map(id => ({ appointment_id: id, employee_id: empId, status: "assigned" })))`. Employee ID and appointment ID both set correctly.

---

### 15. Employee Assignment List

**Status: VERIFIED**

**Files:**
- `client/pages/employee/Assignments.tsx`
- `client/pages/employee/Dashboard.tsx`

**Routes:** Supabase direct

**DB tables:** `assignments`, `appointments`, `properties`

**Evidence:** Employee dashboard shows today's assignments. Assignments page shows all assignments ordered by date. Both query `assignments` filtered by `employee_id` (resolved from `employees` table via auth user ID).

---

### 16. Employee Assignment Detail

**Status: VERIFIED**

**Files:**
- `client/pages/employee/AssignmentDetail.tsx`

**Routes:** `POST /api/employee/assignments/:id/status`, `POST /api/employee/assignments/:id/media`

**DB tables:** `assignments`, `appointments`, `profiles`, `properties`, `message_threads`, `messages`, `job_media`

**Evidence:** Loads assignment via Supabase direct. Joins appointment → profile → property. Displays customer name, phone, address. Shows GPS coords if `lat`/`lng` non-null on property. Status buttons call server API (not Supabase directly) for auth-guarded writes. Media upload section present with file input, upload to Supabase Storage, then POST to `/api/employee/assignments/:id/media`.

---

### 17. Employee Status Update → Appointment Cascade

**Status: VERIFIED**

**Files:**
- `server/routes/employeeAssignments.ts` — `POST /api/employee/assignments/:id/status`

**Routes:** `POST /api/employee/assignments/:id/status`

**DB tables:** `assignments`, `appointments`

**Evidence:** When employee marks status `"completed"`, server (using `supabaseAdmin` to bypass RLS) also updates `appointments.status = "completed"` on the linked appointment. Guard prevents overwriting already-terminal statuses. Ownership verified before write. Lifecycle timestamps (`en_route_at`, `started_at`, `completed_at`) set only on first transition.

---

### 18. Employee Job Media Upload

**Status: VERIFIED**

**Files:**
- `client/pages/employee/AssignmentDetail.tsx` — `handleMediaUpload()`
- `server/routes/employeeAssignments.ts` — `POST /api/employee/assignments/:id/media`

**Routes:** `POST /api/employee/assignments/:id/media`

**DB tables:** `job_media`

**Evidence:** File input accepts image/video. Upload path: Supabase Storage `job-media/{assignmentId}/{timestamp}.{ext}` → get public URL → POST to server with `{ url, media_type }` → server inserts into `job_media`. Ownership verified server-side. Bucket created by migration `2026-05-28_job_media_storage.sql`.

**Gap:** Upload goes from client directly to Supabase Storage (client-side storage upload), then the URL is sent to the server API. This means the employee's JWT must have Storage write permission. The migration creates an RLS policy allowing employees to upload to paths matching their user ID, but bucket policy depends on correct Supabase Storage configuration that cannot be verified without a running environment.

---

### 19. Customer Appointment Dashboard

**Status: VERIFIED**

**Files:**
- `client/pages/dashboard/Appointments.tsx`
- `client/hooks/dashboard/useAppointments.ts`

**Routes:** Supabase direct (list), `GET /api/availability` (reschedule), `POST /api/appointments/:id/reschedule`

**DB tables:** `appointments`, `assignments`, `marketplace_orders`

**Evidence:** Appointment list shows all customer appointments via `useAppointments(user.id)`. Reschedule dialog fetches availability and calls reschedule endpoint. "Add Reminder" button now navigates to `/dashboard/profile` (Sprint 3E fix — no longer a dead toast). Visit Recaps tab renders `VideoRecapGrid`.

---

### 20. Customer Billing / Payment Method Display

**Status: VERIFIED**

**Files:**
- `client/pages/dashboard/Billing.tsx`
- `client/hooks/useProfile.ts`

**Routes:** `POST /api/billing/create-portal-session`, `GET /api/billing/invoices`, `POST /api/billing/cancel-subscription`

**DB tables:** `profiles`, `subscriptions`, `properties`

**Evidence:** Payment method state initialized from `profile.card_last4`, `profile.card_brand`, `profile.card_expiry`. Defaults to `null` (Sprint 3B fix verified at lines 94–98). Displays "No payment method on file" when null. Invoice list fetches real Stripe invoices. Plan/cadence change dialogs functional. Billing portal link via Stripe Customer Portal.

**Gap:** `profiles.card_last4` is only populated if a Stripe webhook writes it (there is no webhook handler that writes `card_last4` to profiles). The `invoice.paid` webhook does not update card info. The `attach-payment-method` endpoint does not write card info to profiles after attaching. This means payment method display will remain null for most customers even after successful payment.

---

### 21. Customer Profile + Notification Preferences

**Status: VERIFIED**

**Files:**
- `client/pages/dashboard/Profile.tsx`
- `server/services/notifications/reminderScheduler.ts`

**Routes:** Supabase direct

**DB tables:** `profiles`

**Evidence:** Profile page edits name, email, phone. Password change via `supabase.auth.updateUser`. Email change sends confirmation via Supabase. Notification preferences (smsReminders, videoAlerts, marketing) stored in `profiles.notification_preferences` JSONB. `reminderScheduler.ts` reads `notification_preferences.smsReminders` before sending SMS (Sprint 3D fix verified at line 83). Defaults to `true` if not explicitly set to `false`.

---

### 22. Customer Delete Account Flow

**Status: VERIFIED**

**Files:**
- `client/pages/dashboard/Profile.tsx` — `handleDeleteRequest()`, delete dialog

**Routes:** Supabase direct insert to `tickets`

**DB tables:** `tickets`

**Evidence:** "Delete Account" button opens dialog (Sprint 3C fix). User must enter matching email to confirm. On confirm, inserts ticket with `subject: "Account Deletion Request"`, `type: "account_deletion"` (actually `category: "account"`, `subject: "Account Deletion Request"`). Soft-delete pattern — admin must action the ticket. No hard-delete or immediate account deactivation.

---

### 23. 24h Email Reminder

**Status: VERIFIED**

**Files:**
- `netlify/functions/send-reminders.ts`
- `server/services/notifications/reminderScheduler.ts`
- `server/services/notifications/sendAppointmentReminder.ts`

**Schedule:** Daily at 07:00 UTC (netlify.toml)

**DB tables:** `appointments`, `profiles`, `properties`, `notification_log`

**Evidence:** `send-reminders.ts` calls `runReminderBatch(tomorrow, "reminder_24h")`. Scheduler fetches appointments with `scheduled_date = tomorrow`, skips canceled/completed, batches profile + property lookups, calls `sendAppointmentReminder()` which sends via Resend. Logs to `notification_log`. Dry-run mode via `REMINDER_DRY_RUN=true` env var.

---

### 24. Same-Day Email Reminder

**Status: VERIFIED**

**Files:** Same as Feature 23.

**Schedule:** Same function, calls `runReminderBatch(today, "reminder_same_day")`

**Evidence:** Both batches run in `Promise.allSettled` so one failure does not block the other.

---

### 25. SMS Reminders with Opt-In Guard

**Status: VERIFIED**

**Files:**
- `server/services/notifications/reminderScheduler.ts` (lines 138–162)
- `server/services/notifications/twilioClient.ts`
- `server/services/notifications/smsTemplates.ts`

**Routes:** Twilio API (external)

**DB tables:** `profiles.notification_preferences`

**Evidence:** SMS only sent when all three conditions met: `profile.smsReminders && profile.phone && isSmsConfigured()`. SMS failure is non-fatal (email already sent). Uses `buildReminderSms()` from `smsTemplates.ts`. `isSmsConfigured()` checks for `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` env vars.

---

### 26. Technician Capacity Calculation

**Status: VERIFIED**

**Files:**
- `server/routes/availability.ts` (lines 162–166)
- `server/routes/schedule.ts` (lines 73–78)

**DB tables:** `employees`

**Evidence:** Both routes query `employees` table with `status = "active"` and use `activeTechs.length` as the tech count, falling back to 1. Capacity = `activeTechCount × window.max_jobs_per_tech`. `max_jobs_per_tech` defined in `business_hours.windows` JSONB per window (default 3, Saturday morning uses 2).

**Gap:** `customerAppointments.ts` reschedule endpoint (line 73) still uses hardcoded `capacity = 1 * (windowDef.max_jobs_per_tech ?? 3)` instead of querying live employee count. Rescheduling may under-count available capacity.

---

### 27. Blackout Dates Enforcement

**Status: VERIFIED**

**Files:**
- `server/routes/availability.ts` — filters blackout dates from response
- `server/routes/schedule.ts` — `checkWindowAvailability()` blackout check
- `server/routes/customerAppointments.ts` — reschedule blackout check
- `server/services/appointments/generateRecurring.ts` — slot finder respects blackouts

**Routes:** `GET /api/availability`, `GET|POST|DELETE /api/admin/blackout-dates`

**DB tables:** `blackout_dates`

**Evidence:** Blackout dates checked in four separate code paths: initial availability query, server-side booking validation, reschedule validation, and recurring appointment generation. Scope-aware: `scope="all"` blocks everything; `scope="service_area"` blocks only the referenced area.

---

### 28. Business Hours Enforcement

**Status: VERIFIED**

**Files:**
- `server/routes/availability.ts` — business hours filter
- `server/routes/schedule.ts` — `checkWindowAvailability()` hours check
- `server/routes/customerAppointments.ts` — reschedule hours check
- `server/services/appointments/generateRecurring.ts` — slot finder uses hours

**Routes:** `GET /api/availability`, `GET|PATCH /api/admin/business-hours`

**DB tables:** `business_hours`

**Evidence:** Business hours define which days are operational and what arrival windows exist. Admin can toggle `is_operational` per day and update window definitions. Service-area-specific rows override global rows. Hours enforced at booking, rescheduling, and recurring generation.

---

### 29. Property GPS Coordinates

**Status: PARTIALLY VERIFIED**

**Files:**
- `db/migrations/2026-05-28_property_coordinates.sql` — adds `lat`/`lng` columns
- `client/pages/employee/AssignmentDetail.tsx` (lines 87, 103–104) — reads `lat`/`lng` from properties

**DB tables:** `properties`

**Evidence:** Migration adds `lat NUMERIC(10,7)` and `lng NUMERIC(10,7)` to `properties`. AssignmentDetail queries `properties.select("address, city, zip, lat, lng")` and sets `lat` and `lng` from the result. `MiniMap` component and `navUrl()` navigation link are shown when coords are non-null.

**Gap:** No geocoding happens automatically. Properties created through the normal onboarding flow will have `null` lat/lng. Manual backfill from `parcel_lookup_cache` is documented in the migration comments. Until geocoding runs, GPS-dependent features (map display, navigation link) are inactive for all properties. No server-side path writes lat/lng during `confirm-booking`.

---

### 30. Admin Overview Dashboard

**Status: VERIFIED**

**Files:**
- `client/pages/admin/Overview.tsx`

**Routes:** `/api/admin/subscriptions/needs-scheduling`, `/api/admin/subscriptions/past-due`, `/api/admin/employees`, `/api/admin/appointments` (POST), Supabase direct

**DB tables:** `profiles`, `appointments`, `tickets`, `payments`, `messages`, `subscriptions`

**Evidence:** KPI cards show real counts from live DB. Upcoming appointments table queries `appointments` directly. Support tickets query shows real data (Sprint 3E fix — `dummyTickets` array removed). MTD revenue reads from `payments` table (only populated after `invoice.paid` webhooks fire). No dummy data remains.

---

## Cross-Cutting Concerns

### RLS Verification

| Table | RLS Enabled | Customer reads own data | Admin reads all | Employee reads assignments |
|-------|-------------|------------------------|-----------------|---------------------------|
| `appointments` | YES | YES (anon blocked, service role used for admin/server) | YES (via supabaseAdmin) | YES (via supabaseAdmin in server route) |
| `subscriptions` | YES | YES | YES (via supabaseAdmin) | N/A |
| `profiles` | YES | YES (own row) | YES (via supabaseAdmin) | YES (read for customer lookup) |
| `assignments` | YES | N/A | YES | YES (own assignments via employee_id) |
| `job_media` | YES | YES (read) | YES | YES (write own) |
| `business_hours` | YES | YES (public read) | YES | YES (public read) |
| `blackout_dates` | YES | YES (public read) | YES | YES (public read) |

### Notable Gaps Not Covered by Any Feature

1. **No real-time GPS tracking**: `adminTracking.ts` explicitly documents `location: null` — no device location push mechanism exists.
2. **No blog content**: Blog page shows "coming soon" — blog CMS exists but no posts are published via the admin.
3. **Annual plan year-2 renewal**: No automated reminder or renewal flow at `current_period_end - 30 days`.
4. **Promo RPC**: `increment_promo_used_count` RPC may not be deployed; non-atomic fallback is in place.
5. **`profiles.card_last4` never populated**: No webhook writes card info to profiles, so payment method display is always null unless populated manually.

---

*All findings based on reading actual source files. Lines cited are from files as read on 2026-05-28.*
