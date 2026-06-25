# INVALID STATE ANALYSIS
## Generated: 2026-05-29
## Scope: All entity state combinations that should never exist, with SQL detection queries

---

## IS-1: `appointments.status = 'canceled'` AND `assignments.status = 'scheduled'`

**Can It Happen?** YES — confirmed by code inspection.

**How:** Admin calls `PATCH /api/admin/appointments/:id/cancel` (`adminAppointments.ts` line 161). This sets `appointments.status = 'canceled'` but does NOT update the linked `assignments` row. The assignment remains in `status = 'scheduled'` indefinitely.

**Severity:** Critical

**Business Impact:** Technician drives to a canceled job. Fuel, time, and customer confusion.

**Prevention:** None. No DB trigger, no FK cascade, no application-level cascade in the cancel route.

```sql
-- IS-1: Canceled appointments with active assignments
SELECT
  a.id                   AS assignment_id,
  a.status               AS assignment_status,
  a.employee_id,
  ap.id                  AS appointment_id,
  ap.status              AS appointment_status,
  ap.scheduled_date,
  e.name                 AS technician_name
FROM public.assignments a
JOIN public.appointments ap ON a.appointment_id = ap.id
LEFT JOIN public.employees e ON a.employee_id = e.id
WHERE ap.status IN ('canceled', 'cancelled')
  AND a.status NOT IN ('canceled', 'cancelled', 'skipped', 'completed', 'no_show')
ORDER BY ap.scheduled_date DESC;
```

**Prevention Fix:** Add to both cancel routes:
```sql
UPDATE public.assignments
SET status = 'skipped', updated_at = NOW()
WHERE appointment_id = $appointmentId
  AND status NOT IN ('completed', 'skipped', 'no_show');
```

---

## IS-2: `appointments.status = 'completed'` AND `assignments.status = 'in_progress'`

**Can It Happen?** Unlikely but theoretically possible.

**How:** The completion cascade in `employeeAssignments.ts` (lines 212-223) updates `appointments.status = 'completed'` when `assignments.status = 'completed'`. However, if an admin manually sets `appointments.status = 'completed'` (via a direct admin update route not audited here) while the assignment is still `in_progress`, this state would exist. Also: if a race condition occurs where two concurrent status updates fire, the appointment could be completed before the assignment reaches `completed`.

**Severity:** Medium

**Business Impact:** Admin Visits page shows appointment complete but employee portal shows job still in progress. Reporting inconsistency.

```sql
-- IS-2: Completed appointments with in-progress assignments
SELECT
  ap.id                  AS appointment_id,
  ap.status              AS appointment_status,
  ap.scheduled_date,
  a.id                   AS assignment_id,
  a.status               AS assignment_status,
  e.name                 AS technician_name
FROM public.appointments ap
JOIN public.assignments a ON a.appointment_id = ap.id
LEFT JOIN public.employees e ON a.employee_id = e.id
WHERE ap.status = 'completed'
  AND a.status IN ('in_progress', 'en_route', 'scheduled')
ORDER BY ap.scheduled_date DESC;
```

**Prevention:** Add a DB trigger or application-level guard: when `appointments.status = 'completed'` is written, also set any non-terminal assignments to `completed`.

---

## IS-3: `subscriptions.status = 'active'` AND `current_period_end < now()` (annual plans)

**Can It Happen?** YES — confirmed by design analysis.

**How:** Annual subscriptions (`program = 'annual'`) have `current_period_end = purchase_date + 365 days` (written by `billingStripe.ts` `confirm-booking` line 673). No code ever transitions `status` from `active` to `expired` or `canceled` when that date passes. There is no Stripe Subscription object to generate a `customer.subscription.deleted` event. The `subscriptions` row remains `status = 'active'` indefinitely.

**Severity:** Critical

**Business Impact:** Service delivered after annual plan expires with no payment received. Revenue leakage.

```sql
-- IS-3: Annual subscriptions past their period end but still active
SELECT
  s.id,
  s.stripe_subscription_id,
  s.program,
  s.status,
  s.current_period_end,
  s.last_payment_at,
  p.name     AS customer_name,
  p.email,
  pr.address AS property_address
FROM public.subscriptions s
LEFT JOIN public.profiles p  ON s.user_id    = p.id
LEFT JOIN public.properties pr ON s.property_id = pr.id
WHERE s.program = 'annual'
  AND s.status  = 'active'
  AND s.current_period_end IS NOT NULL
  AND s.current_period_end < NOW()
ORDER BY s.current_period_end ASC;
```

**Prevention:** Add to Netlify scheduled function (`send-reminders.ts` or a dedicated `check-subscriptions.ts`):
```sql
UPDATE public.subscriptions
SET status     = 'expired',
    updated_at = NOW()
WHERE program           = 'annual'
  AND status            = 'active'
  AND current_period_end < NOW();
```

---

## IS-4: `subscriptions.status = 'active'` AND no corresponding Stripe subscription exists

**Can It Happen?** YES — via webhook delivery failure or manual Stripe Dashboard actions.

**How:** If a subscription is canceled directly in the Stripe Dashboard (not via application code), Stripe fires `customer.subscription.deleted`. If the Netlify webhook endpoint is down when this fires and all Stripe retry attempts (over 3 days) fail, the local `subscriptions.status` remains `active` indefinitely. For annual plans, there is never a Stripe Subscription object — the only "corresponding Stripe object" is the PaymentIntent, which cannot be deleted.

**Severity:** High

**Business Impact:** Customers receive service and access after their Stripe subscription is gone.

```sql
-- IS-4: Recurring subscriptions with suspicious staleness (proxy for Stripe mismatch)
-- Cannot directly query Stripe from SQL; use staleness proxy:
-- last_payment_at > (cadence_days + 14) days ago suggests subscription may have lapsed.
SELECT
  s.id,
  s.stripe_subscription_id,
  s.status,
  s.current_period_end,
  s.last_payment_at,
  s.cadence_days,
  p.name  AS customer_name,
  p.email
FROM public.subscriptions s
LEFT JOIN public.profiles p ON s.user_id = p.id
WHERE s.status = 'active'
  AND s.program = 'subscription'
  AND (
    s.current_period_end < NOW()
    OR s.last_payment_at < NOW() - (s.cadence_days || ' days')::INTERVAL - INTERVAL '14 days'
    OR s.last_payment_at IS NULL
  )
ORDER BY s.current_period_end ASC;
```

**Prevention:** Weekly Stripe reconciliation job that calls `GET /v1/subscriptions/{id}` for all locally-active subscriptions and patches discrepancies. Minimum: flag subscriptions where `current_period_end < NOW()` as `expired` or `past_due`.

---

## IS-5: `profiles` row missing for an `auth.users` user

**Can It Happen?** YES — if the DB trigger that creates `profiles` on `auth.users` INSERT is not deployed.

**How:** User signs up via Supabase Auth → `auth.users` row created. If no DB trigger exists (and none is in the application code migrations), no `profiles` row is created. The user can complete auth but billing, notifications, and the admin customer list will all fail to find their record.

**Severity:** Critical

**Business Impact:** New user cannot book (billing requires `profiles.stripe_customer_id`). Admin cannot see the customer. Notifications cannot be sent.

```sql
-- IS-5: auth.users without a profiles row
SELECT
  u.id   AS user_id,
  u.email,
  u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ORDER BY u.created_at DESC;
```

**Prevention:** Confirm Supabase DB trigger for profile creation is deployed. If not, add:
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email, 'customer')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## IS-6: `assignment` exists for an `employees.status = 'inactive'` employee

**Can It Happen?** YES — confirmed by analysis.

**How:** Admin assigns technician (creates `assignments` row with `employee_id`). Admin later deactivates employee via admin settings (`employees.status = 'inactive'`). Existing `assignments` rows are not updated. The inactive employee still has `scheduled` assignments.

**Severity:** Medium

**Business Impact:** Notifications may be sent to an inactive employee. The employee portal returns 401 for inactive employees (due to `getAuthenticatedEmployee()` checking `status = 'active'`), so the employee cannot complete the assignment. Admin employee tracking shows an inactive person with active assignments.

```sql
-- IS-6: Active assignments for inactive employees
SELECT
  a.id                   AS assignment_id,
  a.status               AS assignment_status,
  a.appointment_id,
  e.id                   AS employee_id,
  e.name                 AS employee_name,
  e.status               AS employee_status,
  ap.scheduled_date,
  ap.status              AS appointment_status
FROM public.assignments a
JOIN public.employees e  ON a.employee_id  = e.id
JOIN public.appointments ap ON a.appointment_id = ap.id
WHERE e.status = 'inactive'
  AND a.status IN ('scheduled', 'en_route', 'in_progress')
  AND ap.scheduled_date >= CURRENT_DATE
ORDER BY ap.scheduled_date ASC;
```

**Prevention:** Add to the employee deactivation route (when setting `employees.status = 'inactive'`):
```sql
UPDATE public.assignments
SET status = 'skipped'
WHERE employee_id = $employee_id
  AND status NOT IN ('completed', 'skipped', 'no_show')
  AND appointment_id IN (
    SELECT id FROM public.appointments WHERE scheduled_date >= CURRENT_DATE
  );
```

---

## IS-7: `job_media` row exists but parent `assignments.id` is missing

**Can It Happen?** NO — prevented by FK constraint.

**How:** Migration `2025-11-10_employee_portal.sql` line 69 defines:
```sql
assignment_id uuid not null references assignments(id) on delete cascade
```
If an `assignments` row is deleted, all linked `job_media` rows are cascade-deleted. Since the application never deletes `assignments` rows (only status-updates them), this is additionally protected at the application layer.

**Severity:** Low (cannot happen in normal operation)

```sql
-- IS-7: Orphaned job_media (should return 0 rows if FK constraint is deployed)
SELECT
  jm.id           AS media_id,
  jm.assignment_id,
  jm.media_type,
  jm.url,
  jm.created_at
FROM public.job_media jm
WHERE NOT EXISTS (
  SELECT 1 FROM public.assignments a WHERE a.id = jm.assignment_id
);
```

**Prevention:** Already protected by FK CASCADE. Verify the FK constraint is deployed:
```sql
SELECT constraint_name FROM information_schema.table_constraints
WHERE table_name = 'job_media' AND constraint_type = 'FOREIGN KEY';
```

---

## IS-8: `appointments` row exists but `properties.id` is missing

**Can It Happen?** UNKNOWN — depends on whether FK constraint is enforced.

**How:** The initial schema (`2025-02-23_initial_schema.sql`) defines `property_id uuid references public.properties(id) on delete cascade`. If this FK is enforced, deleting a property would cascade-delete all linked appointments. However, `confirm-booking` does not verify the property exists before creating the appointment (it trusts the client-provided `propertyId`). If the property was deleted between the client request and the appointment insert, the FK would reject the insert — which is correct behavior.

**More likely scenario:** The `property_id` column is nullable in the initial schema (no `NOT NULL` constraint), so appointments can be created with `property_id = NULL`. The admin manual create path may create appointments without a property.

**Severity:** Medium

```sql
-- IS-8: Appointments referencing non-existent properties
SELECT
  ap.id           AS appointment_id,
  ap.user_id,
  ap.property_id,
  ap.scheduled_date,
  ap.status,
  p.name          AS customer_name
FROM public.appointments ap
LEFT JOIN public.properties pr ON ap.property_id = pr.id
LEFT JOIN public.profiles p    ON ap.user_id      = p.id
WHERE ap.property_id IS NOT NULL
  AND pr.id IS NULL
ORDER BY ap.scheduled_date DESC;
```

**Also check for NULL property_id on active appointments:**
```sql
SELECT
  ap.id, ap.user_id, ap.scheduled_date, ap.status, p.name AS customer_name
FROM public.appointments ap
LEFT JOIN public.profiles p ON ap.user_id = p.id
WHERE ap.property_id IS NULL
  AND ap.status NOT IN ('canceled', 'cancelled', 'completed')
ORDER BY ap.scheduled_date DESC;
```

---

## IS-9: `marketplace_orders` paid but no `service_orders` created

**Can It Happen?** YES — edge case via race condition or Stripe API failure.

**How:** `checkout.session.completed` webhook fetches line items from Stripe API (hardened blocking call). If the Stripe API returns an error, the webhook throws and returns 400. Stripe retries for up to 3 days. If all retries fail (Stripe API persistent error or endpoint downtime), `marketplace_orders` row has `status = 'completed'` but no `marketplace_order_items` and no `service_orders`.

Additionally: if `payment_intent.succeeded` fires before `checkout.session.completed` and the `marketplace_orders` row doesn't exist yet, the `completedOrder` lookup returns null and logs a warning without creating `service_orders`.

**Severity:** Medium

```sql
-- IS-9: Completed marketplace orders without service_orders
SELECT
  mo.id                  AS order_id,
  mo.stripe_session_id,
  mo.stripe_payment_intent_id,
  mo.status,
  mo.total_cents,
  mo.created_at,
  mo.user_id,
  p.name                 AS customer_name,
  COUNT(moi.id)          AS item_count,
  COUNT(so.id)           AS service_order_count
FROM public.marketplace_orders mo
LEFT JOIN public.profiles p               ON p.id      = mo.user_id
LEFT JOIN public.marketplace_order_items moi ON moi.order_id = mo.id
LEFT JOIN public.service_orders so        ON so.marketplace_order_id = mo.id
WHERE mo.status = 'completed'
GROUP BY mo.id, p.name
HAVING COUNT(moi.id) = 0 OR COUNT(so.id) = 0
ORDER BY mo.created_at DESC;
```

---

## IS-10: `notification_log` row exists but `appointments.id` FK is null/invalid

**Can It Happen?** NO for invalid FK — `ON DELETE SET NULL` constraint (migration `2026-05-16_phase2`) nulls the `appointment_id` column if the appointment is deleted, rather than creating an orphan. Rows with `appointment_id = NULL` are valid by design (notifications not tied to a specific appointment).

However, notifications for appointments that are later deleted will have `appointment_id = NULL` — meaning historical notification records lose their appointment context.

**Severity:** Low

```sql
-- IS-10: Notification logs with orphaned appointment references (should return 0 if FK is deployed)
SELECT
  nl.id               AS log_id,
  nl.profile_id,
  nl.appointment_id,
  nl.notification_type,
  nl.status,
  nl.created_at
FROM public.notification_log nl
WHERE nl.appointment_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.appointments a WHERE a.id = nl.appointment_id
  );
```

---

## IS-11: `appointments.status = 'scheduled'` AND `subscriptions.status = 'canceled'`

**Can It Happen?** YES — confirmed gap from cascade analysis.

**How:** `customer.subscription.deleted` webhook sets `subscriptions.status = 'canceled'` but does NOT cancel future scheduled appointments. All future `scheduled` appointments for the canceled subscription remain in the table.

**Severity:** Critical

**Business Impact:** Technicians are dispatched to appointments for customers who have canceled. Admin scheduling queue may still show these appointments as pending work.

```sql
-- IS-11: Future scheduled appointments for canceled subscriptions
SELECT
  ap.id                  AS appointment_id,
  ap.scheduled_date,
  ap.status              AS appointment_status,
  s.id                   AS subscription_id,
  s.status               AS subscription_status,
  s.stripe_subscription_id,
  s.program,
  p.name                 AS customer_name,
  p.email
FROM public.appointments ap
JOIN public.profiles p ON ap.user_id = p.id
LEFT JOIN public.subscriptions s
  ON s.user_id = ap.user_id
  AND s.property_id = ap.property_id
WHERE ap.scheduled_date >= CURRENT_DATE
  AND ap.status = 'scheduled'
  AND s.status IN ('canceled', 'past_due', 'expired')
ORDER BY ap.scheduled_date ASC;
```

---

## IS-12: Multiple `assignments` for the same `appointment_id` both in active status

**Can It Happen?** POSSIBLY — the upsert in `adminAppointments.ts` (line 235) uses `onConflict: "appointment_id"` which prevents duplicate assignments per appointment. However, if the `UNIQUE` constraint on `(appointment_id)` in the `assignments` table was not created in the migration, the `onConflict` would silently insert duplicates.

**Check:** Migration `2025-11-10_employee_portal.sql` for `assignments` table does NOT show a UNIQUE constraint on `appointment_id`. The initial schema creates `assignments` with `appointment_id uuid not null references appointments(id) on delete cascade` — no UNIQUE constraint. The upsert would fail to deduplicate.

**Severity:** High

**Business Impact:** Two technicians assigned to the same appointment. Both receive notification. Both may show up.

```sql
-- IS-12: Appointments with multiple active assignments
SELECT
  ap.id                    AS appointment_id,
  ap.scheduled_date,
  ap.status                AS appointment_status,
  COUNT(a.id)              AS assignment_count,
  STRING_AGG(e.name, ', ') AS assigned_technicians
FROM public.appointments ap
JOIN public.assignments a ON a.appointment_id = ap.id
LEFT JOIN public.employees e ON a.employee_id = e.id
WHERE a.status NOT IN ('skipped', 'canceled', 'no_show', 'completed')
  AND ap.scheduled_date >= CURRENT_DATE
GROUP BY ap.id, ap.scheduled_date, ap.status
HAVING COUNT(a.id) > 1
ORDER BY ap.scheduled_date ASC;
```

**Prevention:** Add a UNIQUE constraint on `assignments.appointment_id`:
```sql
ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_appointment_id_uq UNIQUE (appointment_id);
```
Note: This would prevent reassigning an appointment to a different technician via upsert. If reassignment is needed, the old assignment must be skipped first.

---

## Summary Risk Matrix

| ID | Description | Can Happen? | Severity | Prevention Exists? |
|----|-------------|-------------|---------|-------------------|
| IS-1 | Canceled appt + active assignment | YES | Critical | None |
| IS-2 | Completed appt + in-progress assignment | Unlikely | Medium | None |
| IS-3 | Active annual sub past current_period_end | YES | Critical | None |
| IS-4 | Active sub, no Stripe subscription | YES (webhook gap) | High | Partial (webhook) |
| IS-5 | auth.users without profiles row | YES (if trigger missing) | Critical | Depends on trigger deployment |
| IS-6 | Active assignments for inactive employee | YES | Medium | None |
| IS-7 | Orphaned job_media | NO (FK CASCADE) | Low | FK constraint |
| IS-8 | Appointment without property | Unknown (nullable FK) | Medium | Partial (FK may enforce) |
| IS-9 | Paid marketplace order without service_order | YES (race condition) | Medium | Partial (webhook retry) |
| IS-10 | Orphaned notification_log | NO (ON DELETE SET NULL) | Low | FK constraint |
| IS-11 | Scheduled appt for canceled subscription | YES | Critical | None |
| IS-12 | Multiple active assignments per appointment | YES (no UNIQUE constraint) | High | None |
