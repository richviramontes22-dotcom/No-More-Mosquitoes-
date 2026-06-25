# WORKFLOW SYNCHRONIZATION AUDIT
## Generated: 2026-05-29
## Scope: Does each party (Customer / Admin / Employee) stay in sync through all major workflows?

---

## Workflow 1: Customer Books Appointment

**Trigger:** Customer completes scheduling flow (ScheduleFlow → POST /api/schedule)

### Party Status After Booking:

**Customer:**
- Confirmation email sent (via `sendAppointmentConfirmation`) — ✓
- Appointment appears in `/dashboard/appointments` — ✓ (reads from `appointments` where user_id = current user)
- Confirmation stored in `notification_log` — ✓

**Admin:**
- New appointment appears in `/admin/appointments` — ✓ (appointment is in `appointments` table, admin reads all)
- Appointment does NOT auto-appear in any "new bookings" alert on Overview — No alert, just shows in list
- Scheduling Queue (needs-scheduling) correctly excludes this appointment once it's created — ✓ (the queue checks for upcoming appointments)

**Employee:**
- No assignment created yet — ✓ (correct — assignment is a separate admin action)
- Employee sees nothing yet — ✓ (expected behavior)

**Sync Failures:**
- MINOR: Admin has no "new booking" notification. They must check the appointments list or wait for the scheduling queue alert.
- MINOR: If the customer books during off-hours, the appointment could sit unnoticed for hours.

**Overall: PASS** (with minor notification gap)

---

## Workflow 2: Admin Assigns Employee to Appointment

**Trigger:** Admin selects appointments in `/admin/appointments`, picks technician, clicks "Apply"

### Party Status After Assignment:

**Admin:**
- `assignments` row upserted with `status='scheduled'` — ✓
- Technician name shown in appointment row (updates `assignmentMap` + technician column) — ✓
- Toast confirmation — ✓

**Employee:**
- Assignment email sent (non-fatal fire-and-forget via Resend) — ✓ (if email configured and employee has email)
- Assignment appears in employee portal `/employee` dashboard — ✓ (employee queries `assignments` for today)
- BUT: Employee portal only shows assignments for TODAY. If assigned 3 days ahead, employee won't see it until that day.

**Customer:**
- Customer sees no change — ✓ (expected — assignment is internal)

**Sync Failures:**
- MEDIUM: Employee portal is day-scoped by default. Future assignments are only visible on the day of. No "upcoming assignments" calendar for employees.
- MEDIUM: If email is not configured or employee has no email, they receive NO notification of assignment. They must proactively check the portal.
- MINOR: No timestamp on when assignment was made (no created_at surfaced in admin appointment view).

**Overall: PARTIAL**

---

## Workflow 3: Employee Completes Job

**Trigger:** Employee taps "Complete Job" in AssignmentDetail → `POST /api/employee/assignments/:id/status` with `status=completed`

### Party Status After Completion:

**Employee:**
- `assignments.status` = 'completed', `completed_at` = now — ✓
- Assignment appears as completed in their portal — ✓
- Can upload job media to `job_media` table (if implemented) — ✓ (DB + storage bucket exists)

**Customer:**
- `appointments.status` — Does it cascade to 'completed'? Investigation needed.
- Looking at `server/routes/employeeAssignments.ts`: the status update sets `assignments.status=completed` and sets `completed_at`. It does NOT explicitly update `appointments.status`.
- Customer dashboard `appointments` queries the `appointments` table directly — if `appointments.status` is not updated, customer still sees "scheduled" not "completed".

**Admin:**
- `/admin/visits` shows `appointments` where `status='completed'` — if appointment status not cascaded, the visit won't appear.
- `/admin/employee-tracking` updates in near-real-time (5-second refresh).

**Sync Failures:**
- CRITICAL: There is no cascade from `assignments.status=completed` to `appointments.status=completed` in the employee assignment route. The `appointments.status` field may remain `scheduled` or `en_route` after the technician marks job complete. This means:
  - Customer does not see appointment as "completed"
  - Admin Visits page does not show the completed visit
  - The gap between assignment completion and appointment completion depends on whether a DB trigger or secondary update exists (not found in migrations reviewed)

- CRITICAL: Job media (`job_media` rows) are invisible to admin even after completion.

**Overall: FAIL**

**Root Cause:** `employeeAssignments.ts` status update does NOT update `appointments.status`. A database trigger or secondary update call is required but not confirmed to exist.

---

## Workflow 4: Customer Cancels Appointment

**Trigger:** Customer cancels from `/dashboard/appointments` → `PATCH /api/appointments/:id/cancel` (customer-facing route, not admin route)

### Party Status After Customer Cancellation:

**Customer:**
- Appointment status updates to 'canceled' — ✓ (assuming customer cancel route exists and works)
- Dashboard shows canceled status — ✓

**Admin:**
- `/admin/appointments` shows canceled appointment with "canceled" status badge — ✓
- No automated alert to admin that a cancellation happened — ✗

**Employee:**
- `assignments` row: status remains whatever it was (scheduled/en_route). The customer cancel route does NOT update the assignment status.
- Employee will still see the assignment in their portal if it's today.

**Sync Failures:**
- MEDIUM: Admin has no notification when a customer cancels. They must notice it in the appointments list.
- HIGH: Employee assignment is NOT updated when customer cancels. Technician will see a scheduled assignment for a canceled appointment. This could result in wasted travel time.

**Overall: PARTIAL**

**Root Cause:** Customer-side cancel route does not cascade to `assignments` table. Admin route (`/api/admin/appointments/:id/cancel`) also does not update assignments.

---

## Workflow 5: Customer Updates Payment Method

**Trigger:** Customer updates card in `/dashboard/billing` → Stripe API → Stripe webhook fires

### Party Status After Payment Method Update:

**Customer:**
- New card appears in billing dashboard (reads `profiles.card_last4`, `card_brand`, `card_expiry`) — ✓ (if webhook synced)
- Stripe webhook `customer.updated` or `payment_method.attached` → updates `profiles.card_*` fields

**Admin:**
- Admin can see customer profile but `card_last4/brand/expiry` fields are NOT shown in admin customer detail sheet — ✗
- Admin has no visibility into whether a customer's card is valid

**Sync Failures:**
- MEDIUM: Customer-facing billing shows card details, admin does not. If admin needs to verify a customer has a valid payment method, they cannot.
- MINOR: Stripe webhook delivery can fail; if it does, `profiles.card_*` fields fall out of sync with Stripe.

**Overall: PARTIAL**

---

## Workflow 6: Recurring Appointment Generated

**Trigger:** System (likely a cron/scheduled function) generates next appointment for active subscribers

Looking at the codebase — `netlify/functions/send-reminders.ts` exists (for notifications). Looking for recurring appointment generation...

The codebase has a `RECURRING_APPOINTMENT_GENERATION_REPORT.md` in reports/ which suggests this functionality was analyzed previously. From the scheduling architecture, recurring appointments appear to be manually scheduled by admin (the Scheduling Queue shows subscribers who need appointments) rather than auto-generated.

### If manually scheduled by admin:
**Customer:**
- Appointment appears in dashboard after admin creates it — ✓

**Admin:**
- Admin must notice the scheduling queue and manually create appointments — requires active management

**Employee:**
- Not yet assigned — correct

**Sync Failures:**
- HIGH: Recurring appointment generation is MANUAL. Admin must notice the queue. If queue is not checked daily, customers who paid will go without scheduled appointments.
- This is the primary operational risk surfaced by the Scheduling Queue alert on the Overview page.

**Overall: PARTIAL** (depends on admin actively monitoring the queue)

---

## Workflow 7: Subscription Renewal / Stripe Webhook

**Trigger:** Stripe fires `invoice.paid` for subscription renewal

### Party Status After Renewal:

**Stripe fires `invoice.paid`:**
- `webhooksStripe.ts` handles this event
- Updates `subscriptions.status`, `current_period_end`, `last_payment_at`, `last_invoice_id`, `amount_cents` — ✓
- Writes `payments` row — ✓
- Syncs `profiles.card_last4`, `card_brand`, `card_expiry` from invoice payment method — ✓

**Customer:**
- Billing dashboard shows active subscription status — ✓ (reads from `subscriptions`)
- No renewal confirmation email sent from the webhook handler (only Stripe's own invoice receipt) — Partial

**Admin:**
- New payment appears in `/admin/billing` — ✓
- Past-due subscriptions alert clears on Overview if subscription was past_due — ✓ (subscription status updates)
- BUT: Admin has no "renewal processed" notification — they must notice the new payment in the billing list

**Sync Failures:**
- MINOR: No renewal confirmation email from the application (Stripe sends receipt, but no custom branded email)
- MINOR: Admin has no alert for successful renewals, only for failures

**Overall: PASS** (minor gaps)

---

## Workflow 8: Marketplace Purchase

**Trigger:** Customer checks out marketplace items → Stripe `checkout.session.completed` with `purchase_type='marketplace'`

### Party Status After Purchase:

**Stripe webhook `checkout.session.completed`:**
- `marketplace_orders` row inserted with `status='paid'`, `fulfillment_status='pending'` — ✓
- `marketplace_order_items` rows inserted — ✓
- `payments` row inserted — ✓
- `confirmation_id` generated (e.g., ORD-12345678) — ✓

**Customer:**
- Order appears in `/dashboard/marketplace` orders tab — ✓ (reads from `marketplace_orders` where user_id matches)
- Confirmation shown with confirmation_id — ✓

**Admin:**
- Order appears in `/admin/billing` Marketplace Orders section — ✓
- Can view line items and update fulfillment status — ✓

**Employee:**
- If order linked to appointment, shows in RescheduleDialog as "Purchased Add-Ons" — ✓ (read-only context)
- Employee portal does NOT show marketplace orders directly — assignment details don't include order items

**Sync Failures:**
- MINOR: Employee does not see what add-ons were purchased when viewing their assignment. They only see the appointment details. The admin can see the linked order, but the technician cannot see "please bring X for this job" from their portal.

**Overall: PASS** (with employee visibility gap)

---

## Summary Table

| Workflow | Status | Critical Failure |
|----------|--------|-----------------|
| 1. Customer books appointment | PASS | None |
| 2. Admin assigns employee | PARTIAL | Future assignments invisible in employee portal |
| 3. Employee completes job | FAIL | appointments.status not cascaded from assignments.status |
| 4. Customer cancels appointment | PARTIAL | assignments not updated on cancellation |
| 5. Customer updates payment method | PARTIAL | Admin cannot see card details |
| 6. Recurring appointment generated | PARTIAL | Manual queue — no auto-generation confirmed |
| 7. Subscription renewal / Stripe webhook | PASS | Minor gaps only |
| 8. Marketplace purchase | PASS | Employee cannot see order add-ons in portal |

---

## Critical Sync Failures Summary

### Failure 1: Job Completion Does Not Update Appointment Status (Workflow 3)
- `POST /api/employee/assignments/:id/status` with `status=completed` updates `assignments` table only
- `appointments.status` remains unchanged
- Customer sees their appointment as "scheduled" forever after job completion
- Admin Visits page (`appointments` WHERE `status='completed'`) never shows the visit
- **This is a data integrity bug with significant customer experience impact**

### Failure 2: Cancellation Does Not Update Employee Assignments (Workflow 4)
- Both customer-cancel and admin-cancel routes update `appointments.status='canceled'`
- Neither route updates the corresponding `assignments` row
- Active technician sees a "scheduled" assignment for a canceled appointment
- Could result in unnecessary technician travel

### Failure 3: Recurring Appointment Generation is Manual (Workflow 6)
- Admin must actively monitor the "Scheduling Queue" on Overview
- If admin is away for a weekend, multiple customers could go weeks without a scheduled appointment
- No automated generation confirmed in codebase

### Failure 4: Employee Cannot See Future Assignments (Workflow 2)
- Employee portal date filter defaults to TODAY
- Assignments for tomorrow/next week are not visible to employee until that day
- No weekly schedule view for employees
