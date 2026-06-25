# REGRESSION TEST RESULTS
## Generated: 2026-05-29
## Phase 11: Static Simulation of Critical Workflows

---

## Methodology

Static code trace — no live test environment available. Each workflow traced through the modified files to confirm the happy path still works and the new cascade logic is non-interfering.

---

## Workflow 1: Subscription Checkout Flow (confirm-booking)

**Path:** Client calls `POST /api/billing/confirm-booking` after `stripe.confirmPayment()` succeeds.

**Trace through `billingStripe.ts`:**

1. `getAuthenticatedUser(req)` — validates JWT. Unchanged.
2. `stripeFetch('/payment_intents/${paymentIntentId}')` — verifies PI succeeded against Stripe. Unchanged.
3. `supabaseAdmin.from("subscriptions").upsert(...)` — writes subscription row. Unchanged.
4. `supabaseAdmin.from("appointments").insert(...)` — creates first appointment. Unchanged.
5. `supabaseAdmin.from("properties").update(...)` — persists program/cadence. Unchanged.
6. `supabaseAdmin.from("profiles").update({ is_onboarded: true })` — marks user onboarded. Unchanged.

**Changes to this workflow:** None. The `create-portal-session` change only affects the portal route, not `confirm-booking`.

**Result: PASS**

---

## Workflow 2: Annual Plan Checkout

**Path:** PaymentElement for annual plan → `confirm-booking` with `program = "annual"`.

**Trace through `billingStripe.ts`:**

1. Auth and PI verification — unchanged.
2. Annual branch (lines 671-686): `upsert` with `stripe_subscription_id = paymentIntentId`, `program = "annual"`, `current_period_end = now + 365 days`. Unchanged.
3. First appointment created. Unchanged.
4. `is_onboarded = true`. Unchanged.

**New interaction:** The `expire-annual-plans` function will now see this subscription in 365 days and expire it. This is the INTENDED behavior — previously the subscription would never expire.

**Result: PASS**

---

## Workflow 3: Recurring Generation

**Path:** `netlify/functions/generate-appointments.ts` → `runRecurringGeneration()`.

**Changed files that interact:** None — `generateRecurring.ts` was not modified.

**Concern:** Does the new `expired` status break recurring generation? The generation function filters by `status = 'active'`. Subscriptions with `status = 'expired'` (written by `expire-annual-plans.ts`) will be excluded from recurring generation. This is CORRECT behavior — expired annual plans should not generate new appointments.

**Result: PASS**

---

## Workflow 4: Employee Assignment Status Update (en_route → in_progress → completed)

**Path:** Employee calls `POST /api/employee/assignments/:id/status` with consecutive statuses.

**Changes to `employeeAssignments.ts`:**
- `VALID_STATUSES` no longer includes `"assigned"`.
- `notification_type` changed from `"appointment_confirmation"` to `"service_completed"`.

**en_route trace:**
- `VALID_STATUSES.includes("en_route")` → true. Validation passes.
- `update.en_route_at = now` set. DB update proceeds. Unchanged.

**in_progress trace:**
- `VALID_STATUSES.includes("in_progress")` → true. Validation passes. Unchanged.

**completed trace:**
- `VALID_STATUSES.includes("completed")` → true. Validation passes.
- Appointment cascade: `db.from("appointments").update({ status: "completed" })`. Unchanged.
- Completion email: Resend call. Unchanged.
- Notification log: `notification_type: "service_completed"`. New — will not collide with `appointment_confirmation` dedup index.

**Result: PASS**

---

## Workflow 5: Admin Cancel Appointment (with new cascade)

**Path:** Admin calls `PATCH /api/admin/appointments/:id/cancel`.

**Trace through `adminAppointments.ts`:**

1. `getAppointmentContext(id)` — fetches appointment, assignment, profile, property. Unchanged.
2. Guard checks: not already canceled, not completed. Unchanged.
3. `db.from("appointments").update({ status: "canceled" })` — primary operation. Returns error on failure → 500 response. Unchanged.
4. **NEW:** `db.from("assignments").select(...)` — queries linked active assignments. Non-fatal try/catch.
5. **NEW:** `db.from("assignments").update({ status: "skipped" })` — bulk update. Non-fatal.
6. **NEW:** Console log for each employee that should be notified. Non-fatal.
7. Fire-and-forget cancellation email to customer. Unchanged.
8. `res.json({ success: true, emailSent })`. Unchanged.

**If step 4-6 fails:** The try/catch swallows the error. The response is still `{ success: true }`. The appointment IS canceled (step 3 already succeeded). The assignment is NOT skipped (failure in cascade) — this is less bad than failing the cancel entirely.

**Result: PASS**

---

## Workflow 6: Stripe customer.subscription.deleted Webhook (with new cascade)

**Path:** Stripe sends `customer.subscription.deleted` → webhook handler processes it.

**Trace through `webhooksStripe.ts`:**

1. `supabase.from("subscriptions").select(...).eq("stripe_subscription_id", sub.id)` — NEW: lookup row before update.
2. `supabase.from("subscriptions").update({ status: "canceled" })` — primary operation. Unchanged.
3. **NEW:** `db.from("appointments").select("id").eq("user_id", ...).gte("scheduled_date", today)` — finds future appointments.
4. **NEW:** `db.from("appointments").update({ status: "canceled" }).in("id", apptIds)` — bulk cancel.
5. **NEW:** `db.from("assignments").update({ status: "skipped" }).in("appointment_id", apptIds)` — bulk skip.
6. `res.json({ received: true })` — Stripe gets 200. Unchanged.

**Edge case — no local subscriptions row:** `subRow` is null. The cascade block is skipped (`if (subRow?.user_id)`). Subscription is still marked canceled. No error.

**Edge case — cascade throws:** Caught by try/catch, logged as non-fatal. Subscription is still marked canceled. Stripe gets 200.

**Result: PASS**

---

## Workflow 7: Past-Due Customer Accesses Billing Portal

**Path:** Customer with `status = 'past_due'` calls `POST /api/billing/create-portal-session`.

**Trace through `billingStripe.ts`:**

1. `getAuthenticatedUser(req)` — validates JWT. Unchanged.
2. **NEW:** `supabaseAdmin.from("subscriptions").select("id, status").in("status", ["active", "past_due"])` — query returns row (past_due customer has a row).
3. `sub` is not null — guard passes. No 403 thrown.
4. `getOrCreateStripeCustomer(user)` — gets Stripe customer ID. Unchanged.
5. `stripeFetch("/billing_portal/sessions", ...)` — creates Stripe portal session. Unchanged.
6. `res.json({ url: session.url })`. Unchanged.

**Before fix:** Step 2 would have been `requireActiveSubscription(user)` which checks `status = 'active'` only. Past-due customer → 403.

**Result: PASS**

---

## Workflow 8: Profile Creation on Signup

**Path:** New user signs up via Supabase Auth.

**After migration `2026-05-29_ensure_profile_trigger.sql` is deployed:**

1. `auth.users` INSERT fires trigger `on_auth_user_created`.
2. `handle_new_user()` executes: `INSERT INTO public.profiles (id, name, email, role, ...) VALUES (...) ON CONFLICT (id) DO NOTHING`.
3. Profile row created automatically with `role = 'customer'`.
4. User can proceed to billing, onboarding, etc.

**Before migration:** No trigger exists. Step 2-3 don't happen. User gets `auth.users` row but no `profiles` row.

**Note:** This workflow requires the migration to be deployed to Supabase. Until it is, the risk IS-5 persists.

**Result: PASS (after migration deployment)**

---

## Regression Summary

| Workflow | Result | Notes |
|----------|--------|-------|
| 1. Subscription checkout (confirm-booking) | PASS | No changes to this path |
| 2. Annual plan checkout | PASS | Expire function future-compatible |
| 3. Recurring generation | PASS | Expired status correctly excludes from generation |
| 4. Employee assignment status update | PASS | All valid statuses still accepted; completion log fixed |
| 5. Admin cancel appointment | PASS | New cascade non-fatal; primary cancel still succeeds |
| 6. Stripe subscription.deleted webhook | PASS | New cascade non-fatal; Stripe gets 200 |
| 7. Billing portal (past-due) | PASS | Past-due customers can now access portal |
| 8. Profile creation | PASS (after migration) | Requires migration deployment |
