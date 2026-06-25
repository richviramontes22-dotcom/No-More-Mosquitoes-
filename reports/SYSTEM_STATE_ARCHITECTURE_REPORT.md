# SYSTEM STATE ARCHITECTURE REPORT
## Generated: 2026-05-29
## Scope: Complete operational state architecture — final synthesis of all 7 prior phases

---

## 1. Source of Truth for Every Major Entity

| Entity | Source of Truth |
|--------|----------------|
| Customer identity | Supabase `auth.users` is the canonical identity record; `public.profiles` is the application extension row required for all app functionality |
| Subscription status | Stripe is authoritative; `public.subscriptions.status` is a mirror that must be kept in sync via webhooks |
| Payment method | Stripe is authoritative; `profiles.card_last4/brand/expiry` are display cache only, written by `attach-payment-method` and `invoice.paid` |
| Appointment status | `public.appointments.status` is fully local — no external system holds a copy |
| Assignment status | `public.assignments.status` is fully local — no external system |
| Employee status | `public.employees.status` is fully local |
| Property record | `public.properties` is fully local with multiple writers for `program`/`cadence` fields |
| Service order | `public.service_orders` is fully local, created by webhooks |
| Marketplace order payment | Stripe is authoritative; `marketplace_orders.status` mirrors Stripe payment state |
| Marketplace order fulfillment | `marketplace_orders.fulfillment_status` is locally owned by admin |
| Job media | `public.job_media` + Supabase Storage `job-media` bucket — fully local |
| Notification state | `public.notification_log` is fully local |
| Support ticket | `public.tickets` is fully local |
| Business hours | `public.business_hours` is fully local |
| Blackout dates | `public.blackout_dates` is fully local |
| Revenue metrics | Computed at query time from `subscriptions` and `payments`; not stored |
| Leads/Quotes | **No system** — 100% ephemeral |

---

## 2. Most Dangerous State Inconsistencies (Ranked by Probability × Business Impact)

### Rank 1: Canceled appointments with active assignments (IS-1)
**Probability:** High (happens every time an appointment is canceled while a technician is assigned)
**Business Impact:** Critical (technician wastes time/fuel; customer service failure)
**Evidence:** `adminAppointments.ts` cancel route does not touch `assignments` table. Confirmed in multiple prior audits.

### Rank 2: Annual subscriptions active past their expiry date (IS-3)
**Probability:** Certain (will happen for every annual customer starting ~365 days post-launch)
**Business Impact:** Critical (service delivered with no payment; revenue leakage)
**Evidence:** `billingStripe.ts` writes `current_period_end = now + 365 days`. No code ever transitions these to `expired`.

### Rank 3: Future scheduled appointments for canceled subscriptions (IS-11)
**Probability:** High (every subscription cancellation leaves open appointments)
**Business Impact:** Critical (technicians dispatched to customers who explicitly canceled)
**Evidence:** `customer.subscription.deleted` webhook only updates `subscriptions.status`, does not touch `appointments`.

### Rank 4: Past-due customers locked out of billing portal (not a DB state issue — a code gate issue)
**Probability:** Certain for any customer who has a payment failure
**Business Impact:** Critical (payment deadlock; customer cannot self-remediate; churn amplified)
**Evidence:** `requireActiveSubscription()` in `billingStripe.ts` lines 214-229 checks only `status = 'active'`.

### Rank 5: `auth.users` without `profiles` rows (IS-5)
**Probability:** Medium (depends on whether DB trigger is deployed — unconfirmed)
**Business Impact:** Critical (new user signup fails silently; billing, notifications, and admin visibility all broken)
**Evidence:** No profile creation trigger found in application migration files.

### Rank 6: Multiple active assignments per appointment (IS-12)
**Probability:** Low-Medium (can happen if admin assigns same appointment twice — no UNIQUE constraint)
**Business Impact:** High (two technicians dispatched to same job)
**Evidence:** Migration `2025-11-10_employee_portal.sql` for `assignments` table has no UNIQUE constraint on `appointment_id`.

### Rank 7: Subscription status stale (locally active, canceled in Stripe) (IS-4)
**Probability:** Low-Medium (requires webhook delivery failure + 3 days of retry failures)
**Business Impact:** High (customer treated as active when they've canceled)
**Evidence:** `customer.subscription.deleted` webhook handler is correct but not backed by reconciliation.

---

## 3. Missing Cascades (Ranked Most Dangerous First)

| Rank | Missing Cascade | Trigger Event | Impact |
|------|----------------|--------------|--------|
| 1 | Appointment cancel → assignment skip | Admin cancel, subscription webhook | Technicians drive to canceled jobs |
| 2 | Subscription canceled → future appointments canceled | `customer.subscription.deleted` | Technicians dispatch to canceled customers indefinitely |
| 3 | Annual plan expiry → subscription status = expired | Time (daily cron needed) | Revenue leakage for expired annual plans |
| 4 | Employee `en_route` (self-reported) → customer SMS | Employee portal status update | Customer not notified technician is coming when employee self-dispatches |
| 5 | Subscription canceled → open assignment skip | `customer.subscription.deleted` | Same technician issue for subscription cancel path |
| 6 | Employee deactivation → open assignment skipped | Admin employee deactivation | Dead assignments remain for inactive employees |
| 7 | Customer reschedule → employee notification | `customerAppointments.ts` reschedule | Technician shows up at old time |

---

## 4. Fixes Before Any Feature Work

These must be in place before the system can scale beyond 3 customers without daily operational errors:

### Fix A: Assignment cascade on appointment cancellation
**File:** `server/routes/adminAppointments.ts`, cancel route (line 163, after appointment update)
```typescript
await db.from("assignments")
  .update({ status: "skipped" })
  .eq("appointment_id", id)
  .not("status", "in", '("completed","skipped","no_show")');
```
**Complexity:** S | **Business Impact:** Critical | **Risk Reduction:** High

### Fix B: Assignment cascade on subscription canceled webhook
**File:** `server/routes/webhooksStripe.ts`, `customer.subscription.deleted` case (after line 587)
```typescript
// Cancel future scheduled appointments for this subscription
// (requires joining subscriptions → appointments via user_id + property_id)
```
**Complexity:** M | **Business Impact:** Critical | **Risk Reduction:** High

### Fix C: Annual subscription expiry cron
**File:** `netlify/functions/send-reminders.ts` or new `check-subscriptions.ts`
```sql
UPDATE public.subscriptions
SET status = 'expired', updated_at = NOW()
WHERE program = 'annual' AND status = 'active' AND current_period_end < NOW();
```
**Complexity:** S | **Business Impact:** Critical | **Risk Reduction:** High

### Fix D: Past-due billing portal lockout
**File:** `server/routes/billingStripe.ts`, `requireActiveSubscription()` (line 219)
```typescript
.in("status", ["active", "past_due"])  // was: .eq("status", "active")
```
**Complexity:** S | **Business Impact:** Critical | **Risk Reduction:** High

### Fix E: Confirm profile creation trigger is deployed
**Infrastructure:** Supabase Dashboard → Database → Functions
**SQL (if missing):**
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)), NEW.email, 'customer')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```
**Complexity:** S | **Business Impact:** Critical | **Risk Reduction:** High

### Fix F: Add UNIQUE constraint on `assignments.appointment_id`
**SQL:**
```sql
ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_appointment_id_uq UNIQUE (appointment_id);
```
**Note:** Run `SELECT appointment_id, COUNT(*) FROM public.assignments GROUP BY appointment_id HAVING COUNT(*) > 1` first to check for existing duplicates.
**Complexity:** S | **Business Impact:** High | **Risk Reduction:** High

### Fix G: Fix notification_type for service completion
**File:** `server/routes/employeeAssignments.ts` line 282
Change `notification_type: "appointment_confirmation"` to `notification_type: "service_completed"` and add `"service_completed"` to DB CHECK constraint.
**Complexity:** S | **Business Impact:** High | **Risk Reduction:** Medium

---

## 5. Fixes That Can Wait

These are real gaps but will not cause operational failures in the first 90 days of beta:

- **Admin subscriptions management page** — Stripe Dashboard is usable with 1-10 customers; becomes painful at 20+
- **Contact inquiries admin UI** — Low volume at beta; manual DB query is acceptable short-term
- **Job media admin visibility** — Valuable for quality control but not operationally blocking
- **Customer individual appointment cancel API** — Customers can contact admin; not critical at small scale
- **Annual renewal reminder emails** — First annual plans expire ~12 months from launch
- **Stripe reconciliation job** — Webhook retry is sufficient at low volume; add after 6 months
- **`payment_method.detached` webhook handler** — Stale card display is cosmetic at beta
- **Employee `assigned` vs `scheduled` status naming fix** — DB CHECK constraint may already block `assigned`; needs verification before fix
- **Revenue trend chart fixes** — Hardcoded percentages are wrong but not operationally blocking
- **Lead capture at quote widget** — Zero lead capture is a growth problem, not an operational problem

---

## 6. Next Implementation Sprint (Priority Order)

### Sprint 0 — Verification (Day 1, no code changes)
1. Verify Supabase profile creation trigger is deployed (Fix E above)
2. Verify admin RLS policy on appointments table allows admin reads
3. Run IS-12 diagnostic SQL — check for duplicate assignments
4. Confirm all Stripe webhook events registered (invoice.paid, invoice.payment_failed, customer.subscription.deleted, customer.subscription.updated, payment_intent.succeeded, checkout.session.completed, charge.refunded)
5. Verify `employees` table has at least 1 active record

### Sprint 1 — Data Integrity (Days 2-4, all S complexity)
1. **Fix D** — Past-due billing portal lockout (1 line, 15 minutes) → most immediate customer-facing risk
2. **Fix A** — Assignment cascade on appointment cancellation (3 lines, 30 minutes) → prevents technician waste
3. **Fix C** — Annual subscription expiry cron (10 lines, 1 hour) → prevents revenue leakage
4. **Fix G** — Notification type fix for service completion (2 changes, 30 minutes) → fixes silent deduplication failure
5. **Fix F** — UNIQUE constraint on assignments.appointment_id (1 SQL statement) → prevents double-dispatch

### Sprint 2 — Cascade Completeness (Days 5-8)
1. **Fix B** — Subscription deleted → future appointments canceled (requires joining sub → appt)
2. Employee deactivation → assignment cascade
3. Customer reschedule → employee notification
4. Annual plan expiry alert on admin Overview

### Sprint 3 — Visibility (Days 9-15)
1. Admin subscriptions management page
2. Notification log admin view
3. Contact inquiries admin view
4. Job media in admin visits page

---

## 7. Currently Hidden Lifecycle Bugs (Users Haven't Hit Yet But Will)

### Bug 1: Service completion email dedup collision
**What happens:** Customer books appointment → booking confirmation email sent → `notification_log` row: `(appointment_id=X, notification_type='appointment_confirmation', status='sent')`. Technician completes job → completion email attempted → `notification_log` INSERT tries `(appointment_id=X, notification_type='appointment_confirmation', status='sent')` → UNIQUE constraint violation → INSERT silently fails (caught by `.catch(() => {})` in `employeeAssignments.ts` line 286) → customer never receives service completion email.
**When:** Every job completion where a booking confirmation was sent (which is every job).
**Evidence:** `employeeAssignments.ts` line 282 uses `notification_type: "appointment_confirmation"` for completion log. Dedup index at migration `2026-05-16_phase2`, line 51.

### Bug 2: Annual plan — first renewal year
**What happens:** Customer buys annual plan May 2026. `current_period_end = May 2027`. No expiry cron. May 2027 passes. Plan shows `active`. Admin schedules next season's appointments in April 2027. Service begins. Customer never renews. Revenue delivered for free.
**When:** First annual customers renew (approximately May 2027 for any customer who signs up in May 2026).

### Bug 3: Confirm-booking failure after payment
**What happens:** Customer completes Stripe payment (stripe.confirmPayment() succeeds). Client calls `confirm-booking` but Netlify function times out or returns 500. Stripe subscription is `active`. `subscriptions` row may not exist (only created in `invoice.paid` webhook). `appointments` row not created. Customer is charged but has no appointment. `invoice.paid` webhook will upsert subscription but will NOT create appointment for the PaymentElement path (only for Checkout redirect path via `checkout.session.completed`).
**When:** Any Netlify cold start timeout, deployment issue, or network error during the 6-second window after payment confirmation.

### Bug 4: Multiple active assignments per appointment (no UNIQUE constraint)
**What happens:** Admin selects appointment in bulk assignment. Due to a UI bug or double-click, `POST /api/admin/assignments` is called twice with the same `appointment_id`. The `onConflict: "appointment_id"` in the upsert only works if a UNIQUE constraint exists on that column. If the constraint is absent, two assignment rows are created. Both employees receive notification. Both may show up.
**When:** Any time admin assigns an appointment and there's a double-submit or UI race.

### Bug 5: Employee `assigned` status triggers DB CHECK violation
**What happens:** Employee calls `POST /api/employee/assignments/:id/status` with `status = "assigned"`. The code validates this against `VALID_STATUSES` (which includes `"assigned"`). The DB UPDATE is attempted. The `assignments` table CHECK constraint allows `('scheduled','en_route','in_progress','completed','no_show','skipped')` — not `'assigned'`. The UPDATE fails with a CHECK constraint violation. The employee receives 500 error instead of 200. The employee portal cannot transition to `assigned`.
**When:** Any employee attempts to set status to `assigned` (which is in the VALID_STATUSES constant).

---

## 8. State Transitions That Should Be Enforced in Code

### Transition 1: Prevent appointment cancellation if assignment is `in_progress`
```typescript
// In adminAppointments.ts cancel route, before updating appointments:
if (ctx.assignment?.status === 'in_progress') {
  return res.status(409).json({
    error: "Cannot cancel: technician is currently in progress at this property.",
    code: "ASSIGNMENT_IN_PROGRESS"
  });
}
```

### Transition 2: Prevent assignment to inactive employees
```typescript
// In adminAppointments.ts POST /assignments, after fetching employee:
if (employee.status !== 'active') {
  return res.status(400).json({ error: "Cannot assign to inactive employee" });
}
```

### Transition 3: Prevent reschedule of in_progress or completed appointments
```typescript
// In customerAppointments.ts reschedule, existing guard already catches 'completed'
// Add 'in_progress' and 'en_route':
if (["canceled", "cancelled", "completed", "in_progress", "en_route"].includes(appt.status)) {
  return res.status(400).json({ error: "Cannot reschedule this appointment" });
}
```

### Transition 4: Prevent double-completion on assignments
```typescript
// Already done via lifecycle timestamp check (completed_at only set once)
// Add explicit guard:
if (current.status === 'completed') {
  return res.status(400).json({ error: "Assignment already completed" });
}
```

### Transition 5: Verify subscription status before creating recurring appointment
```typescript
// In admin scheduling queue or appointment creation:
const sub = await db.from("subscriptions").select("status, current_period_end")...
if (sub.status !== 'active') {
  throw new Error("Cannot schedule for canceled/past_due subscription");
}
if (sub.program === 'annual' && new Date(sub.current_period_end) < new Date()) {
  throw new Error("Annual plan has expired — renewal required before scheduling");
}
```

---

## 9. Database Constraints That Should Exist

### Constraint 1: UNIQUE on `assignments.appointment_id`
```sql
ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_appointment_id_uq UNIQUE (appointment_id);
```
**Prevents:** Multiple technicians assigned to same appointment.

### Constraint 2: NOT NULL on `appointments.user_id`
```sql
-- Verify current state, then add if missing:
ALTER TABLE public.appointments
  ALTER COLUMN user_id SET NOT NULL;
```
**Prevents:** Appointments without owners (which break all user-scoped queries).

### Constraint 3: CHECK constraint on `subscriptions.status`
```sql
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'trialing', 'unpaid', 'expired'));
```
**Prevents:** Invalid status strings being written by webhook handlers.

### Constraint 4: CHECK constraint extension on `appointments.status` to include operational states
```sql
-- If the original CHECK was not modified, add en_route and in_progress:
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('requested', 'scheduled', 'confirmed', 'en_route', 'in_progress', 'completed', 'canceled', 'cancelled'));
```
**Prevents:** The current situation where `adminAppointments.ts` dispatch route writes `en_route` which may violate the original constraint.

### Constraint 5: FK NOT NULL on `subscriptions.user_id`
```sql
-- Verify and enforce:
ALTER TABLE public.subscriptions
  ALTER COLUMN user_id SET NOT NULL;
```
**Prevents:** Subscriptions without an owning user.

### Constraint 6: Prevent `assignments.status = 'assigned'` at DB level
```sql
-- The CHECK constraint should not include 'assigned' since admin writes 'scheduled':
-- Verify current constraint matches expected values
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%assignments%';
```
**Prevents:** Code inconsistency — `employeeAssignments.ts` uses `"assigned"` but DB expects `"scheduled"`.

### Constraint 7: INDEX on `subscriptions(user_id, property_id)` for availability queries
```sql
CREATE INDEX IF NOT EXISTS subscriptions_user_property_idx
  ON public.subscriptions (user_id, property_id)
  WHERE status = 'active';
```
**Performance:** Scheduling queue and appointment creation both join subscriptions by user+property.

---

## 10. Most Likely Operational Failures (Ranked by Probability in Beta)

### Failure 1: Technician drives to canceled appointment (Probability: HIGH — will happen within first month)
**Scenario:** Admin cancels appointment for rescheduling. Technician has already been assigned. Admin doesn't notice assignment; technician checks portal, sees the job (still `scheduled`), and drives to the property. Customer is confused.
**Root Cause:** IS-1 — cancellation does not cascade to assignments.
**Fix:** 3 lines of code in cancel route (Fix A above).

### Failure 2: Annual plan customer receives service after expiry (Probability: MEDIUM — will happen in year 2)
**Scenario:** Customer bought annual plan in May 2026. Plan expires May 2027. Admin schedules their summer 2027 appointments not noticing the subscription is technically expired. Service is delivered. Customer never renews.
**Root Cause:** IS-3 — no expiry mechanism for annual plans.
**Fix:** Daily cron SQL update (Fix C above).

### Failure 3: Customer with failed payment cannot update card (Probability: MEDIUM — will happen within first few months)
**Scenario:** Customer's card expires. `invoice.payment_failed` fires. Customer tries to update card via `/dashboard/billing`. `requireActiveSubscription()` returns 403 (status is `past_due`, not `active`). Customer cannot access Stripe portal to fix. Customer gives up and churns.
**Root Cause:** `requireActiveSubscription()` check too strict.
**Fix:** 1 line of code (Fix D above).

### Failure 4: New customer completes payment but has no appointment (Probability: LOW-MEDIUM — depends on Netlify reliability)
**Scenario:** Customer completes Stripe payment successfully. `confirm-booking` Netlify function times out (Netlify 10-second limit). Stripe subscription is active. No appointment created. Customer sees "payment succeeded" UI but no appointment in dashboard.
**Root Cause:** `confirm-booking` is the primary appointment creation path; `invoice.paid` webhook only creates appointments for the Checkout redirect path.
**Fix:** Medium complexity — add appointment creation fallback to `payment_intent.succeeded` webhook for PaymentElement path.

### Failure 5: Contact form inquiry goes unread for days (Probability: HIGH — will happen every week)
**Scenario:** Potential customer submits contact form. `contact_inquiries` row created in DB. No admin notification. Admin never checks the table directly. Inquiry sits unread for days. Customer assumes no one is home and tries a competitor.
**Root Cause:** No admin UI for contact inquiries; no email notification to admin on new inquiry.
**Fix:** S-complexity admin UI addition + 1 email notification in the contact form submission route.

### Failure 6: Job completion email silently not sent (Probability: HIGH — will happen for every completed job)
**Scenario:** Technician marks job complete. Completion notification email attempted. Insert into `notification_log` fails on UNIQUE constraint (same appointment already has `appointment_confirmation` log). The `.catch(() => {})` swallows the error. Customer never receives service completion email. Admin has no visibility.
**Root Cause:** Bug 1 above — completion uses wrong `notification_type`.
**Fix:** S-complexity — rename notification type in code + add new type to DB CHECK constraint.

### Failure 7: Second technician shows up to same job (Probability: LOW — occasional admin error)
**Scenario:** Admin accidentally assigns same appointment to two technicians (UI double-click, bulk assignment bug). No UNIQUE constraint on `assignments.appointment_id`. Both technicians receive notification. Both show up. Customer is confused.
**Root Cause:** IS-12 — no UNIQUE constraint on assignments.
**Fix:** 1 SQL statement (Fix F above).

---

## Final Priority Rankings

### Critical — Must Fix Before Real Users
| Fix | Complexity | Business Impact | Risk Reduction |
|-----|-----------|-----------------|----------------|
| Verify profile creation trigger (Fix E) | S | High | High |
| Past-due billing portal lockout (Fix D) | S | Critical | High |
| Assignment cascade on cancellation (Fix A) | S | Critical | High |
| Notification type fix for service completion (Fix G) | S | High | Medium |
| UNIQUE constraint on assignments (Fix F) | S | High | High |

### High — Must Fix in Sprint 1 (Week 1)
| Fix | Complexity | Business Impact | Risk Reduction |
|-----|-----------|-----------------|----------------|
| Annual subscription expiry cron (Fix C) | S | Critical | High |
| Subscription deleted → appointments cascade (Fix B) | M | Critical | High |
| Confirm appointment CHECK constraint allows en_route/in_progress | S | Medium | Medium |
| Employee deactivation → assignment cascade | S | Medium | Medium |

### Medium — Fix in Sprint 2 (Weeks 2-4)
| Fix | Complexity | Business Impact | Risk Reduction |
|-----|-----------|-----------------|----------------|
| Admin subscriptions management page | M | High | Medium |
| Contact inquiries admin UI + notification | S | High | Medium |
| Job media in admin visits page | M | Medium | Low |
| Annual plan expiry alert on Overview | S | Medium | Medium |
| Customer reschedule → employee notification | S | Medium | Medium |
| Confirm-booking failure recovery (appointment creation fallback) | L | High | Medium |

### Low — Post-Launch
| Fix | Complexity | Business Impact | Risk Reduction |
|-----|-----------|-----------------|----------------|
| `payment_method.detached` webhook handler | S | Low | Low |
| Weekly Stripe reconciliation job | M | Medium | Low |
| Lead capture at quote widget | M | High (growth) | Low (no ops risk) |
| Calendar view for appointments | L | Medium | Low |
| Revenue trend chart with real data | S | Medium | Low |
| Win-back email automation | M | Medium | Low |
