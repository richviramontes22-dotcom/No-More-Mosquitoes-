# Supabase Deployment Verification Checklist
**Sprint:** Final Operational Verification Sprint  
**Date:** 2026-05-29

Run all queries below in the Supabase SQL Editor AFTER applying the three migrations. Each query includes its expected result and remediation if the result is unexpected.

---

## Step 1 — Verify Profile Trigger Exists

```sql
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users';
```

**Expected:** One row returned with `trigger_name = 'on_auth_user_created'`, `event_manipulation = 'INSERT'`, `action_timing = 'AFTER'`.

**If missing:** The migration did not apply to the correct schema. Re-run `2026-05-29_ensure_profile_trigger.sql` in the Supabase SQL Editor. Ensure you are connected to the correct project.

---

## Step 2 — Verify `service_completed` in Notification Log Constraint

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.notification_log'::regclass
  AND contype = 'c';
```

**Expected:** The constraint definition returned should include the string `'service_completed'` in its list of allowed values.

**If missing or wrong:** Re-run `2026-05-29_notification_type_service_completed.sql`. The `DROP CONSTRAINT IF EXISTS` makes re-running safe.

---

## Step 3 — Verify Assignment Uniqueness Index Exists

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'assignments'
  AND indexname = 'assignments_appointment_id_active_unique';
```

**Expected:** One row returned. The `indexdef` should show a partial UNIQUE index on `appointment_id` with a WHERE clause excluding terminal statuses.

**If missing:** Re-run `2026-05-29_assignment_appointment_uniqueness.sql`. First re-run the pre-check query from the Migration Verification Report to confirm there are no duplicates that would block index creation.

---

## Step 4 — Profile Backfill for Existing Users (Run Once)

Run this query ONCE after deploying the profile trigger migration to create profile rows for any users who signed up before the trigger was installed.

```sql
INSERT INTO public.profiles (id, email, created_at, updated_at)
SELECT id, email, created_at, NOW()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;
```

**Expected:** The query returns the number of rows inserted. Zero rows inserted means all existing users already have profiles — this is the ideal outcome.

**Safety:** This query is safe to run multiple times. `ON CONFLICT (id) DO NOTHING` prevents any duplicate profile rows.

---

## Step 5 — Confirm No Orphaned Auth Users Remain

After running the backfill, confirm no auth users are missing profiles:

```sql
SELECT u.id, u.email, u.created_at
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
);
```

**Expected:** Zero rows. If rows remain, the backfill did not complete successfully — check for RLS policies blocking the insert and re-run with a service role key context.

---

## Environment Variables — Netlify Production Verification

Verify all variables below are set in Netlify Dashboard → Site Configuration → Environment Variables before deploying to production.

| Variable | Required | Purpose | Production Value |
|----------|----------|---------|-----------------|
| `SUPABASE_URL` | Required | Server-side DB connection | `https://<project>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | Server-side admin bypass (bypasses RLS) | `eyJ...` service role key |
| `SUPABASE_ANON_KEY` | Required | Server-side anon key fallback | `eyJ...` anon key |
| `VITE_SUPABASE_URL` | Required | Frontend DB URL (baked into client bundle) | Same as SUPABASE_URL |
| `VITE_SUPABASE_ANON_KEY` | Required | Frontend auth (safe to expose) | `eyJ...` anon key |
| `STRIPE_SECRET_KEY` | Required | All Stripe API calls | Must start with `sk_live_` in production |
| `STRIPE_WEBHOOK_SECRET` | Required | Webhook signature verification | `whsec_...` from Stripe Dashboard |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Required | Frontend Stripe Elements | Must start with `pk_live_` in production |
| `RESEND_API_KEY` | Required | Transactional email (all notifications) | `re_...` from Resend Dashboard |
| `RESEND_FROM_EMAIL` | Required | From address on all emails | `No More Mosquitoes <hello@nomoremosquitoes.us>` |
| `APP_BASE_URL` | Required | Stripe redirect URLs, email dashboard links | `https://nomoremosquitoes.us` |
| `REMINDER_DRY_RUN` | Required | Reminder safety flag | `false` in production |
| `STRIPE_AUTO_TAX` | Required | Stripe Tax on charges | `false` until Stripe Tax is configured |
| `TWILIO_ACCOUNT_SID` | Optional | SMS (en-route notifications) | Twilio SID |
| `TWILIO_AUTH_TOKEN` | Optional | SMS auth | Twilio auth token |
| `TWILIO_FROM_NUMBER` | Optional | SMS sender number | `+1...` |
| `GOOGLE_MAPS_SERVER_KEY` | Optional | Backend geocoding for parcel lookup | GCP server key |
| `VITE_GOOGLE_MAPS_BROWSER_KEY` | Optional | Frontend Places Autocomplete | GCP browser key (domain-restricted) |
| `VITE_CRISP_WEBSITE_ID` | Optional | Crisp live chat widget | Crisp website ID |

### Critical Production Rules

1. `STRIPE_SECRET_KEY` must begin with `sk_live_` — the server logs a warning if a test key is used in production but does not block operation. A test key in production means real charges cannot be collected.
2. `REMINDER_DRY_RUN=false` — if set to `true` or omitted, reminder emails will be logged but not sent, and customers will not receive appointment reminders.
3. `APP_BASE_URL` must match the production domain exactly — Stripe uses this for checkout redirect URLs. If wrong, users are redirected to the wrong domain after payment.

---

## Netlify Scheduled Functions Verification

After deployment, confirm all three scheduled functions are active in Netlify Dashboard → Functions → Scheduled Functions.

| Function | Schedule | Purpose |
|----------|----------|---------|
| `send-reminders` | `0 7 * * *` (7:00 AM UTC daily) | Sends 24h and same-day appointment reminder emails |
| `generate-appointments` | `0 8 * * *` (8:00 AM UTC daily) | Generates recurring appointments for active subscriptions |
| `expire-annual-plans` | `0 9 * * *` (9:00 AM UTC daily) | Transitions expired annual plans to `expired` status, creates admin alert tickets |

All three schedules are confirmed in `netlify.toml`. Netlify must be deployed from the main branch for scheduled functions to activate.

---

## Stripe Webhook Events to Register

In Stripe Dashboard → Developers → Webhooks, ensure the production webhook endpoint (`https://nomoremosquitoes.us/api/webhooks/stripe`) is registered for all of the following events:

| Event | Purpose |
|-------|---------|
| `invoice.paid` | Activates subscription, creates service_order, syncs card info |
| `invoice.payment_failed` | Marks subscription as `past_due` |
| `payment_intent.succeeded` | Annual plan subscription row upsert, marketplace order completion |
| `customer.subscription.deleted` | Cancels subscription, cascades to future appointments and assignments |
| `customer.subscription.updated` | Syncs non-active subscription states (cancellation, degradation) |
| `checkout.session.completed` | Marketplace order creation, one-time service order and appointment creation |
| `checkout.session.expired` | Marks pending marketplace orders as expired |
| `payment_intent.payment_failed` | Marks marketplace orders as failed |
| `charge.refunded` | Marks marketplace orders and payments as refunded |
