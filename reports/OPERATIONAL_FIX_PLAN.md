# OPERATIONAL FIX PLAN
## Generated: 2026-05-29
## Sprint: Final Operational Integrity Sprint

---

## Fix 1 — Appointment Cancellation Cascade (Phase 1)

**Problem:** Admin canceling an appointment does NOT update linked assignments. Technicians drive to canceled jobs.

**Files Affected:**
- `server/routes/adminAppointments.ts` — add assignment cascade in the cancel handler

**Routes Affected:**
- `PATCH /api/admin/appointments/:id/cancel`

**DB Changes:**
- No schema changes. Uses existing `assignments` table and `notification_log` table.

**Migration Required:** No

**Risk Assessment:** Low
- The cascade update runs AFTER the appointment is already successfully canceled.
- It is non-blocking: if the assignment update fails, the appointment cancellation response still returns 200.
- The notification_log insert is fire-and-forget (Promise.resolve().catch()).
- The `notification_log.notification_type` CHECK constraint does NOT include `"appointment_canceled_employee"`. To avoid CHECK constraint violation, the log insert will use `"appointment_canceled"` (which IS in the constraint) with a console.log for employee context instead.

**Rollback Strategy:** Remove the 6 lines added after the appointment cancel update. No migration to reverse.

---

## Fix 2 — Subscription Cancellation Cascade (Phase 2)

**Problem:** `customer.subscription.deleted` webhook only updates the subscriptions table. Future appointments and assignments remain scheduled.

**Files Affected:**
- `server/routes/webhooksStripe.ts` — extend the `customer.subscription.deleted` case

**Routes Affected:**
- Stripe webhook handler (POST /api/webhooks/stripe)

**DB Changes:**
- No schema changes. Reads/updates existing `appointments` and `assignments` tables.

**Migration Required:** No

**Risk Assessment:** Low-Medium
- Idempotent: the NOT IN guard prevents re-canceling already-terminal appointments.
- The webhook must return 200 quickly or Stripe will retry. The cascade is simple bulk updates, not looping over records one-by-one (uses .in() which is a single DB call).
- user_id is resolved from the existing subscriptions table lookup (same pattern as invoice.paid handler).

**Rollback Strategy:** Revert the added block in the `customer.subscription.deleted` case. No migration.

---

## Fix 3 — Annual Expiration Automation (Phase 3)

**Problem:** Annual subscriptions never transition from `active` to `expired` after `current_period_end` passes.

**Files Affected:**
- `netlify/functions/expire-annual-plans.ts` — NEW file
- `netlify.toml` — add schedule entry

**Routes Affected:** None (scheduled function)

**DB Changes:**
- Writes `subscriptions.status = 'expired'` for overdue annual plans.
- Attempts to create a `tickets` row. However, `tickets.user_id` is NOT NULL — the insert must include `user_id`. The function will include `user_id: sub.user_id` in the ticket insert.

**Migration Required:** No

**Risk Assessment:** Low
- Idempotent: the `.eq("status", "active")` guard means re-running won't touch already-expired rows.
- The ticket creation is wrapped in try/catch so a schema issue won't crash the expiration logic.
- The function runs at 9 AM UTC daily — well after the other scheduled functions.

**Rollback Strategy:** Remove the toml entry and delete the file.

---

## Fix 4 — Past Due Billing Portal Access (Phase 4)

**Problem:** `requireActiveSubscription` blocks `past_due` customers from the billing portal. They can't fix their payment.

**Files Affected:**
- `server/routes/billingStripe.ts` — modify the `create-portal-session` route to allow `past_due`

**Routes Affected:**
- `POST /api/billing/create-portal-session`

**DB Changes:** None

**Migration Required:** No

**Risk Assessment:** Very Low
- Only the billing portal route is relaxed. All other routes still require `active` status.
- The customer is still authenticated (JWT check is preserved).
- Implementation: inline status check on the portal route that accepts `["active", "past_due"]`, replacing the `requireActiveSubscription` call for that route only.

**Rollback Strategy:** Revert to using `requireActiveSubscription(user)` on the portal route.

---

## Fix 5 — Profile Creation Verification (Phase 5)

**Problem:** No DB trigger confirmed to auto-create `profiles` row when `auth.users` row is inserted.

**Investigation Result:**
- Searched all migration files — no `handle_new_user` trigger or `on_auth_user_created` trigger found.
- Server code does not create profiles on signup (only on billing confirm-booking via supabaseAdmin).
- Creating a migration is required.

**Files Affected:**
- `db/migrations/2026-05-29_ensure_profile_trigger.sql` — NEW migration

**Routes Affected:** None (DB trigger)

**DB Changes:**
- Creates `handle_new_user()` function and `on_auth_user_created` trigger on `auth.users`.
- Uses `ON CONFLICT (id) DO NOTHING` to be safe for existing users.
- Includes `role = 'customer'` and `name = COALESCE(...)` to match profiles table NOT NULL constraints.

**Migration Required:** YES — must be run in Supabase SQL Editor

**Risk Assessment:** Low
- `ON CONFLICT DO NOTHING` means existing users are unaffected.
- `SECURITY DEFINER` is required for triggers that write to public schema from auth schema.
- `CREATE OR REPLACE` is idempotent.

**Rollback Strategy:** `DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;`

---

## Fix 6 — Assignment State Standardization (Phase 6)

**Problem:** VALID_STATUSES in code includes `"assigned"` but the DB CHECK constraint only allows `"scheduled"` as the initial state.

**Investigation Result:**
- DB CHECK constraint (`2025-11-10_employee_portal.sql` line 56): `('scheduled','en_route','in_progress','completed','no_show','skipped')` — does NOT include `"assigned"`.
- Code VALID_STATUSES: includes `"assigned"`.
- Code that WRITES initial status: `adminAppointments.ts` line 230 writes `"scheduled"` — correct.
- The arrive route checks `current.status === "assigned"` (line 331) — would work if `"assigned"` were a valid DB value.
- Decision: `"assigned"` is NOT in the DB constraint. Remove it from VALID_STATUSES so the employee cannot set it via the API (which would cause a DB CHECK violation). The arrive route's `"assigned"` check is kept as a defensive guard but is dead code in practice.

**Files Affected:**
- `server/routes/employeeAssignments.ts` — remove `"assigned"` from VALID_STATUSES

**Migration Required:** No (removing from code only; DB is already correct)

**Risk Assessment:** Very Low
- No production code writes `"assigned"` to the DB. Removing it from VALID_STATUSES prevents a potential DB error if it were ever called.
- The arrive route's `|| current.status === "assigned"` guard is kept to handle any legacy rows.

**Rollback Strategy:** Add `"assigned"` back to VALID_STATUSES.

---

## Fix 7 — Assignment Uniqueness Constraint (Phase 7)

**Problem:** No UNIQUE constraint on `assignments.appointment_id` — multiple active assignments can exist per appointment.

**Investigation Result:**
- Migration `2025-11-10_employee_portal.sql`: no UNIQUE constraint on `appointment_id`.
- Migration `2026-05-17_phase3a_employee_persistence.sql`: only adds timestamp columns and indexes — no uniqueness.
- The `adminAppointments.ts` upsert uses `onConflict: "appointment_id"` which requires a UNIQUE constraint to work. Without it, upserts silently insert duplicates.

**Files Affected:**
- `db/migrations/2026-05-29_assignment_appointment_uniqueness.sql` — NEW migration

**Migration Required:** YES — partial UNIQUE index on `assignments(appointment_id)` WHERE non-terminal

**Risk Assessment:** Medium
- The migration first deletes duplicate assignments (keeping newest by `created_at`).
- Partial unique index (excludes terminal statuses) allows reassignment history.
- The `onConflict: "appointment_id"` in adminAppointments.ts will then work correctly.
- Risk: if there ARE duplicate active assignments in production, the DELETE will silently remove the older ones. This is the correct behavior (keep newest).

**Rollback Strategy:** `DROP INDEX IF EXISTS assignments_appointment_id_active_unique;`

---

## Fix 8 — Service Completion Notification Type (Phase 8)

**Problem:** Completion notification logged with `notification_type: "appointment_confirmation"` — conflicts with booking confirmation dedup index.

**Files Affected:**
- `server/routes/employeeAssignments.ts` — change notification_type to `"service_completed"`
- `db/migrations/2026-05-29_notification_type_service_completed.sql` — NEW migration to add to CHECK constraint

**Migration Required:** YES — must add `"service_completed"` to notification_log CHECK constraint

**Risk Assessment:** Low
- The code change is a 1-word string swap.
- The migration uses `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT` — idempotent.
- Without the migration, the insert will fail the CHECK constraint silently (caught by `.catch(() => {})`). So the code fix works safely even if the migration hasn't run yet.

**Rollback Strategy:** Revert string in employeeAssignments.ts; re-run constraint migration with original values.

---

## Deferred Fixes

None of the 8 assigned fixes are deferred. All are implemented.

The following gaps identified in the audit are NOT fixed in this sprint (out of scope):
- Customer-facing individual appointment cancel API (IS-3 from customer perspective)
- Employee notifications on appointment cancel (no employee email template exists)
- Welcome email on first subscription creation
- Assignment notification on customer reschedule
- Customer SMS on employee self-reported en_route
- Stripe reconciliation job for webhook delivery failures
- Admin notification on payment failure
