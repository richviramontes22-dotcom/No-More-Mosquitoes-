# LIFECYCLE INTEGRATION REPORT
## No More Mosquitoes — End-to-End Workflow Trace
## Date: 2026-05-28
## Methodology: File-by-file handoff trace, no assumptions

---

## Workflow A: Customer Subscription Lifecycle

**Path:** Account creation → property → quote → subscription checkout → Stripe payment → appointment created → recurring appointments generated → reminders sent → appointment completed

### Step 1: Account Creation

**File:** Supabase Auth (external) + `client/pages/Login.tsx` / `client/pages/Onboarding.tsx`

**Handoff:** Auth creates a Supabase user. Supabase trigger (or `confirm-booking`) writes a row to `profiles`. `is_onboarded` is initially `false`.

**Gap:** The `profiles` row creation depends on a Supabase `auth.users` trigger. This trigger is not visible in the migration files reviewed. If the trigger is missing, `profiles` may not exist when billing routes try to look up `stripe_customer_id`.

---

### Step 2: Property Creation

**File:** `client/components/schedule/ScheduleFlow.tsx` → `AddPropertyDialog.tsx`

- ScheduleFlow prompts customer to add a property (address, city, zip).
- Calls `POST /api/parcel` (regrid.ts) to resolve acreage.
- Writes property row to `properties` table via Supabase direct.
- `acreage` stored on the property; later used by price lookup.

**Handoff to next step:** `propertyId` passed to checkout.

---

### Step 3: Quote and Checkout

**File:** `client/components/schedule/ScheduleFlow.tsx` → `server/routes/billingStripe.ts`

- Customer selects plan (cadenceDays), preferred days/windows, flexibility, scheduled date + window.
- ScheduleFlow calls `GET /api/availability?date_from=...&days=45` to populate calendar.
- Availability route returns days + windows with `available`, `remaining`, `capacity`.
- Customer picks date + window, submits PaymentElement.
- Frontend calls `POST /api/billing/create-payment-intent` with `propertyId`, `acreage`, `cadenceDays`, `program`, scheduling metadata.
- Server resolves price via `findStripePriceAsync()` (DB first, then `STRIPE_PLANS` array fallback).
- Stripe Subscription created with `default_incomplete`. Invoice PI client_secret returned.
- **Handoff:** clientSecret → Stripe PaymentElement mounts and collects payment.

---

### Step 4: Payment + Appointment Creation

**File:** `client/components/schedule/PaymentStep.tsx` → `server/routes/billingStripe.ts` `confirm-booking`

- `stripe.confirmPayment()` called client-side.
- On success, frontend calls `POST /api/billing/confirm-booking` with `paymentIntentId`, `subscriptionId`, and all scheduling metadata.
- Server calls `GET /payment_intents/{id}` on Stripe to verify `status === "succeeded"`.
- If status is not `"succeeded"`, returns 402. **Payment is server-verified before any DB write.**
- Subscription row upserted to `subscriptions` table.
- Appointment inserted into `appointments` table (idempotent guard checks existing).
- `properties.service_preferences` updated with preferred days/windows/flexibility.
- `profiles.is_onboarded = true`, `onboarding_progress = null`.

**Parallel:** Webhook `invoice.paid` fires when Stripe bills the first invoice. Writes to `payments` table, upserts subscription status, marks `is_onboarded = true`. Service_order created.

**Handoff:** Appointment exists in `appointments` with `status = "scheduled"`.

---

### Step 5: Recurring Appointment Generation

**File:** `netlify/functions/generate-appointments.ts` → `server/services/appointments/generateRecurring.ts`

- Netlify cron fires at 08:00 UTC daily.
- `runRecurringGeneration()` queries all active subscriptions.
- For each subscription, checks if a future appointment exists (idempotency).
- Anchors next due date from last non-canceled appointment + `cadenceDays`.
- If `nextDue <= today + 7 days`, calls `findAvailableSlot()`.
- Slot finder respects business hours, blackouts, capacity, customer preferences (with preference-free retry).
- Inserts appointment row.

**Handoff:** Appointment created with `status = "scheduled"`.

**Gap:** If `noSlotFound`, error logged to console only. No admin notification mechanism.

---

### Step 6: Reminders Sent

**File:** `netlify/functions/send-reminders.ts` → `server/services/notifications/reminderScheduler.ts`

- Netlify cron fires at 07:00 UTC daily.
- `runReminderBatch(tomorrow, "reminder_24h")` — email to all non-canceled appointments for tomorrow.
- `runReminderBatch(today, "reminder_same_day")` — email for today's appointments.
- Optional SMS if `smsReminders === true` and `phone` non-null and Twilio configured.
- All results logged to `notification_log`.

---

### Step 7: Appointment Completed

**File:** `client/pages/employee/AssignmentDetail.tsx` → `server/routes/employeeAssignments.ts`

- Admin assigns technician (Appointments page → bulk assign → upsert to `assignments`).
- Technician marks `en_route` → admin can dispatch (sends SMS to customer).
- Technician marks `in_progress` → `started_at` recorded.
- Technician marks `completed` → `completed_at` recorded + server cascades `appointments.status = "completed"`.

**Handoff complete.** Customer's appointment dashboard now shows appointment as "completed."

**Missing link:** After completion, no automatic "recap available" notification is sent to the customer. Customer must check dashboard manually.

---

## Workflow B: Admin Operations Lifecycle

**Path:** Admin views appointment → assigns employee → employee receives assignment → employee completes → appointment marked complete → customer sees recap

### Step 1: Admin Views Appointment

**File:** `client/pages/admin/Appointments.tsx`

- Queries `appointments` + joins `profiles` (customers), `properties`, `assignments` in parallel.
- Shows full table with search, date range, type, and technician filters.
- `StatusBadge` component renders status visually.

### Step 2: Admin Assigns Technician

**File:** `client/pages/admin/Appointments.tsx` — bulk assign action

- Admin selects appointments (checkbox), picks technician from dropdown (populated from `employees` query).
- Client calls `supabase.from("assignments").upsert([{ appointment_id, employee_id, status: "assigned" }])`.
- Assignment record written. Employee can now see this in their portal.

**Handoff:** `assignments` row created with `status = "assigned"`.

### Step 3: Employee Receives Assignment

**File:** `client/pages/employee/Dashboard.tsx`, `client/pages/employee/Assignments.tsx`

- Employee dashboard queries `assignments` filtered by `employee_id` (resolved from `employees.user_id`).
- Shows today's assignments with customer name, address, scheduled time.
- Assignment detail accessible at `/employee/assignments/:id`.

### Step 4: Employee Completes Job

**File:** `client/pages/employee/AssignmentDetail.tsx` → `server/routes/employeeAssignments.ts`

- Status buttons: `en_route` → `in_progress` → `completed`.
- Each status POST to `/api/employee/assignments/:id/status`.
- Server validates employee ownership before writing.
- On `completed`: `assignments.completed_at` set + `appointments.status = "completed"` cascaded.

### Step 5: Customer Sees Recap

**File:** `client/components/dashboard/VideoRecapGrid.tsx`

- `VideoRecapGrid` queries `appointments → assignments → job_media` (videos only) for the customer.
- Videos shown as external links (no in-app player).
- Videos must be uploaded via employee portal (`handleMediaUpload`) or admin tooling.

**Critical gap:** If employee did not upload any media, the recap is empty. No indication to customer whether media is pending or simply wasn't captured.

---

## Workflow C: Customer Billing Lifecycle

**Path:** Customer views billing → sees payment method → adds/updates payment method → payment processed → billing history updated

### Step 1: Customer Views Billing

**File:** `client/pages/dashboard/Billing.tsx`

- Loads `properties` (subscription info) and `profile` (payment method).
- Payment method shown from `profile.card_last4 / card_brand / card_expiry`.

**Critical gap:** `profiles.card_last4` is never populated by any server code. No webhook writes it. No endpoint writes it after `attach-payment-method`. Payment method display will show "No payment method on file" for all customers, including those who have paid.

### Step 2: Customer Adds/Updates Payment Method

**File:** `client/components/dashboard/billing/PaymentMethodDialog.tsx` → `server/routes/billingStripe.ts`

- `PaymentMethodDialog` uses a Stripe `PaymentElement` to collect a new card.
- On success, calls `POST /api/billing/attach-payment-method` with `paymentMethodId`.
- Server attaches PM to Stripe customer and sets as `invoice_settings.default_payment_method`.
- Server does NOT write card info back to `profiles`. **Payment method display remains stale.**

### Step 3: Payment Processed (Renewal)

**File:** `server/routes/webhooksStripe.ts` — `invoice.paid`

- Stripe charges the stored payment method on renewal.
- Webhook writes to `payments` table, updates `subscriptions.current_period_end`.
- `profiles` not updated with new card info here either.

### Step 4: Billing History

**File:** `client/pages/dashboard/Billing.tsx` — invoice list section

- Calls `GET /api/billing/invoices` → real Stripe invoices for the customer.
- Shows invoice number, date, amount, PDF link. **This works correctly.**

---

## Workflow D: Annual Plan Lifecycle

**Path:** Customer selects annual plan → pays one-time → `subscriptions` row written → appointments generated → year-end renewal path

### Step 1: Annual Checkout

**File:** `server/routes/billingStripe.ts` — annual branch in `create-payment-intent`

- `program === "annual"` detected.
- `lookupAnnualCents(acreage)` looks up price from `ANNUAL_TIERS_SERVER` hardcoded array.
- Creates PaymentIntent (not Subscription). Returns `clientSecret`.

### Step 2: Subscription Row Written

**File:** `server/routes/billingStripe.ts` — `confirm-booking`

- `confirm-booking` detects `program === "annual"`.
- Upserts `subscriptions` row: `stripe_subscription_id = paymentIntentId`, `program = "annual"`, `status = "active"`, `current_period_end = now + 365 days`.
- Webhook `payment_intent.succeeded` also writes this as fallback.

### Step 3: First Appointment Created

**File:** `server/routes/billingStripe.ts` — `confirm-booking`

- Same appointment creation logic as subscription path.
- Appointment written from scheduling metadata.

### Step 4: Recurring Appointments

**File:** `server/services/appointments/generateRecurring.ts`

- Annual subscription row has `cadence_days` (treatment interval, not 365).
- `program` on the `properties` row is `"annual"` → `generateRecurring.ts` skips these (line 89: `if (program === "one_time" || program === "annual") continue`).
- **Annual customers do NOT get recurring appointments auto-generated.** They receive only the one appointment created at checkout.

**Critical gap:** Annual customers need individual treatment appointments throughout the year (e.g., every 21 days), but `generateRecurring.ts` explicitly skips `program === "annual"` subscriptions. This means only the first appointment is ever created automatically. All subsequent treatments must be manually scheduled by admin.

### Step 5: Year-End Renewal

**File:** None.

- `current_period_end` is stored in `subscriptions`.
- No cron job, no webhook, and no notification fires near `current_period_end`.
- Admin must manually query for expiring annual plans and contact customers.

---

## Workflow E: Marketplace Lifecycle

**Path:** Customer browses marketplace → adds to cart → checks out → order created → admin sees order

### Step 1: Browse Marketplace

**File:** `client/pages/dashboard/Marketplace.tsx`, `client/hooks/dashboard/useCatalogItems.ts`

- Catalog loaded from `marketplace_catalog` table via Supabase.
- Cart managed by `CartContext` (in-memory, localStorage-backed).

### Step 2: Checkout

**File:** `server/routes/marketplaceStripe.ts` — `POST /api/marketplace/create-payment-intent`

- Creates PaymentIntent with `purchase_type: "marketplace"` metadata.
- Pre-creates `marketplace_orders` row with `status = "pending"`.
- Returns `clientSecret` for Stripe PaymentElement.

### Step 3: Order Created

**File:** `server/routes/webhooksStripe.ts` — `payment_intent.succeeded`

- Webhook fires on successful payment.
- Finds the pre-created order by `stripe_payment_intent_id`.
- Updates order to `status = "completed"`.
- Fetches order items from `marketplace_order_items`.
- Creates service_order via `createMarketplaceAddOnServiceOrder()`.
- Increments promo `used_count` (atomic RPC or fallback).

### Step 4: Admin Sees Order

**File:** `client/pages/admin/Billing.tsx`, `server/routes/adminMarketplace.ts`

- Admin billing page queries `marketplace_orders` with customer and property joins.
- Admin can update `fulfillment_status` (pending → processing → scheduled → fulfilled → cancelled).
- Full order detail with line items available at `GET /api/admin/marketplace/orders/:id`.

**Handoff complete.** All steps verified.

---

## Workflow F: Notification Lifecycle

**Path:** Appointment scheduled → 24h reminder → same-day reminder → employee assigned → en-route SMS → appointment completed

### Step 1: Appointment Scheduled

**File:** `server/routes/billingStripe.ts` — `confirm-booking` or `server/routes/schedule.ts`

- `sendAppointmentConfirmation()` called fire-and-forget on appointment creation.
- Sends confirmation email via Resend.
- Logged to `notification_log`.

### Step 2: 24h Reminder

**File:** `netlify/functions/send-reminders.ts` → `reminderScheduler.ts`

- Netlify cron at 07:00 UTC queries appointments for tomorrow.
- Email sent via `sendAppointmentReminder()`.
- SMS conditionally sent if opted-in and Twilio configured.

### Step 3: Same-Day Reminder

**File:** Same function, `runReminderBatch(today, "reminder_same_day")`

- Runs in same cron invocation as 24h reminder.
- Same email + conditional SMS.

### Step 4: Employee Assigned

**File:** `client/pages/admin/Appointments.tsx`

- Admin bulk-assigns technician.
- No automatic notification to employee on assignment.

**Gap:** Employee has no push notification, email, or SMS when assigned to a new job. Employee must check the portal manually.

### Step 5: En-Route SMS to Customer

**File:** `server/routes/adminAppointments.ts` — `POST /api/admin/appointments/:id/dispatch`

- Admin clicks "Dispatch" in the admin portal.
- Server updates appointment status to `en_route`.
- Calls `sendEnRouteSMS()` with customer phone and appointment details.
- SMS sends via Twilio if configured and phone on file.

**Gap:** If customer has no phone number, SMS is skipped (not an error). Admin sees `smsSent: false, skipReason: "Customer has no phone number on file"`.

### Step 6: Appointment Completed

**File:** `server/routes/employeeAssignments.ts`

- Employee marks `completed`.
- Cascades to `appointments.status = "completed"`.
- No notification to customer that job is done.

**Gap:** No "job completed" notification to customer after completion. Customer only learns when checking dashboard.

---

## Cross-Workflow Broken Links Summary

| Link | Workflow | Severity |
|------|----------|----------|
| `profiles.card_last4` never written by any code path | C (Billing) | High |
| Annual customers get 0 recurring appointments (generateRecurring skips `annual`) | D | Critical |
| No employee notification on assignment | F | Medium |
| No customer notification on job completion | B, F | Medium |
| No admin alert when `noSlotFound > 0` in recurring generation | A | Medium |
| GPS coords always null until manual geocoding backfill | B | Low |
| Pre-service checklist not persisted | B | Low |
| Year-2 annual renewal has no trigger | D | High |
