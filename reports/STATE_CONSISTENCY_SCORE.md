# STATE CONSISTENCY SCORE
## Generated: 2026-05-29
## Scope: 0–100 score per lifecycle domain with evidence, strengths, weaknesses, and highest-ROI fix

---

## Scoring Rubric

Each domain is scored 0–100 on four dimensions (25 points each):
- **State Completeness** (0–25): Are all relevant states defined and used?
- **Transition Integrity** (0–25): Are transitions guarded, logged, and atomic?
- **Visibility** (0–25): Can stakeholders see the current state and history?
- **Recovery** (0–25): Can erroneous states be detected and corrected?

---

## 1. Customer Lifecycle

**Score: 38 / 100**

### Breakdown

| Dimension | Score | Evidence |
|-----------|-------|---------|
| State Completeness | 12/25 | Auth and profile states exist; no lead/quote state; no reactivation state; onboarding flag is binary (no partial onboarding states) |
| Transition Integrity | 14/25 | Payment path is well-guarded (PI verification in `confirm-booking`); profile creation trigger unconfirmed; onboarding progress not atomic |
| Visibility | 7/25 | Admin can view customer list; cannot see onboarding dropoff, quote activity, or abandoned checkouts; no lead funnel |
| Recovery | 5/25 | No reactivation flow; canceled customers must restart from scratch; no admin tools to reopen accounts |

### Strongest Area
Payment confirmation: the `confirm-booking` route verifies the PI against Stripe before writing any DB state, preventing false bookings.

### Weakest Area
Lead stage: 100% of pre-account customer intent is lost. There is no `quote_leads` table, no email capture, and no admin visibility into how many people considered signing up.

### Key Missing Feature
A `quote_leads` table with admin UI. This single addition would transform top-of-funnel from invisible to measurable, enabling conversion tracking, follow-up outreach, and geographic demand analysis.

---

## 2. Scheduling Lifecycle (Appointments)

**Score: 52 / 100**

### Breakdown

| Dimension | Score | Evidence |
|-----------|-------|---------|
| State Completeness | 14/25 | Core states exist (`scheduled`, `completed`, `canceled`); `en_route`/`in_progress` states likely violate original CHECK constraint; no `missed`/`expired` state |
| Transition Integrity | 16/25 | Completion cascade from assignment → appointment now exists; cancellation does NOT cascade to assignments; idempotency guards on appointment creation work |
| Visibility | 15/25 | Admin appointments list is functional; visits page requires completed status (which works now); no calendar view; no "missed" detection |
| Recovery | 7/25 | No un-cancel capability; no reopen for completed appointments; canceled appointments leave orphan assignments |

### Strongest Area
Appointment creation: the dual-path (confirm-booking + webhook) with idempotency guard reliably creates appointments without duplicates.

### Weakest Area
Cancellation cascade: canceling an appointment leaves assignments active, technicians assigned, and no notification to the employee. This is the most dangerous operational gap in the entire scheduling lifecycle.

### Key Missing Feature
Two lines of code in `adminAppointments.ts` cancel route to update `assignments.status = 'skipped'`. This single change prevents technicians from driving to canceled jobs.

---

## 3. Employee Lifecycle

**Score: 61 / 100**

### Breakdown

| Dimension | Score | Evidence |
|-----------|-------|---------|
| State Completeness | 17/25 | Assignment lifecycle is well-defined (6 states); employee status is simple (2 states); lifecycle timestamps (`en_route_at`, `arrived_at`, `started_at`, `completed_at`) all exist |
| Transition Integrity | 16/25 | Employee auth checks `status = 'active'`; completion cascade to appointment works; `assigned` vs `scheduled` naming discrepancy is a hidden bug |
| Visibility | 15/25 | Employee tracking page shows real-time status; admin can see today's assignments; no historical performance data; no audit log for state changes |
| Recovery | 13/25 | Admin can reassign; admin can dispatch/override; cannot undo completion; no reassignment for inactive employee's open assignments |

### Strongest Area
Assignment lifecycle timestamps: `en_route_at`, `arrived_at`, `started_at`, `completed_at` are all tracked and immutable (set only on first transition). This creates a reliable time-series for each job.

### Weakest Area
The `assigned` vs `scheduled` naming discrepancy: `employeeAssignments.ts` VALID_STATUSES includes `"assigned"` but the DB CHECK constraint allows `"scheduled"`. Employees attempting to set status to `"assigned"` may trigger a DB constraint violation. This is a silent failure mode.

### Key Missing Feature
Employee notification when their assignment is canceled due to appointment cancellation. Without this, technicians drive to canceled jobs (even if the assignment cascade is added, they still need to be told).

---

## 4. Subscription Lifecycle

**Score: 44 / 100**

### Breakdown

| Dimension | Score | Evidence |
|-----------|-------|---------|
| State Completeness | 11/25 | Core states (`active`, `past_due`, `canceled`) work; `expired` state for annual plans is missing entirely; no `paused` state; no CHECK constraint |
| Transition Integrity | 14/25 | Stripe webhook handles `active → past_due → active` cycle correctly; `customer.subscription.updated` syncs non-active states; annual plan expiry has no trigger |
| Visibility | 9/25 | No admin subscriptions page; renewal dates invisible; annual expiry invisible; past-due only visible as count on Overview |
| Recovery | 10/25 | Billing portal lockout for past_due customers; admin cannot cancel from app; no reconciliation with Stripe |

### Strongest Area
Webhook-driven state synchronization for recurring subscriptions: `invoice.paid`, `invoice.payment_failed`, and `customer.subscription.deleted` are all handled correctly, keeping local state in sync with Stripe for the normal subscription lifecycle.

### Weakest Area
Annual plan lifecycle: no expiry mechanism, no renewal reminder, no admin visibility into upcoming expirations. Annual plans represent a guaranteed revenue leak after the first year passes.

### Key Missing Feature
A Netlify scheduled function that runs daily and updates `subscriptions SET status = 'expired' WHERE program = 'annual' AND status = 'active' AND current_period_end < NOW()`. This 4-line SQL closes the most dangerous open gap.

---

## 5. Billing Lifecycle

**Score: 58 / 100**

### Breakdown

| Dimension | Score | Evidence |
|-----------|-------|---------|
| State Completeness | 17/25 | `payments` table captures successful payments; refunds handled via `charge.refunded` webhook; failed payments tracked in subscription status; one-time payments may not generate `payments` rows |
| Transition Integrity | 15/25 | Stripe is authoritative; webhook signature verification is implemented; `invoice.paid` is idempotent via upsert; `payments.stripe_payment_intent_id` is UNIQUE |
| Visibility | 14/25 | Admin billing page shows payments; subscription past-due count on Overview; no invoice list for admin; no revenue trend (hardcoded percentages) |
| Recovery | 12/25 | Billing portal for customers (blocked for past_due); Stripe Customer Portal for subscription management; admin cannot initiate recovery from app |

### Strongest Area
Stripe integration integrity: webhook signature verification, idempotent upserts, and the dual-path (client-side confirm + webhook fallback) make the billing flow robust against most failure modes.

### Weakest Area
Past-due deadlock: `requireActiveSubscription()` blocks billing portal access for `past_due` customers. This is a 1-line code change that has been identified across multiple audits but not yet fixed.

### Key Missing Feature
Change `requireActiveSubscription()` to accept `past_due` status:
```typescript
.in("status", ["active", "past_due"])
```
One line. Prevents payment deadlock for failed subscriptions.

---

## 6. Marketplace Lifecycle

**Score: 68 / 100**

### Breakdown

| Dimension | Score | Evidence |
|-----------|-------|---------|
| State Completeness | 19/25 | Complete payment status lifecycle (pending → completed/failed/expired/refunded); fulfillment lifecycle (pending → processing → scheduled → fulfilled/cancelled); good separation of concerns |
| Transition Integrity | 17/25 | Webhook-driven with retry; idempotent upserts on `stripe_session_id`; line item fetch is blocking (ensures data completeness); duplicate item prevention via `onConflict` |
| Visibility | 17/25 | Admin can see marketplace orders with line items; fulfillment status is modifiable; no notifications to customer on fulfillment status change |
| Recovery | 15/25 | Admin can update fulfillment status; can cancel unfulfilled orders; no automated recovery for partial webhook failures |

### Strongest Area
The `checkout.session.completed` webhook handling is the most hardened webhook handler in the codebase — line items are fetched directly from Stripe API (not trusted from payload), blocking errors enforce data completeness, and idempotency is handled at multiple levels.

### Weakest Area
The race condition between `checkout.session.completed` and `payment_intent.succeeded` webhooks. If `payment_intent.succeeded` arrives first, the `marketplace_orders` row doesn't exist yet and `service_orders` is not created. The `checkout.session.completed` handler will create both, but the `payment_intent.succeeded` handler's service_order creation is silently skipped.

### Key Missing Feature
A reconciliation query that runs hourly or daily checking for completed marketplace orders without service orders, and creates them. Covers the race condition residue.

---

## 7. Notification Lifecycle

**Score: 48 / 100**

### Breakdown

| Dimension | Score | Evidence |
|-----------|-------|---------|
| State Completeness | 14/25 | `notification_log` table with 4 statuses and 6 types; but completion notification uses wrong type (`appointment_confirmation` instead of `service_completion`), conflicting with dedup index |
| Transition Integrity | 13/25 | Log-on-send pattern is implemented in most routes; `logNotification()` utility used in some routes, direct insert in others; no retry for failed notifications |
| Visibility | 6/25 | No admin notification history page; failed notifications are invisible; no customer-facing notification history |
| Recovery | 15/25 | Dedup index prevents duplicate sends; fire-and-forget pattern means failures don't block the primary operation; email can be re-sent manually from Resend dashboard |

### Strongest Area
Deduplication: the unique index on `(appointment_id, notification_type) WHERE status = 'sent'` prevents duplicate confirmation/reminder emails for the same appointment. This is a meaningful operational safety net.

### Weakest Area
The completion notification type collision: `employeeAssignments.ts` line 282 logs completion notifications with `notification_type: "appointment_confirmation"`. This is the same type used when the appointment is first booked. If a booking confirmation was sent and then the job completes, the second insert will silently fail due to the unique index. Customers may not receive their service completion email. 

### Key Missing Feature
Add `"service_completed"` to the `notification_type` CHECK constraint in `notification_log`:
```sql
ALTER TABLE public.notification_log
  DROP CONSTRAINT notification_log_notification_type_check;
ALTER TABLE public.notification_log
  ADD CONSTRAINT notification_log_notification_type_check
  CHECK (notification_type IN (
    'appointment_confirmation', 'reminder_24h', 'reminder_same_day',
    'appointment_canceled', 'appointment_rescheduled', 'technician_enroute',
    'service_completed', 'payment_failed', 'subscription_expiring'
  ));
```
Then update `employeeAssignments.ts` to use `notification_type: "service_completed"`.

---

## Overall Platform State Consistency Score

| Domain | Score | Weight | Weighted Score |
|--------|-------|--------|---------------|
| Customer Lifecycle | 38 | 15% | 5.7 |
| Scheduling Lifecycle | 52 | 25% | 13.0 |
| Employee Lifecycle | 61 | 15% | 9.2 |
| Subscription Lifecycle | 44 | 20% | 8.8 |
| Billing Lifecycle | 58 | 10% | 5.8 |
| Marketplace Lifecycle | 68 | 8% | 5.4 |
| Notification Lifecycle | 48 | 7% | 3.4 |

**Overall Weighted Score: 51 / 100**

### Justification for Weights
- Scheduling (25%) is weighted highest as it's the primary operational function — every customer interaction flows through it
- Subscriptions (20%) is the core revenue model — stale subscription states directly affect billing accuracy
- Customer (15%) and Employee (15%) are equally weighted as operational counterparts
- Billing (10%), Marketplace (8%), and Notifications (7%) are supporting but not primary

### Score Interpretation

51/100 means the platform has a functional core but significant state consistency holes. The system will work under happy-path conditions with a skilled operator actively monitoring. It will fail in predictable, specific ways under normal operational stress (cancellations, payment failures, annual plan renewals). Four targeted fixes would bring this score to approximately 70/100:

1. Add assignment cascade on cancellation (IS-1, Scheduling +8 points)
2. Fix past_due billing portal lockout (Billing +6 points, Subscription +4 points)
3. Annual plan expiry cron (Subscription +6 points)
4. Fix notification_type for service completion (Notification +7 points)

**Target Score with Sprint 1 fixes: ~70/100** — operationally sound for beta with continued monitoring.
