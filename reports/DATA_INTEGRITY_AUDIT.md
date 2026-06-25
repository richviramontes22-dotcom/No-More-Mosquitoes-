# DATA INTEGRITY AUDIT
## Generated: 2026-05-29
## Scope: Can the database reach inconsistent states? What prevents it? How do you detect it?

---

## Scenario 1: Appointment Canceled But Assignment Still `scheduled`

**Risk Level:** Critical

**Is It Possible?** Yes — confirmed by code inspection.

**Root Cause:**
- `PATCH /api/admin/appointments/:id/cancel` in `server/routes/adminAppointments.ts` (lines 144–205): updates `appointments.status = "canceled"`. Does NOT touch the `assignments` table.
- `POST /api/appointments/:id/reschedule` is the only customer-facing appointment mutation in `server/routes/customerAppointments.ts`; there is no customer cancel route in that file. Customer cancellation appears to go through Stripe portal (`cancel-subscription`) which does not cancel individual appointments.
- Neither route updates `assignments.status`.

**Prevention:** None. No DB trigger, no CASCADE, no application-level cascade.

**SQL Diagnostic Query:**
```sql
SELECT
  a.id AS assignment_id,
  a.status AS assignment_status,
  a.employee_id,
  ap.id AS appointment_id,
  ap.status AS appointment_status,
  ap.scheduled_date,
  e.name AS technician_name
FROM assignments a
JOIN appointments ap ON a.appointment_id = ap.id
LEFT JOIN employees e ON a.employee_id = e.id
WHERE ap.status IN ('canceled', 'cancelled')
  AND a.status NOT IN ('canceled', 'cancelled', 'skipped', 'completed')
ORDER BY ap.scheduled_date;
```

**Recommended Fix:**
Add to both cancel routes:
```sql
UPDATE assignments SET status = 'skipped', updated_at = NOW()
WHERE appointment_id = $appointmentId
  AND status NOT IN ('completed', 'skipped');
```
Alternatively, add a PostgreSQL trigger on `appointments` that cascades status changes to linked `assignments`.

---

## Scenario 2: Subscription Active Locally But Canceled in Stripe

**Risk Level:** High

**Is It Possible?** Partially mitigated, but a gap exists.

**Root Cause Analysis:**
- `customer.subscription.deleted` webhook IS handled in `webhooksStripe.ts` (lines 582–589): sets `subscriptions.status = "canceled"`.
- `customer.subscription.updated` webhook IS handled (lines 559–579): syncs non-active status changes.
- However: webhook delivery is not guaranteed. If the Stripe webhook endpoint is unreachable (e.g., Netlify function cold start timeout, deployment outage), the deletion event may be lost. Stripe retries webhooks for up to 3 days. If retries also fail, the local record stays `active`.
- Additionally, subscriptions canceled directly in the Stripe Dashboard (not via the application `cancel-subscription` route) rely 100% on the webhook. There is no polling or reconciliation job.

**Prevention:** Webhook handler exists. No periodic Stripe-to-DB reconciliation job.

**SQL Diagnostic Query (requires knowing Stripe subscription IDs):**
```sql
-- Find local subscriptions marked active but potentially stale
-- (no payment in more than 45 days suggests Stripe may have canceled)
SELECT
  s.id,
  s.stripe_subscription_id,
  s.status,
  s.current_period_end,
  s.last_payment_at,
  p.name AS customer_name,
  p.email
FROM subscriptions s
LEFT JOIN profiles p ON s.user_id = p.id
WHERE s.status = 'active'
  AND (
    s.current_period_end < NOW()
    OR s.last_payment_at < NOW() - INTERVAL '45 days'
  )
ORDER BY s.current_period_end;
```

**Recommended Fix:**
Build a daily reconciliation job (Netlify scheduled function) that calls `GET /v1/subscriptions?customer={id}` for all locally-active subscriptions and patches discrepancies. At minimum, flag subscriptions where `current_period_end < NOW()` as `expired` or `past_due`.

---

## Scenario 3: Annual Subscription Expired But Still `active`

**Risk Level:** High

**Is It Possible?** Yes — by design for annual plans.

**Root Cause:**
- Annual plans use a Stripe PaymentIntent (not a Stripe Subscription). There is no `customer.subscription.deleted` webhook for annual plans because no Stripe Subscription object exists.
- `current_period_end` is set to `now + 365 days` in `confirm-booking` (line 675: `periodEnd.setFullYear(periodEnd.getFullYear() + 1)`).
- No application code, cron job, or trigger flips `subscriptions.status` from `active` to `expired` or `canceled` when `current_period_end` passes.
- No Netlify scheduled function checks for expired annual plans.

**Prevention:** None. The `subscriptions` table has no expiry trigger.

**SQL Diagnostic Query:**
```sql
SELECT
  s.id,
  s.stripe_subscription_id,
  s.program,
  s.status,
  s.current_period_end,
  s.last_payment_at,
  p.name AS customer_name,
  p.email,
  pr.address AS property_address
FROM subscriptions s
LEFT JOIN profiles p ON s.user_id = p.id
LEFT JOIN properties pr ON s.property_id = pr.id
WHERE s.program = 'annual'
  AND s.status = 'active'
  AND s.current_period_end < NOW()
ORDER BY s.current_period_end;
```

**Recommended Fix:**
Add to the daily scheduled function (`generate-appointments` or a new `check-expired-subscriptions` function):
```sql
UPDATE subscriptions
SET status = 'expired', updated_at = NOW()
WHERE program = 'annual'
  AND status = 'active'
  AND current_period_end < NOW();
```
Also: generate an alert email to the customer 30 days before expiry to prompt renewal.

---

## Scenario 4: Assignment Exists But Employee Is Inactive

**Risk Level:** Medium

**Is It Possible?** Yes.

**Root Cause:**
- The admin assignment upsert (`POST /api/admin/assignments`) fetches the employee record and verifies it exists, but does NOT check `employees.status = "active"`.
- A deactivated employee (status changed to `inactive` via `/admin/employees` PATCH endpoint) can have existing `assignments` rows that remain in `status = "scheduled"`.
- There is no FK constraint preventing assignment to inactive employees (FK exists to `employees.id` but no CHECK on `employees.status`).

**Prevention:** No DB constraint. No application-level guard at assignment time for inactive check beyond existence check.

**SQL Diagnostic Query:**
```sql
SELECT
  a.id AS assignment_id,
  a.status AS assignment_status,
  a.appointment_id,
  e.id AS employee_id,
  e.name AS employee_name,
  e.status AS employee_status,
  ap.scheduled_date
FROM assignments a
JOIN employees e ON a.employee_id = e.id
JOIN appointments ap ON a.appointment_id = ap.id
WHERE e.status = 'inactive'
  AND a.status IN ('scheduled', 'en_route', 'in_progress')
  AND ap.scheduled_date >= CURRENT_DATE
ORDER BY ap.scheduled_date;
```

**Recommended Fix:**
Add a guard in the assignment upsert route:
```sql
-- Check before inserting
SELECT COUNT(*) FROM employees WHERE id = $employee_id AND status = 'active';
```
Return 400 if count = 0. Also add a DB constraint or trigger to prevent scheduled assignments to inactive employees.

---

## Scenario 5: Appointment Exists But Property Is Missing

**Risk Level:** Medium

**Is It Possible?** Unknown (requires DB query to confirm constraint exists).

**Root Cause:**
- `appointments.property_id` should have a FK constraint to `properties.id`. If the constraint exists with `ON DELETE SET NULL` or `ON DELETE RESTRICT`, this scenario is either allowed (NULL property_id) or prevented (deletion blocked).
- The application does allow `appointment.property_id` to be NULL in some code paths (the parcel quote flow for anonymous visitors, and the admin create path in `Overview.tsx` that only passes `property_id` if `schedulingTarget.property_id` is non-null).
- No admin UI blocks creating appointments without a property.

**Prevention:** Depends on whether the FK constraint was deployed in migrations. Must be verified in Supabase.

**SQL Diagnostic Query:**
```sql
SELECT
  a.id AS appointment_id,
  a.user_id,
  a.property_id,
  a.scheduled_date,
  a.status,
  p.name AS customer_name
FROM appointments a
LEFT JOIN properties pr ON a.property_id = pr.id
LEFT JOIN profiles p ON a.user_id = p.id
WHERE a.property_id IS NOT NULL
  AND pr.id IS NULL
ORDER BY a.scheduled_date;
```

**Recommended Fix:**
Verify FK constraint in Supabase: `ALTER TABLE appointments ADD CONSTRAINT fk_appt_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT;`

---

## Scenario 6: `job_media` Exists But Parent Assignment/Appointment Deleted

**Risk Level:** Low

**Is It Possible?** Unknown (depends on FK constraints in the `job_media` table migration).

**Root Cause:**
- `job_media` table exists (referenced in `ADMIN_GAP_ANALYSIS.md` and migration files).
- If `job_media` has FK constraints with `ON DELETE CASCADE`, rows are automatically removed when the parent assignment or appointment is deleted.
- If no FK constraint exists, deleting an assignment or appointment would leave orphaned `job_media` rows with a dangling reference.
- The application does not expose delete functionality for appointments or assignments in the admin UI (cancel is a status change, not a DELETE operation). The risk materializes only if rows are deleted directly via SQL or Supabase dashboard.

**Prevention:** Application-level: deletions not exposed in UI. DB-level: unknown without reading the migration.

**SQL Diagnostic Query:**
```sql
SELECT
  jm.id AS media_id,
  jm.assignment_id,
  jm.appointment_id,
  jm.uploaded_at
FROM job_media jm
WHERE
  (jm.assignment_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM assignments a WHERE a.id = jm.assignment_id))
  OR
  (jm.appointment_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM appointments ap WHERE ap.id = jm.appointment_id));
```

**Recommended Fix:**
Ensure FK constraints in `job_media` migration:
```sql
ALTER TABLE job_media
  ADD CONSTRAINT fk_media_assignment FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_media_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;
```

---

## Scenario 7: Marketplace Order Paid But `service_orders` Not Created

**Risk Level:** Medium

**Is It Possible?** Mitigated for webhook paths, but edge cases exist.

**Root Cause Analysis:**
- `checkout.session.completed` webhook (lines 201–211): calls `createMarketplaceAddOnServiceOrder()` after inserting `marketplace_order_items`. If line item fetching fails, the webhook throws an error (hardened to be blocking, not fire-and-forget). Stripe will retry — eventual consistency.
- `payment_intent.succeeded` webhook (lines 650–676): also calls `createMarketplaceAddOnServiceOrder()` for marketplace orders that already exist.
- Edge case: If `checkout.session.completed` fires and line_items fetch from Stripe API fails, the webhook throws and returns 400. Stripe retries. After 3 days of retries, the order would be in `marketplace_orders` with `status="completed"` but no `marketplace_order_items` and no `service_order`. This was hardened (per code comments) to be blocking.
- Edge case 2: If `payment_intent.succeeded` fires first (before `checkout.session.completed`), the `marketplace_orders` row may not exist yet, causing the `completedOrder` lookup to return null and log a warning without creating a service_order.

**Prevention:** Webhook retry mechanism. Blocking error on line_item fetch failure.

**SQL Diagnostic Query:**
```sql
SELECT
  mo.id AS order_id,
  mo.stripe_session_id,
  mo.stripe_payment_intent_id,
  mo.status,
  mo.total_cents,
  mo.created_at,
  mo.user_id,
  COUNT(moi.id) AS item_count,
  COUNT(so.id) AS service_order_count
FROM marketplace_orders mo
LEFT JOIN marketplace_order_items moi ON moi.order_id = mo.id
LEFT JOIN service_orders so ON so.marketplace_order_id = mo.id
WHERE mo.status = 'completed'
GROUP BY mo.id
HAVING COUNT(moi.id) = 0 OR COUNT(so.id) = 0
ORDER BY mo.created_at DESC;
```

**Recommended Fix:**
Add a daily reconciliation job that checks for completed marketplace orders without service_orders and re-creates them. Also add a Supabase DB constraint or trigger to prevent a marketplace order from transitioning to `completed` without at least one `marketplace_order_items` row.

---

## Scenario 8: `profiles.card_last4` Shows Stale Card Info

**Risk Level:** Medium

**Is It Possible?** Yes.

**Root Cause:**
- `profiles.card_last4`, `card_brand`, and `card_expiry` are written in two places:
  1. `POST /api/billing/attach-payment-method` (line 1087): updates when customer attaches new card
  2. `invoice.paid` webhook (lines 503–520): syncs from payment method on successful renewal payment
- These fields are NOT cleared when a card is removed from Stripe.
- The `payment_method.detached` Stripe webhook event is NOT handled in `webhooksStripe.ts`.
- If a customer removes their card from Stripe (via Stripe Dashboard or Customer Portal), `profiles.card_last4` will still show the old card details until a new payment method is attached.

**Prevention:** None. No webhook for card removal.

**SQL Diagnostic Query:**
```sql
-- Find profiles that have card info but whose subscription is canceled or there was no recent payment
SELECT
  p.id,
  p.name,
  p.email,
  p.card_last4,
  p.card_brand,
  p.card_expiry,
  s.status AS subscription_status,
  MAX(pay.created_at) AS last_payment_at
FROM profiles p
LEFT JOIN subscriptions s ON s.user_id = p.id AND s.status != 'canceled'
LEFT JOIN payments pay ON pay.user_id = p.id
WHERE p.card_last4 IS NOT NULL
GROUP BY p.id, p.name, p.email, p.card_last4, p.card_brand, p.card_expiry, s.status
HAVING MAX(pay.created_at) < NOW() - INTERVAL '60 days'
   OR MAX(pay.created_at) IS NULL;
```

**Recommended Fix:**
Handle `payment_method.detached` webhook:
```typescript
case "payment_method.detached": {
  const pm = object as any;
  // Clear card info from profiles where this PM was the stored card
  // Note: requires knowing which customer owns this PM
  break;
}
```
Better approach: on `customer.subscription.deleted` or `customer.updated`, re-fetch the customer's current default payment method and sync (or clear) card fields.

---

## Scenario 9: Recurring Appointment Generated After Subscription Cancellation

**Risk Level:** High

**Is It Possible?** Yes, if the scheduling queue is checked and appointments manually created without verifying subscription status.

**Root Cause:**
- The "Scheduling Queue" on the admin Overview page (`GET /api/admin/subscriptions/needs-scheduling`) queries subscriptions where `status = "active"`. If subscription status is correctly set to `canceled` before admin checks the queue, the customer would not appear.
- However, there is a window between the time Stripe fires `customer.subscription.deleted` and the time the webhook is processed. During this window, a subscription may appear `active` in the local DB while already canceled in Stripe.
- If the `generate-appointments` Netlify function runs during this window, it may create appointments for subscriptions that are about to be canceled.
- The `generate-appointments` function (in `netlify/functions/`) presumably checks `subscriptions.status = "active"` before generating, but the Stripe cancellation delay creates a race condition.

**Prevention:**
- Scheduling queue filters by `status = "active"` — partial protection
- Manual admin creation requires admin to not act during the race window — human process control
- Webhook handler exists but timing gap is real

**SQL Diagnostic Query:**
```sql
SELECT
  ap.id AS appointment_id,
  ap.scheduled_date,
  ap.status AS appointment_status,
  s.id AS subscription_id,
  s.status AS subscription_status,
  s.stripe_subscription_id,
  p.name AS customer_name
FROM appointments ap
JOIN subscriptions s ON s.user_id = ap.user_id AND s.property_id = ap.property_id
JOIN profiles p ON ap.user_id = p.id
WHERE ap.scheduled_date >= CURRENT_DATE
  AND ap.status = 'scheduled'
  AND s.status IN ('canceled', 'past_due', 'expired')
ORDER BY ap.scheduled_date;
```

**Recommended Fix:**
Before generating any appointment, always re-verify subscription status against Stripe API in addition to local DB check. Add a validation step to the scheduling function:
```
if (localStatus === 'active' && timeSinceLastPayment > cadence_days + 7):
  recheck Stripe API status
```

---

## Scenario 10: `notification_log` References Deleted User/Appointment

**Risk Level:** Low

**Is It Possible?** Unknown (depends on FK constraints in migrations).

**Root Cause:**
- `notification_log` stores `profile_id` and `appointment_id` references.
- If these are FK columns without `ON DELETE CASCADE` or `ON DELETE SET NULL`, deleting a profile or appointment would violate the FK constraint and fail the delete.
- If there are no FK constraints, the notification_log rows would have dangling references.
- The application does not expose delete operations for profiles or appointments via the admin UI (only status changes), so the risk is low in normal operation. Direct DB manipulation is the only path to this state.

**Prevention:** Application-level: no delete UI. DB-level: unknown without reading migration.

**SQL Diagnostic Query:**
```sql
SELECT
  nl.id AS log_id,
  nl.profile_id,
  nl.appointment_id,
  nl.notification_type,
  nl.created_at
FROM notification_log nl
WHERE
  (nl.profile_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = nl.profile_id))
  OR
  (nl.appointment_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.id = nl.appointment_id));
```

**Recommended Fix:**
Add FK constraints with `ON DELETE SET NULL` behavior so notification history is preserved but references are nulled when parent rows are deleted:
```sql
ALTER TABLE notification_log
  ADD CONSTRAINT fk_notif_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_notif_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL;
```

---

## Summary Risk Matrix

| Scenario | Risk Level | Is It Possible? | Prevention Exists? | Production Risk |
|----------|-----------|-----------------|-------------------|-----------------|
| 1. Canceled appointment, active assignment | Critical | Yes — confirmed | None | Technicians drive to canceled jobs |
| 2. Active locally, canceled in Stripe | High | Yes (webhook gap) | Partial (webhook exists) | Customers billed/serviced after canceling |
| 3. Annual subscription expired, still active | High | Yes — by design | None | Service delivered after coverage ends |
| 4. Assignment to inactive employee | Medium | Yes | None | Dead assignments; technician notifications sent to inactive person |
| 5. Appointment without property | Medium | Unknown | Unknown (needs DB verification) | Scheduling/routing errors |
| 6. Orphaned job_media | Low | Low (no delete UI) | Partial (app-level) | Storage waste, stale references |
| 7. Marketplace order without service_order | Medium | Edge case (webhook retry) | Partial (blocking error) | Fulfillment not tracked |
| 8. Stale card info in profiles | Medium | Yes — confirmed | None | Misleading card info displayed to customer |
| 9. Appointment after cancellation (race) | High | Yes (timing window) | Partial (status filter) | Future appointments for canceled customers |
| 10. notification_log orphaned references | Low | Low (no delete UI) | Partial (app-level) | Data quality only |

---

## Priority Fixes by Risk

1. **Scenario 1** (Critical): Add assignment cascade on appointment cancellation — 1 line in each cancel route.
2. **Scenario 9** (High): Add next-appointment validation against subscription status before generation.
3. **Scenario 3** (High): Add daily cron to expire annual subscriptions past `current_period_end`.
4. **Scenario 2** (High): Add weekly Stripe reconciliation job for subscription status.
5. **Scenario 8** (Medium): Handle `payment_method.detached` webhook or clear card fields on subscription deletion.
6. **Scenario 4** (Medium): Add active status check in assignment upsert route.
7. **Scenario 7** (Medium): Add daily reconciliation for completed marketplace orders without service_orders.
