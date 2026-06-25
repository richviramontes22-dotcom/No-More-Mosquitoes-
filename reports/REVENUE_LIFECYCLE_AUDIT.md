# REVENUE LIFECYCLE AUDIT
## Generated: 2026-05-29
## Scope: Full trace of the business revenue lifecycle — lead through cancellation

---

## Stage 1: Lead (Pre-Account)

**Data Entry Point:** Visitor enters address in `QuoteWidgetSection.tsx` on the pricing/homepage. Widget calls `POST /api/parcel/quote` via `usePropertyLookup` hook.

**Tables Written:** None (zero lead data is stored). `parcel_lookup_cache` may store the anonymized parcel lookup result keyed on APN/address — but no visitor identity, email, plan selection, or timestamp is persisted per visitor session.

**Route:** `server/routes/parcelQuote.ts` — `POST /api/parcel/quote`

**Admin Page:** None. Zero admin visibility into quote activity.

**Admin Actionable:** No.

**Abandonment Risk:** 100%. Every visitor who sees pricing and does not click "Schedule Service" disappears without any record. No follow-up, no retargeting data, no address distribution intelligence.

**UTM/Referral Tracking:** None found in `QuoteWidgetSection.tsx` or the parcel quote route. No UTM parameters captured or stored.

**Waitlist:** `server/routes/waitlist.ts` — captures `email`, `name`, `phone` into `waitlist` table. This is a separate flow from the quote widget; it does not capture address or plan interest. No admin page displays the waitlist.

**Gap:**
- No `quote_leads` table
- No email capture at the quote widget
- No UTM/source tracking
- No admin visibility into quote volume or conversion funnel
- Waitlist data is collected but not visible in admin

---

## Stage 2: Account Creation

**Data Entry Point:** Visitor clicks "Schedule Service" in the quote widget → if not logged in, redirected to `/login` with `mode: signup` and address/plan preset stored in `pendingOnboarding` (localStorage via `savePendingOnboarding`). User signs up via Supabase Auth.

**Tables Written:**
- `auth.users` — Supabase Auth managed table
- `profiles` — IF a trigger exists on `auth.users INSERT` that creates the profile row. The trigger is not in application code — it must be deployed as a DB migration. BLOCKER 1 from the prior go/no-go report.

**Route:** Supabase Auth (no server route for signup itself). Pending onboarding is saved client-side in localStorage.

**Link to Prior Quote:** The quote data (address, city, state, zip, acreage, program, cadenceDays, estimatedPrice) is saved to localStorage as `pendingOnboarding`. When the user reaches the scheduling flow after login, this data is restored. This linkage is ephemeral (localStorage only) — it is NOT persisted to the database. If the user switches devices or clears browser storage, the connection is lost.

**Admin Page:** `/admin/customers` — shows new customer in the list after profile creation.

**Admin Actionable:** Can view profile. Cannot edit it.

**Abandonment Risk:** If user signs up but never completes onboarding, `profiles.is_onboarded = false`. The owner has no way to see "users who signed up but never booked."

**Gap:**
- Profile creation trigger not in app code — infrastructure risk
- No `quote_leads` → `profiles` linkage in database (quote data lives in localStorage only)
- No "signed up but not yet booked" segment visible in admin
- No source attribution on the profile row (which channel brought this customer?)

---

## Stage 3: Property Creation

**Data Entry Point:** During the scheduling flow (`ScheduleFlow.tsx` or `ScheduleDialog.tsx`), the customer enters or confirms their service address. Property is created before checkout.

**Tables Written:** `properties` — written with address, city, state, zip, acreage. `lat`/`lng` optionally written if Google Places coordinates were returned.

**Route:** Direct Supabase client call from the scheduling flow (property upsert). The `POST /api/billing/confirm-booking` endpoint updates the property row with `program`, `cadence`, and `service_preferences` after payment.

**Admin Page:** `/admin/properties` — shows all properties. No link from property row back to customer record.

**Admin Actionable:** Can add properties manually. No delete. No edit from admin.

**Abandonment Risk:** If customer creates a property but abandons checkout, the property row exists but has no subscription or appointment. Admin cannot easily identify "properties with no service history."

**Gap:**
- No orphan property cleanup or detection
- No admin link from property to customer
- Properties with no subscription are not flagged in admin

---

## Stage 4: Subscription Checkout (Recurring Plans)

**Data Entry Point:** Customer selects recurring plan (14/21/30/42-day cadence) in `ScheduleFlow.tsx`, enters payment via Stripe PaymentElement → `POST /api/billing/create-payment-intent` → Stripe creates subscription with `payment_behavior: default_incomplete` → client calls `stripe.confirmPayment()` → on success, client calls `POST /api/billing/confirm-booking`.

**Tables Written (from `confirm-booking`):**
- `subscriptions` — upserted with `stripe_subscription_id`, `user_id`, `property_id`, `status: "active"`, `cadence_days`, `program: "subscription"`
- `appointments` — first appointment inserted with `status: "scheduled"`, `scheduled_date`, `window`, `window_label`, `scheduled_at`
- `properties` — updated with `program`, `cadence`, `service_preferences`
- `profiles` — updated with `is_onboarded: true`, `onboarding_progress: null`

**Tables Written (from `invoice.paid` webhook — async fallback):**
- `subscriptions` — upserted again with `current_period_end`, `last_payment_at`, `last_invoice_id`
- `payments` — inserted with `amount_cents`, `stripe_payment_intent_id`
- `service_orders` — created via `createSubscriptionServiceOrder()`
- `profiles` — `card_last4`, `card_brand`, `card_expiry` synced from payment method

**Tables Written (from `checkout.session.completed` webhook — separate path if Checkout redirect was used):**
- `subscriptions` — upserted
- `appointments` — first appointment created if scheduling metadata present
- `properties` — `program`, `cadence` updated
- `service_orders` — NOT created here for subscriptions (comment: "created on invoice.paid")

**Stripe Objects Created:** Stripe Subscription (with `default_incomplete` → active after invoice payment), Stripe Invoice, Stripe PaymentIntent.

**Admin Page:** Appointment appears in `/admin/appointments`. Customer appears with subscription context badge in `/admin/customers`. No dedicated subscriptions page (Gap 3 from prior audit).

**Admin Actionable:** Can assign technician. Cannot cancel/pause subscription from admin.

**Abandonment Risk (mid-checkout):** If customer reaches Stripe but closes the browser, the Stripe subscription remains in `incomplete` state. The `confirm-booking` route is never called. The `invoice.paid` webhook will fire if Stripe eventually charges, creating the subscription row, but NO appointment is created from the webhook unless scheduling metadata was in the Stripe subscription metadata fields (it is — if the checkout path includes it). For the PaymentElement path, appointment creation relies on `confirm-booking` being called by the client; if the client fails after payment but before `confirm-booking`, the subscription is active in Stripe but there is no appointment and `is_onboarded` is still false.

**Gap:**
- Critical: If `confirm-booking` is not called (client crash after Stripe payment), subscription row may be missing or incomplete, and no appointment is created.
- The `invoice.paid` webhook partially covers this by upserting the subscription, but it does NOT create an appointment (appointment creation in the webhook only happens in `checkout.session.completed`, not `invoice.paid`).
- `current_period_end` is NOT written in `confirm-booking` for subscription plans — it is only written by the `invoice.paid` webhook. This means there is a window where the subscription row exists with no `current_period_end`.

---

## Stage 5: Annual Plan

**Data Entry Point:** Customer selects "Annual" plan in scheduling flow → `POST /api/billing/create-payment-intent` with `program === "annual"` → creates a one-time Stripe PaymentIntent (no Stripe Subscription object) → client calls `stripe.confirmPayment()` → `POST /api/billing/confirm-booking`.

**Tables Written (from `confirm-booking`):**
- `subscriptions` — upserted with `stripe_subscription_id = paymentIntentId` (PI id, not subscription id), `status: "active"`, `program: "annual"`, `current_period_end = now + 365 days`, `last_payment_at = now`
- `appointments` — first appointment inserted (same as subscription path)
- `properties` — updated with program, cadence
- `profiles` — `is_onboarded: true`

**Tables Written (from `payment_intent.succeeded` webhook — async fallback):**
- `subscriptions` — upserted again with same data (idempotent via `stripe_subscription_id = pi.id`)

**`current_period_end` status:** WRITTEN in `confirm-booking` for annual plans. The prior sprint fix is confirmed. Annual subscriptions have `current_period_end = now + 1 year`.

**Stripe Objects:** Only a PaymentIntent (no Stripe Subscription). Renewals are manual — no Stripe recurring billing.

**Admin Visibility:** Visible in appointments list. No admin subscriptions page to see annual expiry dates. The `current_period_end` field exists in the database but is not surfaced in any admin UI.

**Gap:**
- No admin alert when annual plan expiry is approaching (e.g., 30/60/90 days before `current_period_end`)
- No automated renewal reminder email to customer
- Annual plans are identified in `subscriptions` table by `program = "annual"` but not visible in a dedicated admin list
- `customer.subscription.deleted` webhook does not apply to annual plans (no Stripe Subscription to delete)

---

## Stage 6: One-Time Booking

**Data Entry Point:** Customer selects "One-Time Treatment" → Stripe PaymentIntent for the one-time amount → `confirm-booking` with `program === "one_time"`.

**Tables Written (from `confirm-booking`):**
- `appointments` — first appointment inserted
- `properties` — updated with `program: "one_time"`
- `profiles` — `is_onboarded: true`
- No `subscriptions` row is created for one-time bookings

**Tables Written (from `checkout.session.completed` webhook for hosted checkout path):**
- `service_orders` — created via `createOneTimeServiceOrder()`
- `appointments` — if scheduling metadata present

**Recurring Generation:** None. One-time customers have no subscription and will not appear in the "needs-scheduling" queue after their single appointment. If they want another treatment, they must re-book.

**Admin Visibility:** Appointment appears in `/admin/appointments`. No subscription record.

**Gap:**
- No reactivation path shown to one-time customers after appointment completes
- One-time customers are invisible in subscription metrics
- `service_orders` may not be created if the PaymentElement path is used (the `invoice.paid` webhook only fires for subscription invoices; one-time PIs fire `payment_intent.succeeded` which handles marketplace but not standard one-time booking service_order creation unless `createOneTimeServiceOrder` is called from the checkout webhook)

---

## Stage 7: Payment

**Data Entry Point:** Stripe webhook → `POST /api/webhooks/stripe`

**Events Handled in `webhooksStripe.ts`:**

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Creates marketplace orders, subscription rows, first appointments |
| `invoice.paid` | Writes `payments` row, upserts subscription with `current_period_end`, creates `service_orders`, syncs card details to profile |
| `invoice.payment_failed` | Updates `subscriptions.status = "past_due"` |
| `customer.subscription.updated` | Syncs non-active status changes (cancellation states) |
| `customer.subscription.deleted` | Sets `subscriptions.status = "canceled"` |
| `payment_intent.succeeded` | Annual plan subscription upsert, marketplace order completion, promo code increment |
| `payment_intent.payment_failed` | Marks marketplace orders as "failed" |
| `checkout.session.expired` | Marks pending marketplace orders as "expired" |
| `charge.refunded` | Updates marketplace orders and payments to "refunded", marks service_orders refunded |

**`payments` Table:** Exists. Written on `invoice.paid` for subscription renewals. For one-time payments via PaymentElement, `payments` rows are only written if the `invoice.paid` event fires (which requires a Stripe invoice — one-time PaymentIntents do not automatically generate invoices). There is a potential gap where `payments` is not written for one-time bookings if they use the PaymentElement path instead of Checkout redirect.

**`invoice.payment_failed` handling:**
- Sets `subscriptions.status = "past_due"`
- Logs a console warning
- Does NOT send a customer notification email
- Does NOT send an admin alert
- Stripe's own dunning emails will fire if configured in the Stripe Dashboard

**Gap:**
- No customer-facing payment failure notification from the application (relies on Stripe dunning configuration)
- No admin notification on payment failure (visible only through past-due alert on Overview page, which checks the `subscriptions.status` field)
- `payments` table may not capture one-time PaymentIntent payments (no invoice generated)

---

## Stage 8: Appointment

**Data Entry Points (two paths):**
1. `POST /api/billing/confirm-booking` — client-initiated after Stripe payment succeeds
2. `checkout.session.completed` webhook — backup, fires for Checkout redirect path
3. `POST /api/admin/appointments` — admin manually creates from Overview or Appointments page

**Initial Status:** `status: "scheduled"` in all cases.

**Tables Written:** `appointments` with `user_id`, `property_id`, `status`, `service_type`, `scheduled_date`, `window`, `window_label`, `scheduled_at`, optional `notes`.

**Admin Visibility:** Fully visible in `/admin/appointments` with filters, bulk assign, dispatch, reschedule, and cancel.

**Gap:**
- No `subscription_id` foreign key on `appointments` — appointments are not formally linked to the subscription that generated them. Orphan detection and renewal tracking is harder.
- `window` column stores a window ID (e.g., "morning") but no FK constraint to `business_hours.windows`.
- Appointment has no `cadence_days` column — you cannot determine the expected next appointment date from the appointment row alone.

---

## Stage 9: Renewal

**For Recurring Subscriptions:** Stripe fires `invoice.paid` on each billing cycle. The webhook handler in `webhooksStripe.ts`:
1. Writes a new `payments` row
2. Upserts `subscriptions` with new `current_period_end`, `last_payment_at`, `last_invoice_id`
3. Creates a new `service_orders` row via `createSubscriptionServiceOrder()`
4. Syncs card details to `profiles`

**Renewal appointment generation:** NOT automatic. The next appointment must be created manually by admin from the Scheduling Queue, or by a scheduled function (if deployed). The admin Overview shows subscriptions with no upcoming appointment via `GET /api/admin/subscriptions/needs-scheduling`.

**For Annual Plans:** No Stripe renewal. Owner must manually notice when `current_period_end` approaches and reach out to customer. No alert, no automation.

**Admin Visibility of Renewal Dates:** `current_period_end` exists in `subscriptions` table but no admin page surfaces it in a sortable/filterable list. The past-due alert on Overview shows `current_period_end` only for past-due subscriptions.

**Gap:**
- No automated next-appointment creation on renewal
- No admin alert "X customers due for renewal in 30 days"
- Annual plan renewal is entirely manual with no system support

---

## Stage 10: Failed Payment

**Data Entry Point:** Stripe fires `invoice.payment_failed`.

**Current Behavior:**
- `subscriptions.status` updated to `"past_due"` in Supabase
- Console warning logged
- Past-due count appears in Admin Overview "Past-due subscriptions" KPI
- Past-due list on Overview shows customer name and period end date

**What Is Missing:**
- No customer notification email from the application (must rely on Stripe's dunning email configuration)
- No automated retry logic in the application (Stripe handles retry schedule)
- No admin email/SMS alert for failed payment
- Customer cannot "retry payment" from the customer dashboard — they must update payment method and wait for Stripe dunning, or go through the Stripe Customer Portal

**Customer Self-Service:** Customer can access the Stripe Customer Portal via `POST /api/billing/create-portal-session` (requires an active subscription — but `requireActiveSubscription` checks for `status = "active"`, which would fail if status is `past_due`). This is a potential lock-out: a past-due customer cannot access the billing portal to update their payment method.

**Gap — Critical:**
- `requireActiveSubscription()` in `billingStripe.ts` checks for `status = "active"`. A customer with `status = "past_due"` would be blocked from accessing the billing portal to update their payment method, creating a deadlock.
- No payment failure notification from the application
- No admin notification on failure

---

## Stage 11: Cancellation

**Customer-Initiated Cancellation:**
- Customer calls `POST /api/billing/cancel-subscription` → finds active Stripe subscription for property → calls `DELETE /subscriptions/{id}` with `invoice_now: false` → Stripe cancels at period end → updates `profiles.subscription_metadata` with `property_{id}_cancelled_at` timestamp
- Does NOT update `subscriptions.status` in Supabase immediately — relies on `customer.subscription.deleted` webhook to cascade
- The `customer.subscription.deleted` webhook IS handled: sets `subscriptions.status = "canceled"`

**Admin-Initiated Cancellation:**
- No admin route to cancel a subscription. Must be done in Stripe dashboard. Gap 14 from prior audit.

**Cascade to Appointments:**
- Neither the cancel route nor the `customer.subscription.deleted` webhook updates any `appointments` rows
- Open appointments for the canceled subscription remain in `status = "scheduled"`
- Technicians may be dispatched to jobs for canceled customers

**Cascade to Assignments:**
- Neither the cancel route nor the webhook updates `assignments` rows
- Technicians assigned to future appointments for canceled customers will still see those assignments

**Admin Notified:** No. Cancellation appears only when admin next views the subscriptions export or customer record.

**Gap:**
- No cascade from cancellation to open appointments
- No cascade from cancellation to active assignments
- Admin receives no cancellation notification
- Stripe Billing Portal configuration must be correct or customer cannot self-cancel via portal

---

## Stage 12: Reactivation / Winback

**Reactivation Flow:** None exists. A canceled customer who wants to return must:
1. Navigate to the pricing page
2. Get a new quote
3. Go through the full scheduling flow
4. Purchase a new subscription

There is no "reactivate" button in the customer dashboard. There is no "welcome back" flow. The prior subscription row in `subscriptions` will be updated to `"canceled"` status; a new subscription creates a new row.

**Win-back Automation:** None. No automated email to customers who canceled. No re-engagement sequence. The `waitlist` table could serve this purpose but is not connected to canceled customers.

**Admin Winback Tools:** None visible in admin dashboard.

**Gap:**
- No reactivation UX shortcut
- No winback email automation
- No admin winback workflow or at-risk customer list

---

## Summary Table

| Stage | Data Entry Point | Tables Written | Route | Admin Page | Admin Actionable | Abandonment Risk | Gap Severity |
|-------|-----------------|----------------|-------|-----------|-----------------|-----------------|-------------|
| 1. Lead | Quote widget address entry | None | `POST /api/parcel/quote` | None | No | 100% — no recovery | Critical |
| 2. Account Creation | Supabase Auth signup | `auth.users`, `profiles` (if trigger deployed) | Supabase Auth | `/admin/customers` | View only | Medium — orphan accounts | High |
| 3. Property Creation | Scheduling flow | `properties` | Direct Supabase | `/admin/properties` | Add only | Low — orphan properties | Medium |
| 4. Subscription Checkout | ScheduleFlow + Stripe | `subscriptions`, `appointments`, `properties`, `profiles` | `confirm-booking`, webhooks | `/admin/appointments` | Assign/dispatch | High — confirm-booking not called | High |
| 5. Annual Plan | ScheduleFlow + Stripe PI | `subscriptions`, `appointments`, `properties`, `profiles` | `confirm-booking`, `payment_intent.succeeded` | `/admin/appointments` | Assign/dispatch | Medium | Medium |
| 6. One-Time | ScheduleFlow + Stripe PI | `appointments`, `properties`, `profiles` | `confirm-booking`, `checkout.session.completed` | `/admin/appointments` | Assign/dispatch | Low | Low |
| 7. Payment | Stripe webhooks | `payments`, `subscriptions`, `service_orders`, `profiles` | `POST /api/webhooks/stripe` | `/admin/billing` | View only | Medium — webhook delivery | Medium |
| 8. Appointment | `confirm-booking` + webhook + admin manual | `appointments` | Multiple | `/admin/appointments` | Full CRUD | Low | Low |
| 9. Renewal | `invoice.paid` webhook | `payments`, `subscriptions`, `service_orders` | webhook | `/admin/billing` | View only | High — manual next appt | High |
| 10. Failed Payment | `invoice.payment_failed` webhook | `subscriptions` (status=past_due) | webhook | `/admin` (KPI only) | None | Critical — portal lockout | Critical |
| 11. Cancellation | Customer portal / Stripe webhook | `subscriptions` (status=canceled) | `cancel-subscription` + webhook | None | None | Critical — orphan assignments | Critical |
| 12. Reactivation | Full re-purchase | New rows | Full flow | None | None | 100% — no recovery flow | High |
