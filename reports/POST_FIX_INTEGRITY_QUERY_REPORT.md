# Post-Fix Integrity Query Report
**Sprint:** Final Operational Verification Sprint  
**Date:** 2026-05-29

All queries below are valid PostgreSQL and can be pasted directly into the Supabase SQL Editor. They verify that the eight integrity fixes deployed in this sprint are functioning correctly. Run these queries after applying the three migrations.

---

## IS-1 — Canceled Appointments with Active Assignments

**What it checks:** Any appointment in a canceled state that still has a non-terminal assignment — the employee would show up to a canceled job.

**Expected after fix:** Zero rows. The `adminAppointments.ts` cancel handler now cascades to skip all non-terminal assignments when an appointment is canceled. The `customer.subscription.deleted` webhook does the same for subscription cancellations.

```sql
-- IS-1: Canceled appointments with active assignments (SHOULD BE EMPTY after fix)
SELECT a.id AS appointment_id, a.status AS appt_status,
       asgn.id AS assignment_id, asgn.status AS asgn_status,
       asgn.employee_id
FROM public.appointments a
JOIN public.assignments asgn ON asgn.appointment_id = a.id
WHERE a.status IN ('canceled','cancelled','canceled_by_admin','canceled_by_customer')
  AND asgn.status NOT IN ('completed','skipped','canceled','cancelled','no_show');
```

**If rows returned:** The cascade logic did not fire for those specific appointments. Manually update: `UPDATE public.assignments SET status = 'skipped' WHERE appointment_id = '<id>' AND status NOT IN ('completed','skipped','no_show','canceled','cancelled');`

---

## IS-3 — Active Annual Subscriptions Past Period End

**What it checks:** Annual plan subscriptions still marked `active` after their `current_period_end` date. These should have been expired by the `expire-annual-plans` Netlify function.

**Expected after fix:** Zero rows once the scheduled function has run. If the function has not run yet since deployment, rows may appear — this is normal. Run the function manually via Netlify Dashboard → Functions to trigger immediately.

```sql
-- IS-3: Active annual subscriptions past current_period_end (SHOULD BE EMPTY after fix)
SELECT id, user_id, status, program, current_period_end
FROM public.subscriptions
WHERE program = 'annual'
  AND status = 'active'
  AND current_period_end IS NOT NULL
  AND current_period_end < NOW();
```

**If rows returned and function has run:** The function may have encountered an error. Check Netlify function logs for `[expire-annual-plans]` error lines. Also verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly in Netlify.

---

## IS-5 — Auth Users Without Profiles

**What it checks:** Users who have authenticated (auth.users row) but have no corresponding profile row. These users cannot complete billing, appear in admin lists, or receive notifications.

**Expected after fix:** Zero rows — after both the trigger is deployed AND the backfill query has been run.

```sql
-- IS-5: Auth users without profiles (SHOULD BE EMPTY after trigger + backfill)
SELECT u.id, u.email, u.created_at
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
);
```

**If rows returned:** The backfill query has not been run yet, or it failed due to RLS. Run the backfill query from the Supabase Deployment Verification Checklist. If that still fails, check that you are running as the service role (not anon) in the SQL Editor.

---

## IS-11 — Scheduled Appointments for Canceled Subscriptions

**What it checks:** Future appointments that are still in a scheduled/active state for users whose subscriptions have been canceled or expired. These appointments should have been canceled when the subscription was deleted.

**Expected after fix:** Zero rows for newly canceled subscriptions. Pre-existing rows from before the webhook fix was deployed may still appear — those require manual remediation.

```sql
-- IS-11: Scheduled appointments for canceled subscriptions
SELECT a.id, a.status AS appt_status, a.scheduled_date, a.user_id,
       s.status AS sub_status, s.stripe_subscription_id
FROM public.appointments a
JOIN public.subscriptions s ON s.user_id = a.user_id
WHERE s.status IN ('canceled','expired')
  AND a.status NOT IN ('completed','canceled','cancelled','canceled_by_admin','canceled_by_customer')
  AND a.scheduled_date >= CURRENT_DATE;
```

**If rows returned:** Cancel them manually:
```sql
UPDATE public.appointments
SET status = 'canceled'
WHERE id IN (<appointment_ids from above>);

UPDATE public.assignments
SET status = 'skipped'
WHERE appointment_id IN (<appointment_ids from above>)
  AND status NOT IN ('completed','skipped','no_show','canceled','cancelled');
```

---

## IS-12 — Duplicate Active Assignments Per Appointment

**What it checks:** Appointments with more than one non-terminal assignment — two technicians assigned to the same job simultaneously.

**Expected after fix:** Zero rows. The uniqueness migration cleanup step removed pre-existing duplicates, and the partial UNIQUE index prevents new ones.

```sql
-- IS-12: Duplicate active assignments per appointment (SHOULD BE EMPTY after index)
SELECT appointment_id, COUNT(*) AS active_count,
       array_agg(id) AS assignment_ids,
       array_agg(status) AS statuses
FROM public.assignments
WHERE status NOT IN ('completed','skipped','canceled','cancelled','no_show')
GROUP BY appointment_id
HAVING COUNT(*) > 1;
```

**If rows returned:** The uniqueness migration index may not have been applied yet. Check that `assignments_appointment_id_active_unique` exists (see Supabase Deployment Verification Checklist Step 3). If the index exists, the duplicates appeared after migration — investigate the assignment creation path.

---

## Check 6 — Completion Notifications Using Wrong Type

**What it checks:** Recent notification_log entries that used `appointment_confirmation` as the type within the last 7 days on appointments that are marked completed — which would indicate the old incorrect code path is still being used.

**Expected after fix:** Zero rows. The `employeeAssignments.ts` completion handler now uses `notification_type: "service_completed"`.

```sql
-- Check 6: Completion notifications using wrong type (SHOULD BE EMPTY after fix)
SELECT nl.id, nl.appointment_id, nl.notification_type, nl.created_at
FROM public.notification_log nl
WHERE nl.notification_type = 'appointment_confirmation'
  AND nl.created_at > NOW() - INTERVAL '7 days'
  AND EXISTS (
    SELECT 1 FROM public.assignments asgn
    WHERE asgn.appointment_id = nl.appointment_id
      AND asgn.status = 'completed'
  );
```

**If rows returned:** These entries are from the old code. They are historical and do not need to be deleted. Verify the deployed server code is the updated version by checking the Netlify function deployment timestamp.

---

## Check 7 — Future Assignments for Inactive Employees

**What it checks:** Non-terminal assignments for future appointments where the assigned employee is not in `active` status — an inactive or terminated employee would be expected to show up.

**Expected after fix:** Zero rows (no code fix for this specific case, but it is a data hygiene check).

```sql
-- Check 7: Future assignments for inactive employees
SELECT asgn.id, asgn.employee_id, asgn.status, a.scheduled_date
FROM public.assignments asgn
JOIN public.appointments a ON a.id = asgn.appointment_id
JOIN public.employees e ON e.id = asgn.employee_id
WHERE e.status != 'active'
  AND asgn.status NOT IN ('completed','skipped','canceled','cancelled','no_show')
  AND a.scheduled_date >= CURRENT_DATE;
```

**If rows returned:** Manually reassign or skip these assignments. The assigned employee is inactive and cannot be expected to complete the service. Update their assignments to `skipped` and reassign the appointments.

---

## Check 8 — Future Appointments with Missing Property or Profile

**What it checks:** Upcoming appointments where the customer profile or property record no longer exists — the appointment cannot be serviced and would cause lookup errors.

**Expected after fix:** Zero rows (referential integrity should be maintained by the DB schema).

```sql
-- Check 8: Future appointments with missing property or profile
SELECT a.id, a.user_id, a.property_id, a.scheduled_date
FROM public.appointments a
WHERE a.scheduled_date >= CURRENT_DATE
  AND a.status NOT IN ('completed','canceled','cancelled','canceled_by_admin','canceled_by_customer')
  AND (
    NOT EXISTS (SELECT 1 FROM public.properties p WHERE p.id = a.property_id)
    OR NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = a.user_id)
  );
```

**If rows returned:** These are orphaned appointments. Cancel them and investigate how the property or profile was deleted without cascading to appointments.

---

## Check 9 — Potentially Stale Card Cache (Manual Spot-Check)

**What it checks:** Profiles with card display information (last4, brand, expiry) cached locally. Cannot be automatically validated without Stripe API access — flag for manual spot-check.

**Expected:** Non-empty (this is informational, not an error indicator). Spot-check a few records against Stripe Dashboard to confirm the cached values are current.

```sql
-- Check 9: Potentially stale card cache — manual spot-check
SELECT id, email, card_last4, card_brand, card_expiry
FROM public.profiles
WHERE card_last4 IS NOT NULL
ORDER BY updated_at DESC
LIMIT 20;
```

**How to verify:** Take 2-3 customer IDs from this result and look them up in the Stripe Dashboard → Customers. Confirm the card ending in `card_last4` with `card_brand` is the default payment method. If there is a mismatch, the card sync from the `invoice.paid` webhook has not run for that customer yet — it will self-correct on their next billing cycle.
