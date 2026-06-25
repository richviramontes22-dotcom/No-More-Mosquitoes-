# LIFECYCLE OWNERSHIP AUDIT
## Generated: 2026-05-29
## Scope: For each lifecycle, which system owns each stage and who moves between stages

---

## 1. Customer Lifecycle

| Stage | Owned By | Table | Route | Who Triggers | Ambiguity |
|-------|----------|-------|-------|-------------|-----------|
| Lead (pre-account) | **No system** | None (`parcel_lookup_cache` is anonymous) | `POST /api/parcel/quote` | Visitor action | 100% gap — no ownership |
| Account creation | Supabase Auth | `auth.users` | Supabase Auth client (no server route) | Customer (self-signup) | Profile trigger may not exist |
| Profile creation | DB trigger (unconfirmed) or manual | `public.profiles` | DB trigger on `auth.users` INSERT | Automatic (if trigger deployed) | BLOCKER — trigger deployment not confirmed |
| Property creation | Customer | `public.properties` | Direct Supabase client call from scheduling flow | Customer action | Three routes also overwrite `program`/`cadence` |
| Quote | No system | None | `POST /api/parcel/quote` | Customer action | Quote data ephemeral — localStorage only |
| Checkout initiated | Customer | None (Stripe) | `POST /api/billing/create-payment-intent` | Customer | Stripe creates PI/subscription |
| Payment confirmed | **Stripe (authoritative)** | `subscriptions`, `appointments`, `properties`, `profiles` | `POST /api/billing/confirm-booking` (sync) + `invoice.paid` webhook (async) | Stripe → customer confirmation | Two writers with overlapping responsibilities |
| First appointment | Customer + System | `appointments` | `billingStripe.ts` `confirm-booking` AND `webhooksStripe.ts` `checkout.session.completed` | Payment confirmation | Race condition — idempotency guard protects but two systems claim ownership |
| Recurring appointments | Admin (manual queue) | `appointments` | Admin creates from scheduling queue | Admin action (no automation confirmed) | Manual dependency — fragile at scale |
| Subscription renewal | Stripe | `subscriptions`, `payments`, `service_orders` | `webhooksStripe.ts` `invoice.paid` | Stripe billing cycle | Admin must manually create next appointment |
| Cancellation | Customer (Stripe portal) or Admin (Stripe dashboard) | `subscriptions` | Stripe → `customer.subscription.deleted` webhook | Stripe | Admin cannot cancel from admin UI |
| Reactivation | None exists | — | — | — | No reactivation flow |

**Ownership Ambiguities:**
1. First appointment creation is claimed by both `confirm-booking` and the webhook. The idempotency check protects against duplicates but means no single system is definitively responsible.
2. Payment confirmation requires both client calling `confirm-booking` AND webhook `invoice.paid` to be fully functional. If either fails, the customer lifecycle is incomplete.
3. Subscription cancellation is owned by Stripe, but the cascade to appointments and assignments is owned by the application — and is currently missing.

---

## 2. Employee Lifecycle

| Stage | Owned By | Table | Route | Who Triggers |
|-------|----------|-------|-------|-------------|
| Hired/Created | Admin | `employees` | Admin employees management route | Admin action |
| Activation | Admin | `employees.status = 'active'` | Admin PATCH route | Admin action |
| Assignment received | Admin | `assignments` | `POST /api/admin/assignments` | Admin assignment action |
| Assignment notified | System | `notification_log` | `adminAppointments.ts` (email sent) | Automatic on assignment |
| Assignment viewed | Employee | (read-only) | `GET /api/employee/assignments` | Employee portal load |
| En route | Employee | `assignments.status = 'en_route'`, `en_route_at` | `POST /api/employee/assignments/:id/status` | Employee self-report |
| Arrived | Employee | `assignments.arrived_at`, `status = 'in_progress'` | `POST /api/employee/assignments/:id/arrive` | Employee self-report |
| Job started | Employee | `assignments.started_at` | via arrive route | Employee action |
| Job completed | Employee | `assignments.status = 'completed'`, `completed_at` | `POST /api/employee/assignments/:id/status` | Employee self-report |
| Media uploaded | Employee | `job_media` | `POST /api/employee/assignments/:id/media` | Employee action |
| Deactivation | Admin | `employees.status = 'inactive'` | Admin PATCH route | Admin action |
| Termination | Admin | `employees.status = 'inactive'` (no distinct terminated state) | Admin PATCH route | Admin action |

**Ownership Ambiguities:**
1. The `en_route` status can be set by both the admin (dispatch route) and the employee (status update route). When admin dispatches, an SMS is sent to customer. When employee self-reports `en_route`, no SMS is sent. Two paths to the same state with different side effects.
2. No concept of employee availability — the system cannot tell if an employee is on vacation vs. working vs. terminated.

---

## 3. Appointment Lifecycle

| Stage | Owned By | Table | Route | Who Triggers |
|-------|----------|-------|-------|-------------|
| Created | Customer/System/Admin | `appointments.status = 'scheduled'` | `confirm-booking`, `checkout.session.completed`, or admin create | Payment confirmation or admin |
| Assigned to technician | Admin | `assignments.status = 'scheduled'` | `POST /api/admin/assignments` | Admin |
| Dispatched | Admin | `appointments.status = 'en_route'`, `assignments.status = 'en_route'` | `POST /api/admin/appointments/:id/dispatch` | Admin |
| Technician self-reports en_route | Employee | `assignments.status = 'en_route'` only | `POST /api/employee/assignments/:id/status` | Employee |
| Technician arrives | Employee | `assignments.arrived_at`, `assignments.status = 'in_progress'` | `POST /api/employee/assignments/:id/arrive` | Employee |
| Job in progress | Employee | `assignments.status = 'in_progress'` | Status route or arrive route | Employee |
| Job completed | Employee → cascades to appointment | `assignments.status = 'completed'` → `appointments.status = 'completed'` | `POST /api/employee/assignments/:id/status` | Employee (cascades automatically) |
| Customer notified | System | `notification_log` | `employeeAssignments.ts` completion handler | Automatic on completion |
| Rescheduled | Customer | `appointments` date fields | `POST /api/appointments/:id/reschedule` | Customer |
| Canceled | Admin or (implicitly) via subscription cancel | `appointments.status = 'canceled'` | `PATCH /api/admin/appointments/:id/cancel` | Admin |

**Critical Ownership Gaps:**
1. Between "Dispatched (admin)" and "Technician self-reports en_route (employee)" — two paths exist with different customer notification behavior. No coordination.
2. "Canceled" is exclusively admin-owned for individual appointments. Customer has no self-service cancel for individual appointments.
3. Subscription cancellation should cascade to individual appointments but does not.

---

## 4. Subscription Lifecycle

| Stage | Owned By | Table | Route | Who Triggers |
|-------|----------|-------|-------|-------------|
| Checkout started | Customer | Stripe (incomplete) | `create-payment-intent` | Customer |
| Payment submitted | Customer + Stripe | Stripe PI | Client `stripe.confirmPayment()` | Customer |
| First invoice created | Stripe | Stripe Invoice | Automatic on subscription creation | Stripe |
| Payment confirmed (sync) | Client | `subscriptions.status = 'active'`, `appointments`, `properties`, `profiles` | `confirm-booking` | Client → server |
| Payment confirmed (async) | Stripe webhook | `subscriptions`, `payments`, `service_orders`, `profiles.card_*` | `invoice.paid` | Stripe |
| Active | Stripe (authoritative) + local | `subscriptions.status = 'active'` | Both confirm-booking and invoice.paid | Both systems |
| Renewal | Stripe | `subscriptions`, `payments`, `service_orders` | `invoice.paid` | Stripe billing cycle |
| Payment failure | Stripe webhook | `subscriptions.status = 'past_due'` | `invoice.payment_failed` | Stripe |
| Recovery from past_due | Stripe webhook | `subscriptions.status = 'active'` | `invoice.paid` | Stripe |
| Cancellation scheduled | Stripe + local flag | `profiles.subscription_metadata` | `cancel-subscription` route | Customer request |
| Canceled | Stripe webhook | `subscriptions.status = 'canceled'` | `customer.subscription.deleted` | Stripe |
| Annual expiry | **No system** | — (should be `subscriptions.status = 'expired'`) | Missing cron | No trigger |

**Ownership Ambiguities:**
1. Active state is written by BOTH `confirm-booking` (optimistic) and `invoice.paid` webhook (authoritative). Both claim to set the subscription active.
2. Cancellation requires customer to use Stripe portal (application redirects there), but the application also writes to `profiles.subscription_metadata` — creating a local record alongside Stripe's authoritative record.
3. Annual plan expiry has NO owner. The business must manually notice and handle it.

---

## Ownership Conflict Summary

| Conflict | Systems in Conflict | Risk |
|----------|-------------------|------|
| First appointment creation | `confirm-booking` client route vs. `checkout.session.completed` webhook | Duplicate appointment if idempotency check fails |
| Subscription activation | `confirm-booking` (immediate) vs. `invoice.paid` webhook (delayed) | Window where sub is active locally but not confirmed by Stripe |
| En route status | Admin dispatch (sends SMS) vs. employee self-report (no SMS) | Customer may or may not receive notification depending on which path is used |
| Appointment cancellation | Admin cancel route (partial) vs. subscription webhook cascade (missing) | Open appointments after subscription canceled |
| Card details | `attach-payment-method` route vs. `invoice.paid` webhook | Both write same fields; last-write-wins; no canonical owner |

---

## Lifecycle Coverage Score

| Lifecycle | Coverage | Gaps |
|-----------|---------|------|
| Customer lead-to-account | 20% | No lead capture, no quote persistence |
| Customer account-to-payment | 90% | Minor: profile trigger deployment risk |
| Customer payment-to-first-appointment | 80% | Confirm-booking failure leaves no appointment |
| Subscription renewal | 70% | No next appointment auto-creation |
| Subscription cancellation | 60% | No cascade to appointments/assignments |
| Annual plan lifecycle | 40% | No expiry automation |
| Employee job lifecycle | 85% | En route SMS gap for self-reported status |
| Appointment status lifecycle | 75% | No individual customer cancel; CHECK constraint ambiguity |
