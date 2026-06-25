# Phase 4 — Database Integrity Verification Report
**Date:** 2026-05-30
**Sprint:** Production Verification & Operational Readiness Sprint

---

## Summary

This report provides ready-to-run SQL diagnostic queries for the Supabase SQL Editor. The agent cannot connect to Supabase directly. All queries are based on verified migration file contents and schema knowledge from prior sprint analysis.

---

## Check 1: Auth Users Without Profiles

**Risk:** Users who signed up before the profile trigger was deployed have no profile row. This breaks billing, admin visibility, and email notifications.

**Query:**
```sql
SELECT au.id, au.email, au.created_at
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ORDER BY au.created_at DESC;
```

**Expected PASS:** 0 rows returned.

**If rows returned:** Run the backfill query:
```sql
INSERT INTO public.profiles (id, name, email, role, created_at)
SELECT
  au.id,
  COALESCE(
    au.raw_user_meta_data->>'name',
    au.raw_user_meta_data->>'full_name',
    split_part(au.email, '@', 1)
  ),
  au.email,
  'customer',
  NOW()
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
```

---

## Check 2: Canceled Appointments with Active Assignments

**Risk:** Assignments left in active states for canceled appointments will appear on employee dashboards and skew operational reports.

**Query:**
```sql
SELECT
  a.id AS appointment_id,
  a.status AS appointment_status,
  a.scheduled_date,
  asgn.id AS assignment_id,
  asgn.status AS assignment_status,
  asgn.employee_id
FROM appointments a
JOIN assignments asgn ON asgn.appointment_id = a.id
WHERE a.status IN ('canceled', 'cancelled')
  AND asgn.status NOT IN ('completed', 'skipped', 'no_show', 'canceled', 'cancelled')
ORDER BY a.scheduled_date DESC;
```

**Expected PASS:** 0 rows returned.

**If rows returned:** These are orphaned assignments from before the cascade logic was deployed. Clean up with:
```sql
UPDATE public.assignments
SET status = 'skipped'
WHERE appointment_id IN (
  SELECT id FROM appointments
  WHERE status IN ('canceled', 'cancelled')
)
AND status NOT IN ('completed', 'skipped', 'no_show', 'canceled', 'cancelled');
```

---

## Check 3: Duplicate Active Assignments Per Appointment

**Risk:** Two technicians assigned to the same appointment simultaneously — operational confusion and safety issue.

**Query:**
```sql
SELECT
  appointment_id,
  COUNT(*) AS active_assignment_count,
  array_agg(id) AS assignment_ids,
  array_agg(employee_id) AS employee_ids,
  array_agg(status) AS statuses
FROM assignments
WHERE status NOT IN ('completed', 'skipped', 'no_show', 'canceled', 'cancelled')
GROUP BY appointment_id
HAVING COUNT(*) > 1
ORDER BY active_assignment_count DESC;
```

**Expected PASS:** 0 rows returned.

**Note:** The assignment uniqueness migration should have cleaned up any existing duplicates. If rows appear, the migration may not have been applied with the cleanup step. Remediate by manually reviewing and removing the older duplicate (keeping the most recent).

---

## Check 4: Future Appointments for Users Without Active Subscriptions

**Risk:** Orphaned appointments for customers whose subscriptions were canceled — customers may show up without valid service.

**Query:**
```sql
SELECT
  a.id AS appointment_id,
  a.user_id,
  a.scheduled_date,
  a.status AS appointment_status,
  p.email AS customer_email,
  s.status AS subscription_status
FROM appointments a
LEFT JOIN subscriptions s ON s.user_id = a.user_id
  AND s.status IN ('active', 'past_due')
LEFT JOIN profiles p ON p.id = a.user_id
WHERE a.scheduled_date >= CURRENT_DATE
  AND a.status NOT IN ('canceled', 'cancelled', 'completed')
  AND s.id IS NULL
ORDER BY a.scheduled_date;
```

**Expected PASS:** 0 rows returned (all future active appointments have a valid subscription).

**If rows returned:** Review each appointment. These may be one-time service appointments (which don't require subscriptions) or orphaned subscription appointments. For orphaned subscription appointments, cancel them and notify the customer.

---

## Check 5: Active Annual Subscriptions Past Period End

**Risk:** Annual plans that should have been expired are still showing as active — customer may receive unearned service.

**Query:**
```sql
SELECT
  id,
  user_id,
  current_period_end,
  status,
  (NOW() - current_period_end::timestamptz) AS overdue_by
FROM subscriptions
WHERE program = 'annual'
  AND status = 'active'
  AND current_period_end IS NOT NULL
  AND current_period_end::timestamptz < NOW()
ORDER BY current_period_end ASC;
```

**Expected PASS:** 0 rows returned.

**If rows returned:** The `expire-annual-plans` Netlify function has not run yet or failed. Manually expire by:
```sql
UPDATE public.subscriptions
SET status = 'expired', updated_at = NOW()
WHERE program = 'annual'
  AND status = 'active'
  AND current_period_end IS NOT NULL
  AND current_period_end::timestamptz < NOW();
```

---

## Check 6: notification_log CHECK Constraint Verification

**Risk:** If the final constraint (from notification_phase2_types migration) is not active, employee notification logs and email_opted_out logs will fail silently.

**Query:**
```sql
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'notification_log_notification_type_check';
```

**Expected PASS:** 1 row returned. The `check_clause` should contain `'employee_assignment_created'` (Phase 2 types migration).

**Confirm Phase 2 types are included:**
```sql
-- Verify specific types expected by Phase 2 code are in the constraint
SELECT
  CASE
    WHEN check_clause LIKE '%employee_assignment_created%' THEN 'PASS'
    ELSE 'FAIL'
  END AS employee_assignment_created,
  CASE
    WHEN check_clause LIKE '%email_opted_out%' THEN 'PASS'
    ELSE 'FAIL'
  END AS email_opted_out,
  CASE
    WHEN check_clause LIKE '%sms_opt_out%' THEN 'PASS'
    ELSE 'FAIL'
  END AS sms_opt_out,
  CASE
    WHEN check_clause LIKE '%lead_acknowledgement%' THEN 'PASS'
    ELSE 'FAIL'
  END AS lead_acknowledgement,
  CASE
    WHEN check_clause LIKE '%subscription_activated%' THEN 'PASS'
    ELSE 'FAIL'
  END AS subscription_activated
FROM information_schema.check_constraints
WHERE constraint_name = 'notification_log_notification_type_check';
```

**Expected:** All columns show PASS.

---

## Check 7: admin_alerts Table Exists

**Query:**
```sql
SELECT
  table_name,
  (SELECT COUNT(*) FROM pg_tables WHERE tablename = 'admin_alerts' AND rowsecurity = true) AS rls_enabled
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'admin_alerts';
```

**Expected PASS:** 1 row returned with `rls_enabled = 1`.

---

## Check 8: admin_alerts RLS Policy Exists

**Query:**
```sql
SELECT schemaname, tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'admin_alerts';
```

**Expected PASS:** 1 row returned for `admin_alerts_admin_only` policy.

---

## Check 9: Profile Trigger Exists

**Query:**
```sql
SELECT trigger_name, event_object_schema, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created'
  AND event_object_schema = 'auth'
  AND event_object_table = 'users';
```

**Expected PASS:** 1 row returned.

---

## Check 10: Assignment Uniqueness Index Exists

**Query:**
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'assignments'
  AND indexname = 'assignments_appointment_id_active_unique';
```

**Expected PASS:** 1 row returned. indexdef should reference `WHERE (status NOT IN (...))`.

---

## Integrity Summary Table

| Check | Query | Expected | Action If Fail |
|-------|-------|---------|----------------|
| 1. Auth users without profiles | Check 1 above | 0 rows | Run backfill query |
| 2. Canceled appts with active assignments | Check 2 above | 0 rows | Run UPDATE to skip them |
| 3. Duplicate active assignments | Check 3 above | 0 rows | Manual review + delete older |
| 4. Future appts without subscriptions | Check 4 above | 0 rows | Review + cancel orphans |
| 5. Expired annual plans still active | Check 5 above | 0 rows | Run UPDATE to expire |
| 6. Notification log CHECK constraint | Check 6 above | PASS all | Re-run notification_phase2_types migration |
| 7. admin_alerts table exists | Check 7 above | 1 row, RLS=1 | Re-run admin_alerts migration |
| 8. admin_alerts RLS policy | Check 8 above | 1 row | Re-run admin_alerts migration |
| 9. Profile trigger exists | Check 9 above | 1 row | Re-run ensure_profile_trigger migration |
| 10. Assignment uniqueness index | Check 10 above | 1 row | Re-run assignment_appointment_uniqueness migration |

---

## Assessment

All queries are ready to run in Supabase SQL Editor. No live DB access was available. Based on migration analysis:
- Checks 6-10 should PASS (migrations confirmed applied by user)
- Checks 1-5 require live data and cannot be predicted without DB access

**Status: UNVERIFIED — queries prepared, operator must run in Supabase SQL Editor**
