# CASCADE RULE AUDIT
## Generated: 2026-05-29
## Scope: Every significant event — what MUST cascade vs. what CURRENTLY cascades

---

## Event 1: Assignment → completed

**Trigger:** Employee calls `POST /api/employee/assignments/:id/status` with `status = "completed"`
File: `server/routes/employeeAssignments.ts`

### What Should Cascade
1. `appointments.status` → `completed`
2. Customer completion notification email
3. Service order status update (mark fulfilled or trigger next billing period service)
4. Job media availability flag on appointment/service order

### What Currently Cascades (code evidence)

**Appointment status update** (`employeeAssignments.ts` lines 212-223):
```typescript
if (status === "completed" && (updated as any)?.appointment_id) {
  const { error: apptErr } = await db
    .from("appointments")
    .update({ status: "completed" })
    .eq("id", (updated as any).appointment_id)
    .not("status", "in", '("completed","canceled","cancelled","canceled_by_admin","canceled_by_customer")');
}
```
**Status: IMPLEMENTED.** The cascade from `assignments.status = completed` to `appointments.status = completed` exists as of current code.

**Customer notification email** (`employeeAssignments.ts` lines 227-293):
- Fetches appointment context and customer profile
- Sends branded email via Resend if email is configured
- Checks `job_media` for attached photos to customize email text
- Logs to `notification_log` with `notification_type: "appointment_confirmation"`
**Status: IMPLEMENTED** (but uses wrong `notification_type` — see gap below).

**Service order update:** No code updates `service_orders` on assignment completion.
**Status: MISSING.**

**Job media availability:** Not tracked beyond what's in `job_media` table. No flag on appointment or service order that media exists.
**Status: MISSING** (implicit via `job_media` JOIN query).

### Gaps

| Gap | Severity |
|-----|---------|
| `notification_type: "appointment_confirmation"` used for completion email — conflicts with the booking confirmation deduplication index. Second send will silently fail. | High |
| `service_orders` not updated when assignment completes — no record of which service order corresponds to which delivery | Medium |
| No admin notification that a job was completed | Low |

---

## Event 2: Appointment canceled (admin)

**Trigger:** Admin calls `PATCH /api/admin/appointments/:id/cancel`
File: `server/routes/adminAppointments.ts` lines 144-205

### What Should Cascade
1. `appointments.status` → `canceled`
2. `assignments.status` → `skipped` (all active assignments for this appointment)
3. Employee notification (if assigned)
4. Customer notification email
5. Future recurring generation blocked for this slot

### What Currently Cascades

**Appointment status update** (`adminAppointments.ts` line 161):
```typescript
await db.from("appointments").update({ status: "canceled" }).eq("id", id);
```
**Status: IMPLEMENTED.**

**Customer notification email** (`adminAppointments.ts` lines 170-201):
- Builds cancellation email via `buildCancellationEmail()`
- Sends via Resend (fire-and-forget)
- Logs to `notification_log` with `notification_type: "appointment_canceled"`
**Status: IMPLEMENTED.**

**Assignment cascade:** The route fetches the assignment context via `getAppointmentContext()` but does NOT update `assignments.status`.
**Status: MISSING.** No line in the cancel route updates the `assignments` table.

**Employee notification:** No employee notification sent on cancellation.
**Status: MISSING.**

**Future recurring generation:** The cancel route does not write any flag to prevent future appointments from being generated for this subscription. The scheduling queue filters by `subscriptions.status = 'active'`, which is unaffected by individual appointment cancellations. A canceled appointment for an active subscription would still show the subscription in the scheduling queue.
**Status: PARTIALLY MISSING** (scheduling queue still generates new appointments, but this is by design for recurring service — individual appointment cancellation shouldn't block future appointments).

### Gaps

| Gap | Severity |
|-----|---------|
| `assignments.status` not updated on admin cancellation | Critical |
| Employee receives no notification that their assignment was canceled | High |
| Technician may drive to canceled job | Critical |

---

## Event 3: Appointment canceled (customer)

**Trigger:** Customer calls `POST /api/appointments/:id/reschedule`
File: `server/routes/customerAppointments.ts`

**Important finding:** There is NO customer cancel route in `customerAppointments.ts`. The file only contains a reschedule route. Customer cancellation of individual appointments is not exposed as an API endpoint. Customer cancellation of their subscription goes through `billingStripe.ts` (`cancel-subscription`), which cancels the Stripe subscription but does not cancel individual appointments.

### What Should Cascade (if a cancel route existed)
1. `appointments.status` → `canceled`
2. `assignments.status` → `skipped`
3. Employee notification (if assigned)
4. Subscription not affected (appointment cancellation ≠ subscription cancellation)

### What Currently Cascades
**Nothing** for customer-initiated individual appointment cancellations — because the route does not exist. Customers cannot cancel individual appointments through the app; they can only reschedule them or cancel their entire subscription.

### Gaps

| Gap | Severity |
|-----|---------|
| No customer-facing individual appointment cancel API | High — customers must contact admin to cancel individual visits |
| If a customer cancels their subscription (via Stripe portal), individual future appointments remain in `status = 'scheduled'` | Critical |

---

## Event 4: Subscription canceled (Stripe webhook `customer.subscription.deleted`)

**Trigger:** Stripe fires `customer.subscription.deleted`
File: `server/routes/webhooksStripe.ts` lines 582-589

### What Should Cascade
1. `subscriptions.status` → `canceled`
2. Future appointments for this subscription → canceled or flagged
3. Open assignments → skipped
4. Customer access restricted (cannot create new appointments under this subscription)
5. Admin alert

### What Currently Cascades

**Subscription status update** (`webhooksStripe.ts` lines 582-589):
```typescript
case "customer.subscription.deleted": {
  const sub = object as any;
  await supabase.from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", sub.id);
  break;
}
```
**Status: IMPLEMENTED** — subscription status set to `canceled`.

**Future appointment cancellation:**
No code cascades to `appointments` table. Future scheduled appointments for the canceled subscription remain in `status = 'scheduled'`.
**Status: MISSING.**

**Assignment cancellation:**
No code cascades to `assignments` table.
**Status: MISSING.**

**Customer access restriction:**
The `requireActiveSubscription()` guard will now return 403 for billing portal, plan updates, and cancellations (since `status = 'canceled'` does not pass the `status = 'active'` check). Customer is effectively locked out of billing self-service — which is correct post-cancellation.
**Status: HANDLED** (by guard) — though past-due customers face the same lockout and SHOULD still have portal access.

**Admin alert:**
No admin notification sent.
**Status: MISSING.**

### Gaps

| Gap | Severity |
|-----|---------|
| Future `scheduled` appointments not canceled when subscription is deleted | Critical |
| Open `assignments` not `skipped` when subscription is deleted | Critical |
| Admin receives no cancellation notification | High |

---

## Event 5: Annual subscription expired (period end passed)

**Trigger:** `current_period_end < NOW()` for `program = 'annual'` subscriptions.
There is no Stripe webhook for this event — annual plans use PaymentIntents, not Stripe Subscriptions.

### What Should Cascade
1. `subscriptions.status` → `expired`
2. Future appointment generation blocked
3. Customer renewal reminder email
4. Admin alert

### What Currently Cascades
**Nothing.** No code path, webhook, or cron job transitions annual subscriptions from `active` to `expired`.

Evidence: `billingStripe.ts` line 673 sets `current_period_end = periodEnd.toISOString()` (1 year from now). `webhooksStripe.ts` `payment_intent.succeeded` handler (lines 599-614) writes the same. Neither writes any expiry logic. The `netlify/functions/send-reminders.ts` sends appointment reminders but does not check annual plan expiry.

**Status: COMPLETELY MISSING.** Annual subscriptions will remain `status = 'active'` indefinitely after expiry.

### Gaps

| Gap | Severity |
|-----|---------|
| No code expires annual subscriptions after `current_period_end` | Critical |
| Service may be delivered for years after an annual plan expires | Critical |
| No renewal reminder to customer | High |
| No admin alert for expiring plans | High |

---

## Event 6: Payment failed (`invoice.payment_failed`)

**Trigger:** Stripe fires `invoice.payment_failed`
File: `server/routes/webhooksStripe.ts` lines 527-541

### What Should Cascade
1. `subscriptions.status` → `past_due`
2. Admin alert (owner needs to know)
3. Customer notification (with link to update payment method)
4. Billing portal access ALLOWED despite `past_due` status (customer must be able to fix card)

### What Currently Cascades

**Subscription status update** (`webhooksStripe.ts` lines 533-539):
```typescript
if (subscriptionId) {
  await supabase.from("subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscriptionId);
}
```
**Status: IMPLEMENTED.**

**Console warning** (`webhooksStripe.ts` line 531):
```typescript
console.warn("[Webhook] invoice.payment_failed — subscription:", subscriptionId, "customer:", invoice.customer);
```
**Status: LOG ONLY** — no admin notification, no email.

**Customer notification:**
No customer-facing notification sent from the application. Relies on Stripe's own dunning emails if configured in Stripe Dashboard.
**Status: MISSING** from application.

**Billing portal access:**
The `requireActiveSubscription()` function (`billingStripe.ts` lines 214-229) checks for `status = 'active'` only. A customer with `status = 'past_due'` will receive 403 when attempting to access the billing portal to update their payment method.
**Status: ACTIVELY BROKEN.** Creates a deadlock where the customer cannot self-remediate.

### Gaps

| Gap | Severity |
|-----|---------|
| Past-due customers cannot access billing portal to update payment method | Critical |
| No customer notification from the application on payment failure | High |
| No admin notification on payment failure (only visible as past-due KPI on Overview) | High |

---

## Event 7: Payment recovered (`invoice.paid` after `past_due`)

**Trigger:** Stripe fires `invoice.paid` after a subscription was in `past_due` state.
File: `server/routes/webhooksStripe.ts` lines 408-524

### What Should Cascade
1. `subscriptions.status` → `active`
2. Future appointment scheduling re-enabled (if was blocked)
3. Customer confirmation that payment resolved
4. Admin notification that past-due resolved

### What Currently Cascades

**Subscription status update** (`webhooksStripe.ts` `invoice.paid` handler, line 470):
```typescript
await db.from("subscriptions").upsert({
  stripe_subscription_id: subscriptionId,
  ...
  status: "active",
  current_period_end: periodEnd,
  ...
}, { onConflict: "stripe_subscription_id" });
```
**Status: IMPLEMENTED.** `invoice.paid` upserts `status: "active"`, overwriting the `past_due` state.

**Appointment scheduling re-enabled:**
Since scheduling queue filters by `subscriptions.status = 'active'`, recovery is automatic once status is updated.
**Status: HANDLED IMPLICITLY.**

**Customer notification:**
No specific "payment recovered" email sent. Stripe sends invoice receipt.
**Status: MISSING** from application.

**Admin notification:**
No admin notification. The past-due count on Overview will decrease next time it's refreshed.
**Status: MISSING.**

### Gaps

| Gap | Severity |
|-----|---------|
| No "payment resolved" notification to customer from application | Low |
| No admin alert that a past-due subscription is now active again | Low |

---

## Event 8: Employee marks assignment `en_route`

**Trigger:** Employee calls `POST /api/employee/assignments/:id/status` with `status = "en_route"`
File: `server/routes/employeeAssignments.ts` lines 166-299

### What Should Cascade
1. `assignments.status` → `en_route`, `en_route_at` timestamp set
2. Customer SMS (en-route notification)
3. `appointments.status` → `en_route` (optional but useful for admin tracking)

### What Currently Cascades

**Assignment status + timestamp** (`employeeAssignments.ts` lines 190-202):
```typescript
if (status === "en_route" && !current.en_route_at) update.en_route_at = now;
await db.from("assignments").update(update).eq("id", id);
```
**Status: IMPLEMENTED.**

**Customer SMS:**
The employee portal route does NOT send an SMS when the employee sets `en_route`. SMS is only sent via the **admin dispatch** route (`adminAppointments.ts` dispatch, which calls `sendEnRouteSMS`). If the employee marks themselves `en_route` via the portal without admin dispatching first, no SMS is sent.
**Status: MISSING** for employee-self-reported en_route.

**Appointment status cascade:**
The employee status update route only cascades to `appointments.status` for `completed` (lines 212-223). The `en_route` and `in_progress` status transitions do NOT cascade to the parent `appointments` table.
**Status: MISSING.**

### Gaps

| Gap | Severity |
|-----|---------|
| Customer receives no SMS when employee self-marks `en_route` (only when admin dispatches) | High |
| `appointments.status` not updated when assignment goes `en_route` or `in_progress` | Medium |

---

## Event 9: New subscription created (first payment)

**Trigger:** Customer completes payment → `POST /api/billing/confirm-booking` called by client, then async `invoice.paid` webhook.
Files: `server/routes/billingStripe.ts` and `server/routes/webhooksStripe.ts`

### What Should Cascade
1. `subscriptions` row upserted with `status: "active"`
2. First appointment created
3. `properties` updated with program/cadence/service_preferences
4. `profiles.is_onboarded = true`
5. Welcome email sent
6. Service order created

### What Currently Cascades

**`confirm-booking` path** (`billingStripe.ts` lines 633-747):
- Verifies PI succeeded against Stripe (line 646-652)
- Upserts `subscriptions` row (lines 655-684)
- Creates first appointment (lines 688-717)
- Updates `properties` (lines 721-733)
- Sets `profiles.is_onboarded = true` (lines 737-740)
**Status: IMPLEMENTED** for all 4 items except service order (not created here — deferred to `invoice.paid` webhook).

**`invoice.paid` webhook path** (`webhooksStripe.ts` lines 408-524):
- Upserts `subscriptions` again with `current_period_end` (idempotent)
- Writes `payments` row
- Creates `service_orders` via `createSubscriptionServiceOrder()`
- Syncs card details to `profiles`
**Status: IMPLEMENTED.**

**Welcome email:**
No welcome email sent from either `confirm-booking` or `invoice.paid`. Appointment confirmation email is sent if a reminder fires, but no dedicated "welcome to No More Mosquitoes" email exists in the notification templates.
**Status: MISSING.** The `notification_type` CHECK constraint does not include `welcome` or `signup_confirmation`.

### Gaps

| Gap | Severity |
|-----|---------|
| No welcome email sent on first subscription creation | Medium |
| If `confirm-booking` is not called (client crash post-payment), appointment is not created. `invoice.paid` webhook does not create appointments for the PaymentElement path — only for the Checkout redirect path. | Critical |

---

## Event 10: Customer reschedules appointment

**Trigger:** Customer calls `POST /api/appointments/:id/reschedule`
File: `server/routes/customerAppointments.ts` lines 101-201

### What Should Cascade
1. Old slot freed (count decremented for capacity)
2. New slot reserved (count incremented)
3. `appointments` updated with new date/window/scheduled_at
4. `assignments` invalidated or flagged for reassignment
5. Employee notified (if assigned)
6. Customer confirmation email

### What Currently Cascades

**Availability check** (`customerAppointments.ts` lines 129-135):
- Calls `checkWindowAvailability()` excluding the current appointment from the count
- The old slot is "freed" implicitly because the appointment's date/window is about to change
**Status: HANDLED IMPLICITLY** (count is recalculated on each query; no explicit decrement needed).

**Appointment updated** (`customerAppointments.ts` lines 140-156):
- Updates `scheduled_date`, `window`, `window_label`, `scheduled_at`, resets `status = "scheduled"`
**Status: IMPLEMENTED.**

**Assignment invalidation:**
No code updates `assignments` on reschedule. The existing assignment still references the appointment, but its scheduled date is now different. The employee portal shows assignments by `appointments.scheduled_at`, so the employee would now see the rescheduled date — but the assignment `status` is unchanged. If the assignment was `en_route` and the customer reschedules, the assignment remains `en_route`.
**Status: MISSING** formal invalidation/notification.

**Employee notification:**
No employee notification sent on customer reschedule.
**Status: MISSING.**

**Customer confirmation email** (`customerAppointments.ts` lines 162-195):
- Builds reschedule email via `buildRescheduleEmail()`
- Sends via Resend (async fire-and-forget)
- Logs to `notification_log` with `notification_type: "appointment_rescheduled"`
**Status: IMPLEMENTED.**

### Gaps

| Gap | Severity |
|-----|---------|
| Assignment not updated/notified when customer reschedules | High |
| Employee assigned to the old time slot is not notified of the date change | High |
| Assignment `en_route` or `in_progress` status not protected from customer reschedule (could reschedule while technician is en route) | Medium |

---

## Cascade Summary Table

| Event | Required Cascades | Implemented | Missing | Severity |
|-------|-----------------|-------------|---------|---------|
| Assignment → completed | Appt update, customer notification | Both done | Service order update; wrong notification_type | Medium |
| Appointment canceled (admin) | Appt update, assignment skip, employee notify, customer notify | Appt + customer email only | Assignment skip, employee notify | Critical |
| Appointment canceled (customer) | (No individual cancel route exists) | N/A | Entire cancel route | High |
| Subscription canceled (webhook) | Sub status, appt cancel, assignment skip, admin alert | Sub status only | Appt cancel, assignment skip, admin alert | Critical |
| Annual subscription expired | Sub expire, appt block, renewal email | Nothing | Everything | Critical |
| Payment failed | Sub past_due, admin alert, customer notify, portal access | Sub past_due + log | Admin alert, customer email, portal still blocks | Critical |
| Payment recovered | Sub active | Sub active | Customer notify, admin alert | Low |
| Employee → en_route | Assignment update, customer SMS | Assignment update | Customer SMS (self-set en_route), appt status | High |
| New subscription created | Sub, appt, property, profile, welcome email | Sub + appt + property + profile | Welcome email; appt not created if confirm-booking skipped | Critical |
| Customer reschedule | Appt update, assignment notify, customer email | Appt + customer email | Assignment update, employee notify | High |
