# END-TO-END PRODUCTION SIMULATION REPORT

**Sprint B — Static Code Trace (No Live Execution)**
**Date:** 2026-05-28
**Method:** Code path tracing through actual source files

---

## B1 — Recent Fix Verification (Summary)

See `RECENT_FIXES_VERIFICATION_REPORT.md` for full line-by-line citations.

All 9 fixes are in place.

---

## B2 — Customer Onboarding / Payment Lifecycle

| Step | Expected | Actual (Code Trace) | Status | Evidence |
|------|----------|---------------------|--------|----------|
| 1a — Signup (auth) | Supabase Auth creates user | Auth handled by Supabase SDK client-side; server has no explicit signup route — Supabase Auth does it | PASS | `supabase.auth.signUp()` in client auth context |
| 1b — Profile row | `profiles` row created on first login via trigger or explicit write | `webhooksStripe.ts` invoice.paid path: `db.from("profiles").update({ is_onboarded: true })` — profile exists; creation is handled by Supabase trigger (out of band) | PARTIALLY VERIFIED | Profile creation relies on DB trigger not visible in audited files |
| 2 — Property creation | Property row written to `properties` table | Client calls `supabase.from("properties").insert(...)` directly; `confirm-booking` does `.update()` on the property | PASS | `billingStripe.ts` line 733 |
| 3 — Acreage quote | `POST /api/parcel/quote` → county GIS → pricing | `parcelQuote.ts` calls `lookupParcel()`, `buildPricingQuote()`, optionally persists `lat/lng` to property | PASS | `parcelQuote.ts` lines 36–75 |
| 3b — Coordinate persistence | `properties.lat/lng` updated after quote | Line 62: `db.from("properties").update({ lat, lng }).eq("id", propertyId)` — fires when `propertyId` and numeric `lat/lng` both present | PASS | `parcelQuote.ts` line 62 |
| 4a — Inline checkout (PaymentElement) | `POST /api/billing/create-payment-intent` → Stripe PI or Subscription → client secret | Full implementation with Path 1/Path 2 PI extraction; annual handled as flat PI | PASS | `billingStripe.ts` lines 341–619 |
| 4b — confirm-booking | Verifies PI status, inserts appointment, upserts subscription, updates property/profile | `POST /api/billing/confirm-booking` verifies `pi.status === "succeeded"` before writing; idempotency check for appointment | PASS | `billingStripe.ts` lines 633–747 |
| 4c — Webhook fallback | Stripe webhook creates appointment if confirm-booking missed | `checkout.session.completed` branch in `webhooksStripe.ts` lines 274–344 | PASS | `webhooksStripe.ts` lines 274–310 |
| 4d — Subscription rows | `subscriptions` table upserted | `confirm-booking` upserts subscription on success; webhook also upserts on `invoice.paid` | PASS | `billingStripe.ts` lines 656–685; `webhooksStripe.ts` lines 465–487 |
| 5a — Customer dashboard | `useAppointments` hook fetches appointments | `supabase.from("appointments").select(...).eq("user_id", userId)` via React Query | PASS | `client/hooks/dashboard/useAppointments.ts` lines 44–47 |
| 5b — Admin appointments | Admin page fetches from `appointments` table | `supabase.from("appointments").select(...).order("scheduled_at")` — client-side anon key; depends on RLS policy | PARTIALLY VERIFIED | `client/pages/admin/Appointments.tsx` line 359. If RLS requires auth or admin role, this may return empty. Admin page uses anon key not service role. |
| 5c — Admin customer list | Admin views customer list | `GET /api/admin/customers` not visible as explicit list route; `adminCustomers.ts` only has invite endpoint; customer list appears to be queried directly from client via Supabase | PARTIALLY VERIFIED | No explicit admin customer list API route found; client likely queries `profiles` directly |

### Narrative for PARTIALLY VERIFIED Items

**Step 1b (Profile row creation):** The profile creation trigger is a Supabase database function not visible in the application code. If this trigger is not deployed, first-time users will have no profile row and billing/notifications will fail silently. This must be verified as a pre-launch step.

**Step 5b (Admin appointments via anon key):** The admin appointments page (`client/pages/admin/Appointments.tsx`) queries `supabase.from("appointments")` directly using the client SDK with the anon key. If Supabase Row Level Security (RLS) restricts appointment reads to authenticated users or requires service_role, the admin will see no appointments. The admin API routes use `supabaseAdmin` (service role), but the admin _page_ bypasses the API. This is a latent defect — if RLS is strict, admin can't see appointments. A fix would be routing admin reads through the server API with `requireAdmin` middleware and `supabaseAdmin`.

---

## B3 — Admin Assignment Lifecycle

| Step | Expected | Actual (Code Trace) | Status | Evidence |
|------|----------|---------------------|--------|----------|
| 1 — Admin views appointments | Fetches all appointments from DB | `supabase.from("appointments").select(...)` in `Appointments.tsx` + also fetches `assignments` to populate `assignmentMap` | PASS | `Appointments.tsx` lines 359–415 |
| 2 — Admin selects employee + assigns | Calls `POST /api/admin/assignments` | `assignSelected()` at line 541: `adminApi("/api/admin/assignments", "POST", { appointment_ids: ids, employee_id: assignTech })` | PASS | `Appointments.tsx` line 541 |
| 3a — `POST /api/admin/assignments` upsert | Upserts to `assignments` table | `adminAppointments.ts` line 233: `db.from("assignments").upsert(upserts, { onConflict: "appointment_id" })` | PASS | `adminAppointments.ts` lines 227–236 |
| 3b — Employee notification email | Sends email to employee | Fire-and-forget Resend email at lines 243–257; non-fatal if email not configured | PASS | `adminAppointments.ts` lines 243–258 |
| 4a — Employee sees assignment | Employee portal queries `assignments` table | `GET /api/employee/assignments` in `employeeAssignments.ts` queries by `employee_id` | PASS | `employeeAssignments.ts` lines 52–73 |
| 4b — Employee sees correct data | Assignment enriched with customer/property info | Batch-loads `profiles` and `properties` using user_id and property_id from joined `appointments` | PASS | `employeeAssignments.ts` lines 83–121 |

**Summary: All assignment lifecycle steps PASS.**

---

## B4 — Employee Completion Lifecycle

| Step | Expected | Actual (Code Trace) | Status | Evidence |
|------|----------|---------------------|--------|----------|
| 1 — Employee opens detail | `AssignmentDetail.tsx` loads from `assignments` table | Loads from `supabase.from("assignments").select(...)`, then joins appointment, profile, property | PASS | `AssignmentDetail.tsx` lines 65–110 |
| 2 — Media upload | Supabase Storage `job-media` bucket + `job_media` DB record | Upload to `job-media` bucket, then `POST /api/employee/assignments/:id/media` which writes to `job_media` table | PASS | `AssignmentDetail.tsx` lines 142–184; `employeeAssignments.ts` lines 354–391 |
| 3 — Mark completed | `POST /api/employee/assignments/:id/status` with `status: "completed"` | `updateStatus("completed")` in `AssignmentDetail.tsx` line 203; calls correct endpoint with Bearer token | PASS | `AssignmentDetail.tsx` lines 193–221 |
| 4a — Assignment updated | `assignments.status = "completed"`, `completed_at` set | `employeeAssignments.ts` line 200: updates assignment with `status: "completed"` and `completed_at = now` | PASS | `employeeAssignments.ts` lines 200–204 |
| 4b — Appointment cascaded | `appointments.status = "completed"` | Lines 212–224: `db.from("appointments").update({ status: "completed" })` — guards against already-canceled | PASS | `employeeAssignments.ts` lines 212–224 |
| 4c — Completion notification | Customer email sent | Fire-and-forget email via Resend at lines 228–293; checks `isEmailConfigured()` | PASS | `employeeAssignments.ts` lines 227–293 |
| 4d — Notification logged | `notification_log` row inserted | Line 278: `db.from("notification_log").insert(...)` in async block | PASS | `employeeAssignments.ts` lines 278–286 |
| 5 — Customer recap | Customer dashboard shows completed appointment | `useAppointments` fetches all including `completed`; `pastVisits` filter includes `status === "Completed"` | PASS | `useAppointments.ts` + `dashboard/Appointments.tsx` line 347 |

**Summary: All completion lifecycle steps PASS.**

---

## B5 — Recurring Generation Trace

| Step | Expected | Actual (Code Trace) | Status | Evidence |
|------|----------|---------------------|--------|----------|
| 1 — Subscriptions fetched | All active subs with `cadence_days` and `property_id` | `db.from("subscriptions").select(...).eq("status", "active").not("property_id", "is", null).not("cadence_days", "is", null)` | PASS | `generateRecurring.ts` lines 57–63 |
| 2 — Next appointment date | `lastAppt.scheduled_date + cadence_days` | Finds last non-canceled appointment, adds `cadenceDays` with `addDays()` | PASS | `generateRecurring.ts` lines 124–146 |
| 3 — Slot found | `findAvailableSlot()` respects business hours, blackouts, capacity | Yes — walks days from `nextDue` up to 14 days, checks blackouts, hours, and capacity | PASS | `generateRecurring.ts` lines 253–341 |
| 4 — Duplicate prevention | Skip if future appointment already exists | Guard at lines 110–121: count non-canceled future appointments | PASS | `generateRecurring.ts` lines 110–121 |
| 5 — Appointment written | `appointments` row inserted with all fields | Line 200: insert with `user_id, property_id, status, service_type, scheduled_date, window, window_label, scheduled_at` | PASS | `generateRecurring.ts` lines 200–221 |
| 6 — No-slot failure | Admin ticket created | Lines 163–185: creates `tickets` row with `priority: "high"`, deduped per day | PASS | `generateRecurring.ts` lines 163–185 |
| 7 — Trigger | Netlify scheduled function at 8:00 AM UTC daily | `netlify.toml` line 17: `schedule = "0 8 * * *"` | PASS | `netlify.toml` line 17 |

**Summary: All recurring generation steps PASS.**

**Limitation noted:** No anchor appointment = sub is skipped (line 133). First appointment must be manually set for new subscriptions before auto-gen activates.

---

## B6 — Reminder Lifecycle

| Step | Expected | Actual (Code Trace) | Status | Evidence |
|------|----------|---------------------|--------|----------|
| 1 — Cron schedule | Daily at 7:00 AM UTC | `netlify.toml` line 13: `schedule = "0 7 * * *"` | PASS | `netlify.toml` line 13 |
| 2 — Appointments fetched | Appointments for tomorrow (24h) and today (same-day) | `reminderScheduler.ts` lines 44–57: queries by `scheduled_date`, excludes canceled/completed | PASS | `reminderScheduler.ts` lines 44–57 |
| 3 — Notifications sent | `sendAppointmentReminder()` called per appointment | Lines 120–131: `await sendAppointmentReminder({...})` | PASS | `reminderScheduler.ts` lines 120–131 |
| 4 — SMS opt-in check | Only SMS if `profile.smsReminders !== false` | Line 83: `smsReminders: prefs.smsReminders !== false` (default true) | PASS | `reminderScheduler.ts` lines 77–85 |
| 5 — Notification log | Not explicitly logged in reminderScheduler | `sendAppointmentReminder` handles its own logging internally (not audited here, assumed functional) | PARTIALLY VERIFIED | `reminderScheduler.ts` does not call `logNotification` directly |

**Limitation:** Appointments without `window_label` are skipped (line 100–103). Legacy appointments (pre-Phase 1 window model) without this field will not receive reminders.

---

## B7 — Marketplace Lifecycle

| Step | Expected | Actual (Code Trace) | Status | Evidence |
|------|----------|---------------------|--------|----------|
| 1 — Cart checkout (redirect) | `POST /api/marketplace/create-checkout-session` | Full implementation; line items appended to Stripe checkout body | PASS | `marketplaceStripe.ts` lines 154–266 |
| 2 — Cart checkout (inline) | `POST /api/marketplace/create-payment-intent` | Creates Stripe PI + pre-creates `marketplace_orders` + `marketplace_order_items` rows immediately | PASS | `marketplaceStripe.ts` lines 274–383 |
| 3 — Webhook success (redirect) | `checkout.session.completed` with `purchase_type = "marketplace"` | Creates order, fetches line items from Stripe API, creates `marketplace_order_items`, creates service_order | PASS | `webhooksStripe.ts` lines 80–225 |
| 4 — Webhook success (inline PI) | `payment_intent.succeeded` with `purchase_type = "marketplace"` | Updates order status to `completed`, creates service_order | PASS | `webhooksStripe.ts` lines 618–710 |
| 5 — Admin visibility | Admin marketplace orders page | `server/routes/adminMarketplace.ts` exists; admin page reads marketplace_orders | PASS | `adminMarketplace.ts` (confirmed exists) |

---

## B8 — Negative / Failure Case Analysis

| Case | Expected | Actual (Code Trace) | Status |
|------|----------|---------------------|--------|
| Invalid card | Payment fails; no corrupt state | `confirm-booking` verifies `pi.status === "succeeded"` before writing. If payment fails, client never calls confirm-booking, OR confirm-booking returns 402. No appointment row written. | PASS |
| Canceled payment | Client abandons; server has pending Stripe Subscription but no DB subscription row | `create-payment-intent` creates Stripe subscription. If customer cancels, `confirm-booking` is never called. The Stripe subscription is `incomplete` and will auto-cancel after 24h per Stripe defaults. DB subscription row is only written on `invoice.paid`. No corrupt state. | PASS |
| Unavailable slot | `availability.ts` returns `available: false` for that window | Correct — client shows slot as unavailable. Server also re-validates on submit (`checkWindowAvailability` in `schedule.ts`). | PASS |
| Reschedule into full slot | `customerAppointments.ts` returns 409 | `checkWindowAvailability` returns error string if `count >= capacity`; handler returns `res.status(409).json({ error: ..., code: "WINDOW_UNAVAILABLE" })`. Client handles 409 gracefully. | PASS |
| Expired annual | `generateRecurring.ts` skips it | Lines 95–101: `if (!periodEnd || periodEnd <= new Date()) { result.skipped++; continue; }` | PASS |
| Production test-key | Server throws before any route is registered | `server/index.ts` line 40: `assertStripeKeyNotTestInProduction()` called first in `createServer()`. Throws `[FATAL]` error. | PASS |
| Missing Resend env | `sendAppointmentReminder` fails gracefully | `isEmailConfigured()` check in all notification paths; all sends are fire-and-forget with try/catch. No customer-facing error from missing Resend config. | PASS |
