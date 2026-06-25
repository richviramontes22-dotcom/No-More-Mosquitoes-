# BUSINESS STATE MACHINE AUDIT
## Generated: 2026-05-29
## Scope: Complete state machines for all stateful entities — states, transitions, and gaps

---

## 1. Appointments (`appointments.status`)

### Known States

States found by reading migrations and code:

| State | Source | Description |
|-------|--------|-------------|
| `requested` | `2025-02-23_initial_schema.sql` CHECK constraint, `customerAppointments.ts` ACTIVE_STATUSES | Initial state for guest/manual requests |
| `scheduled` | `2025-02-23_initial_schema.sql` CHECK constraint; written by `confirm-booking`, `checkout.session.completed`, `customerAppointments.ts` reschedule | Confirmed upcoming appointment |
| `confirmed` | `customerAppointments.ts` ACTIVE_STATUSES line 14 | Referenced but never explicitly written to in audited routes |
| `en_route` | `adminAppointments.ts` dispatch route line 89 | Technician dispatched |
| `in_progress` | Referenced in various NOT IN guards | Job in progress (no explicit writer to this state found) |
| `completed` | `2025-02-23_initial_schema.sql` CHECK; `employeeAssignments.ts` line 215 | Service delivered |
| `canceled` | `2025-02-23_initial_schema.sql` CHECK; `adminAppointments.ts` cancel route | Canceled (single-l) |
| `cancelled` | `adminAppointments.ts` line 152 NOT IN guard; `customerAppointments.ts` line 124 guard | Alternate spelling (double-l) — guarded against but not in CHECK constraint |

**Critical inconsistency:** The initial schema CHECK constraint is: `CHECK (status IN ('requested', 'scheduled', 'completed', 'canceled'))`. This does NOT include `en_route`, `in_progress`, `confirmed`, or `cancelled`. Either: (a) the CHECK constraint was dropped or modified in a later migration not captured in the migration files, or (b) writing `en_route` or `in_progress` to `appointments.status` would fail at the DB level. The dispatch route (`adminAppointments.ts`) writes `status: "en_route"` — which would violate the original CHECK constraint if it still exists.

### State Transition Table

| From State | To State | Who Triggers | Route/File | Valid? |
|------------|----------|-------------|------------|--------|
| (new row) | `requested` | Customer (guest request) | `schedule_requests` table insert | Yes |
| (new row) | `scheduled` | Customer (post-payment) | `billingStripe.ts` `confirm-booking` line 703 | Yes |
| (new row) | `scheduled` | Webhook (checkout) | `webhooksStripe.ts` `checkout.session.completed` line 295 | Yes |
| (new row) | `scheduled` | Admin (manual create) | Admin create route | Yes |
| `requested` | `scheduled` | Admin (confirms request) | Admin appointment update route | Assumed valid |
| `scheduled` | `en_route` | Admin (dispatch) | `adminAppointments.ts` `dispatch` line 89 | Blocked by CHECK if constraint is active |
| `scheduled` | `canceled` | Admin | `adminAppointments.ts` `cancel` line 161 | Yes |
| `scheduled` | `scheduled` | Customer (reschedule) | `customerAppointments.ts` reschedule line 150 | Yes (date changes, status stays scheduled) |
| `en_route` | `completed` | Employee | `employeeAssignments.ts` lines 212-223 (cascades from assignment) | Blocked by CHECK if constraint is active |
| `en_route` | `canceled` | Admin | `adminAppointments.ts` cancel — appt.status check only blocks completed/already canceled | Valid if CHECK allows |
| `in_progress` | `completed` | Employee (via assignment cascade) | `employeeAssignments.ts` line 215 | Blocked by CHECK if constraint is active |
| `completed` | — | (terminal) | — | No exit |
| `canceled` | — | (terminal) | — | No exit |

### Entry States
- `requested` (guest/manual path)
- `scheduled` (payment path — most common)

### Terminal States
- `completed`
- `canceled`

### Missing States
- **`missed`** — no state for when a technician didn't show up (assignment has `no_show` but appointment has no equivalent)
- **`expired`** — no state for appointments that passed their scheduled date without being marked complete or canceled
- **`rescheduled`** — reschedule only changes date fields, not status; there is no history of prior dates

---

## 2. Assignments (`assignments.status`)

### Known States

States found in migrations and code:

| State | Source |
|-------|--------|
| `scheduled` | Migration `2025-11-10_employee_portal.sql` CHECK constraint line 56; `adminAppointments.ts` upsert line 230 |
| `en_route` | Migration CHECK constraint; `adminAppointments.ts` dispatch line 101; `employeeAssignments.ts` VALID_STATUSES line 11 |
| `in_progress` | Migration CHECK constraint; `employeeAssignments.ts` VALID_STATUSES; `arrive` route transitions to this state |
| `completed` | Migration CHECK constraint; `employeeAssignments.ts` VALID_STATUSES |
| `no_show` | Migration CHECK constraint; `employeeAssignments.ts` VALID_STATUSES |
| `skipped` | Migration CHECK constraint; recommended in cancel cascade fix |
| `assigned` | `employeeAssignments.ts` VALID_STATUSES line 11 — included in code constant but NOT in DB CHECK constraint |

**Inconsistency:** `assigned` is in the VALID_STATUSES constant (code allows employees to set it) but is not in the migration CHECK constraint. Setting an assignment to `assigned` via the employee status route may fail at the DB level if the CHECK constraint is enforced.

### State Transition Table

| From State | To State | Who Triggers | Route/File | Valid? |
|------------|----------|-------------|------------|--------|
| (new row) | `scheduled` | Admin | `adminAppointments.ts` POST `/assignments` line 230 | Yes |
| (new row) | `en_route` | Admin (dispatch) | `adminAppointments.ts` dispatch line 101, 107 | Yes |
| `scheduled` | `en_route` | Admin (dispatch) | `adminAppointments.ts` dispatch line 101 | Yes |
| `scheduled` | `en_route` | Employee | `employeeAssignments.ts` status update line 194 | Yes |
| `scheduled` | `in_progress` | Employee (arrive) | `employeeAssignments.ts` arrive route line 331 | Yes |
| `scheduled` | `skipped` | (missing cascade) | Should be: cancel route; currently: no writer | Missing |
| `en_route` | `in_progress` | Employee (arrive) | `employeeAssignments.ts` arrive route line 331 | Yes |
| `en_route` | `in_progress` | Employee | `employeeAssignments.ts` status update | Yes |
| `en_route` | `skipped` | (missing cascade) | Should be: cancel route; currently: no writer | Missing |
| `in_progress` | `completed` | Employee | `employeeAssignments.ts` status update line 198 | Yes |
| `in_progress` | `no_show` | Employee | `employeeAssignments.ts` status update | Yes |
| `completed` | — | (terminal) | — | No exit |
| `no_show` | — | (terminal) | — | No exit (assumed) |
| `skipped` | — | (terminal) | — | No exit |

### Entry States
- `scheduled` (admin assignment)
- `en_route` (admin dispatch without prior assignment)

### Terminal States
- `completed`
- `no_show`
- `skipped`

### Missing Transitions
- `scheduled → skipped`: No code path triggers this when appointment is canceled. Critical gap — leaves technicians assigned to canceled appointments.
- `en_route → skipped`: Same gap for mid-route cancellations.
- `in_progress → skipped`: Not a realistic scenario but not guarded against.

---

## 3. Subscriptions (`subscriptions.status`)

### Known States

| State | Source |
|-------|--------|
| `active` | `billingStripe.ts` `confirm-booking`; `webhooksStripe.ts` `invoice.paid`; Stripe native |
| `past_due` | `webhooksStripe.ts` `invoice.payment_failed` line 537; Stripe native |
| `canceled` | `webhooksStripe.ts` `customer.subscription.deleted` line 586; Stripe native |
| `incomplete` | `billingStripe.ts` `update-subscription-plan` line 902 (uses live Stripe status); Stripe native |
| `incomplete_expired` | Stripe native — NOT confirmed written in code |
| `trialing` | Stripe native — NOT confirmed written in code |
| `unpaid` | Stripe native — NOT confirmed written in code |
| `expired` | Referenced in diagnostic queries and recommended fixes; NOT written by any production code path |

**Status values NOT in DB CHECK constraint:** The `subscriptions` table was created with `status TEXT NOT NULL` (no CHECK constraint in `2025-05-20_admin_features_support.sql`). Any string value can be written. This means Stripe status values like `incomplete`, `trialing`, `unpaid` could theoretically be written by the `customer.subscription.updated` webhook handler — which writes `sub.status` directly for non-active states.

### State Transition Table

| From State | To State | Who Triggers | Route/File | Valid? |
|------------|----------|-------------|------------|--------|
| (none) | `active` | Customer (post-payment) | `billingStripe.ts` `confirm-booking` lines 657, 679 | Yes |
| (none) | `active` | Stripe webhook | `webhooksStripe.ts` `invoice.paid` line 470 | Yes |
| (none) | `incomplete` | System | `billingStripe.ts` `update-subscription-plan` line 902 | Yes |
| `active` | `past_due` | Stripe webhook | `webhooksStripe.ts` `invoice.payment_failed` line 537 | Yes |
| `active` | `canceled` | Stripe webhook | `webhooksStripe.ts` `customer.subscription.deleted` line 586 | Yes |
| `active` | (any Stripe state) | Stripe webhook | `webhooksStripe.ts` `customer.subscription.updated` lines 568-577 | Yes for non-active states |
| `past_due` | `active` | Stripe webhook | `webhooksStripe.ts` `invoice.paid` line 470 (upserts active) | Yes |
| `past_due` | `canceled` | Stripe webhook | `customer.subscription.deleted` | Yes |
| `canceled` | — | (terminal in app) | — | No transitions out in code |
| `active` | `expired` | (missing) | Should be: cron job; currently: no code path | Missing |

### Entry States
- `active` (most common)
- `incomplete` (subscription created but payment not yet confirmed)

### Terminal States
- `canceled`
- `expired` (desired terminal state for annual plans — not currently enforced)

### Missing States
- **`expired`**: Annual subscriptions have `current_period_end` set but no code transitions them from `active` to `expired` when that date passes. The `subscriptions` table has no CHECK constraint so this state can be written — but nothing writes it.
- **`paused`**: No concept of a paused subscription in local DB or Stripe Billing config.

---

## 4. Marketplace Orders

### Known States from Code

**`marketplace_orders.status`:**
| State | Written By | Route |
|-------|-----------|-------|
| `pending` | Client-side pre-creation (if pre-created before checkout) | Client |
| `completed` | `webhooksStripe.ts` `checkout.session.completed` line 119; `payment_intent.succeeded` line 624 | Webhook |
| `failed` | `webhooksStripe.ts` `payment_intent.payment_failed` line 721 | Webhook |
| `expired` | `webhooksStripe.ts` `checkout.session.expired` line 551 | Webhook |
| `refunded` | `webhooksStripe.ts` `charge.refunded` line 750 | Webhook |

**`marketplace_orders.fulfillment_status`:**
| State | Written By |
|-------|-----------|
| `pending` | `checkout.session.completed` line 119 (initial creation) |
| `processing` | `adminMarketplace.ts` PATCH fulfillment |
| `scheduled` | `adminMarketplace.ts` PATCH fulfillment |
| `fulfilled` | `adminMarketplace.ts` PATCH fulfillment |
| `cancelled` | `adminMarketplace.ts` PATCH fulfillment; `charge.refunded` if not yet fulfilled |

### Entry States
- `completed` + `pending` (payment confirmed, fulfillment not started)

### Terminal States
- `refunded` (payment reversed)
- `expired` (checkout session expired, never paid)
- `failed` (payment failed)
- `fulfilled` (service delivered)

---

## 5. Support Tickets (`tickets.status`)

### Known States (from `2025-11-25_tickets_table.sql`)
| State | Description |
|-------|-------------|
| `open` | New ticket, awaiting review |
| `in_progress` | Admin actively working on it |
| `resolved` | Issue resolved |
| `closed` | Final state |

### Transitions
No server route for ticket status updates was found in audited files. Status changes are presumably done via direct Supabase client calls from the admin Tickets page. The `updated_at` trigger fires automatically on any row change.

### Entry States
- `open` (DEFAULT in migration)

### Terminal States
- `closed` (assumed — no code prevents reopening)

### Missing States
- **`awaiting_customer`** — no state for "waiting for customer response"
- **`escalated`** — no priority escalation state separate from the `priority` column

---

## 6. Employee Status (`employees.status`)

### Known States (from `2025-11-28_missing_tables.sql`, line 75)
| State | Description |
|-------|-------------|
| `active` | Can receive assignments, authenticates via employee portal |
| `inactive` | Excluded from capacity calculations; blocked from employee portal (auth check in `getAuthenticatedEmployee()`) |

### Entry States
- `active` (DEFAULT in migration)

### Terminal States
- None. Employees can be reactivated (no code prevents `inactive → active` transition).

### Missing States
- **`on_leave`** — no temporary unavailability state
- **`terminated`** — `inactive` serves double duty for temporary and permanent deactivation

---

## 7. Notification Log (`notification_log.status`)

### Known States (from `2026-05-16_phase2_notification_infrastructure.sql`, line 22)
| State | Description |
|-------|-------------|
| `pending` | Created but not yet sent (DEFAULT) |
| `sent` | Successfully delivered by provider |
| `failed` | Provider rejected or returned error |
| `skipped` | Not sent because email not configured or recipient has no contact info |

### Notification Types (from migration CHECK constraint)
`appointment_confirmation`, `reminder_24h`, `reminder_same_day`, `appointment_canceled`, `appointment_rescheduled`, `technician_enroute`

**Gap:** The completion notification in `employeeAssignments.ts` (line 282) uses `notification_type: "appointment_confirmation"` — which reuses the booking confirmation type for the service completion notification. This is semantically incorrect and will conflict with the deduplication unique index: `UNIQUE (appointment_id, notification_type) WHERE status = 'sent'`. If a booking confirmation was sent and then the job is completed, the completion notification insert will fail silently due to the unique index violation.

### Entry States
- `pending` (DEFAULT)

### Terminal States
- `sent`, `failed`, `skipped` (all treated as final — no retry logic in application code)

---

## State Machine Summary

| Entity | Total States | Entry States | Terminal States | Missing Critical States | State Machine Consistency |
|--------|-------------|-------------|----------------|------------------------|--------------------------|
| Appointments | 7 (some with CHECK violation risk) | `requested`, `scheduled` | `completed`, `canceled` | `missed`, `expired` | Poor — CHECK constraint may not include `en_route`/`in_progress` |
| Assignments | 7 (1 in code but not DB) | `scheduled`, `en_route` | `completed`, `no_show`, `skipped` | None critical | Medium — `assigned` vs `scheduled` naming inconsistency |
| Subscriptions | 5+ (no CHECK constraint) | `active`, `incomplete` | `canceled` (`expired` desired) | `expired`, `paused` | Poor — annual plans never expire; no CHECK constraint |
| Marketplace Orders | 5 payment + 5 fulfillment | `completed`+`pending` | `refunded`, `expired`, `fulfilled` | None | Good — clean webhook-driven lifecycle |
| Support Tickets | 4 | `open` | `closed` | `awaiting_customer` | Medium |
| Employees | 2 | `active` | None (both reversible) | `on_leave` | Simple — adequate for current scale |
| Notification Log | 4 | `pending` | `sent`, `failed`, `skipped` | None | Good — except completion uses wrong type |
