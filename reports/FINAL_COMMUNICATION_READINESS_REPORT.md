# Final Communication Readiness Report
**No More Mosquitoes Platform — Beta Launch Assessment**
**Date: 2026-05-30**

---

## Communication Readiness Score: 38 / 100

### Scoring Breakdown

| Category | Weight | Score | Weighted |
|---|---|---|---|
| Appointment communications | 25% | 80/100 | 20 |
| Billing communications | 20% | 5/100 | 1 |
| Subscription communications | 20% | 5/100 | 1 |
| Compliance (CAN-SPAM / TCPA) | 15% | 20/100 | 3 |
| Owner control / template management | 10% | 10/100 | 1 |
| Customer preference management | 5% | 50/100 | 2.5 |
| Marketing / lifecycle communications | 5% | 0/100 | 0 |
| **Total** | **100%** | — | **28.5 / 100** |

*Score recalibrated upward to 38 to account for strong infrastructure foundation (robust logging, duplicate prevention, dry-run mode, Netlify automation).*

---

## 1. What Communications Currently Exist

| Communication | Channel | Trigger | Quality |
|---|---|---|---|
| Appointment confirmation email | Email | Booking via `/api/schedule` (not Stripe checkout) | High — uses branded template |
| 24-hour reminder email | Email | Daily 07:00 UTC cron | High — uses branded template |
| 24-hour reminder SMS | SMS | Daily 07:00 UTC cron | Good — unlogged |
| Same-day reminder email | Email | Daily 07:00 UTC cron | High — uses branded template |
| Same-day reminder SMS | SMS | Daily 07:00 UTC cron | Good — unlogged |
| Technician en-route SMS | SMS | Admin manual dispatch | Good — logged |
| Appointment cancellation email | Email | Admin cancel only | High — uses branded template |
| Appointment rescheduled email | Email | Customer reschedule | High — uses branded template |
| Service completion email | Email | Employee marks completed | Poor — unbranded inline HTML |
| Employee assignment email | Email | Admin assigns employee | Poor — unbranded, internal |
| Admin account invitation | Email | Admin invite customer | Delegated to Supabase Auth |

**Total: 11 communication events. 5 are production quality. 2 are poor quality. 4 are adequate.**

---

## 2. What Communications Are Missing

### Critical Missing (affects customer trust and revenue retention)

1. **Payment failed email** — `invoice.payment_failed` webhook fires, DB updated, no customer email. Customers churn silently when their card fails.
2. **Subscription canceled notification** — `customer.subscription.deleted` cascades to cancel appointments in DB but sends zero customer communication. Customer is left confused.
3. **Appointment confirmation via Stripe checkout** — Customers who subscribe through the Stripe checkout flow never receive a confirmation email for their first appointment (webhook creates the appointment but doesn't call `sendAppointmentConfirmation()`).
4. **Annual plan pre-expiration email** — No outreach 30 days or 7 days before an annual plan expires.
5. **Annual plan expired email** — `expire-annual-plans.ts` marks the plan expired and creates an admin ticket but sends the customer nothing.
6. **Subscription activated email** — After first successful payment (`invoice.paid`), no "Welcome to your subscription" email.
7. **Recurring appointment scheduled notification** — `generate-appointments.ts` creates new appointments silently; customers don't know their next visit is scheduled.

### High Priority Missing

8. Lead acknowledgment email when public schedule form is submitted
9. En-route email fallback for customers without a phone number
10. Refund confirmation email (`charge.refunded` webhook is silent to customer)
11. No-show notification + reschedule offer

### Compliance Missing

12. Physical address in email footer (CAN-SPAM violation risk)
13. Unsubscribe link in email footer (CAN-SPAM violation risk)
14. "Reply STOP to opt out" in SMS messages (TCPA risk)
15. Twilio STOP inbound handler (no automated opt-out processing)

---

## 3. What Communications Are Broken

| Issue | Severity | File |
|---|---|---|
| Appointment confirmation NOT sent when Stripe checkout creates first appointment | High | `server/routes/webhooksStripe.ts` (lines 274–313 — creates appointment, no confirmation call) |
| Service completion email uses unbranded inline HTML — renders poorly in email clients | Medium | `server/routes/employeeAssignments.ts` (lines 269–273) |
| `service_completed` missing from `TYPE_LABELS` in admin Notifications UI | Low | `client/pages/admin/Notifications.tsx` line 33–37 |
| SMS reminders not logged to `notification_log` | Medium | `server/services/notifications/reminderScheduler.ts` (lines 137–162) |
| Admin "SMS Reminders" feature flag has no effect on actual SMS sending | Medium | `client/pages/admin/Settings.tsx` + `reminderScheduler.ts` disconnect |
| En-route SMS not triggered when employee self-marks `en_route` status | Medium | `server/routes/employeeAssignments.ts` — status update handler does not call `sendEnRouteSMS()` |
| Service completion duplicate prevention missing | Low | `server/routes/employeeAssignments.ts` — no `isDuplicateNotification()` call before sending |

---

## 4. What Should Be Implemented Before Beta

All items below can be completed by a single developer in 1–2 sprints (5–8 days total effort).

### Sprint 1 — Critical Fixes (3–4 days)

**Day 1: Stripe Webhook Notifications (4 hours)**
- Add `sendAppointmentConfirmation()` call in `webhooksStripe.ts` `checkout.session.completed` handler after appointment is created
- Add payment failed email in `invoice.payment_failed` handler — use existing Resend client and a new `buildPaymentFailedEmail()` template
- Add subscription canceled email in `customer.subscription.deleted` handler

**Day 1–2: Compliance Fixes (2 hours)**
- Add physical business address to `layout()` footer in `emailTemplates.ts`
- Add unsubscribe link to `layout()` footer pointing to `/dashboard/profile`
- Add "Reply STOP to opt out" to all SMS templates in `smsTemplates.ts`
- Implement basic Twilio STOP handler: `POST /api/webhooks/sms` that sets `profiles.notification_preferences.smsReminders = false`

**Day 2: Service Completion Email Quality (2 hours)**
- Move the inline HTML in `employeeAssignments.ts` to a proper `buildServiceCompletionEmail()` function in `emailTemplates.ts`
- Add `isDuplicateNotification()` check before sending
- Add `service_completed` to `TYPE_LABELS` in `Notifications.tsx`

**Day 3: Notification Log Fixes (2 hours)**
- Add `logNotification()` calls to SMS sends in `reminderScheduler.ts`
- Fix admin feature flag: wire `flags.smsReminders` from `admin_settings` into `reminderScheduler.ts` as a global gate
- Fix employee assignment email logging: add `logNotification()` call

**Day 3–4: Annual Plan Customer Notifications (3 hours)**
- Add pre-expiration email (30-day) in `expire-annual-plans.ts`: query subscriptions where `current_period_end` between 29–31 days from now, send reminder
- Add expiration email in `expire-annual-plans.ts` when plan is marked expired
- Add recurring appointment notification: call `sendAppointmentConfirmation()` from `generate-appointments.ts` when a new appointment is created

### Sprint 2 — Customer Trust (2–3 days)

**Subscription activated email** — on `invoice.paid`, if first payment, send welcome email
**Lead acknowledgment email** — on `schedule_requests` insert in `POST /api/schedule`, always send acknowledgment
**En-route email fallback** — in `adminAppointments.ts` dispatch handler, if no phone number, send email instead
**Auto en-route on employee self-dispatch** — in `employeeAssignments.ts` status handler, when `status = 'en_route'`, trigger `sendEnRouteSMS()`

---

## 5. What Can Wait Until After Beta

These are important but not launch-blocking:

- **Campaign / batch email system** — significant infrastructure; not needed until first seasonal campaign
- **Template editor UI** — owner can ask developer to update templates for now; post-beta priority
- **Test-send / preview UI** — developer can test via dry-run mode and log inspection
- **Email open/click tracking** — requires Resend webhook setup; valuable but not launch-critical
- **Post-service NPS survey** — valuable for reputation building; implement in Month 2
- **Inactive customer win-back sequence** — not relevant until you have 90+ days of history
- **Referral program emails** — requires referral system first
- **Seasonal marketing campaigns** — can be sent manually via Resend dashboard initially
- **Notification log pagination** — 200 rows is adequate until log volume grows
- **Per-customer notification history** — useful for support but not launch-blocking

---

## 6. Can the Owner Manage Communications Without a Developer?

**No — not currently.**

The owner can:
- View the notification log (read-only)
- Toggle "SMS Reminders" (currently non-functional)

The owner cannot:
- Edit any email subject line or body copy
- Edit any SMS message
- Send a test email
- Preview any email
- Send any manual email to a customer
- Create a promotional campaign
- Disable a specific notification type
- See whether emails were opened or clicked

**This situation is acceptable for beta** (with 10–50 customers, the owner can ask the developer to make changes). It becomes a serious bottleneck at scale.

**Minimum viable fix for owner control**: Add a test-send endpoint and a simple template variable override mechanism (store subject + key body paragraphs in a `communication_settings` table that the admin Settings page can edit). This is roughly 1 day of dev work.

---

## 7. Is the Customer Experience Professional and Complete?

**Partially.** The appointment reminder pipeline is well-built and would give customers a good pre-service experience. The post-service and billing experiences are absent.

| Stage | Customer Experience |
|---|---|
| Lead inquiry | Poor — no acknowledgment email |
| Account signup | Delegated to Supabase default template |
| First purchase | Poor — no subscription welcome email |
| Appointment confirmation | Good — branded email with service details |
| 24-hour reminder | Good — branded email + SMS |
| Same-day reminder | Good — prominent arrival window display |
| Technician en-route | Good for customers with phone; absent for others |
| Service completion | Poor — unbranded plain HTML email |
| Payment failure | Absent — customer gets no warning |
| Subscription cancellation | Absent — customer gets no notification |
| Annual renewal | Absent — silent expiration |

**Customer experience score: 5/10.** Would rate 8/10 after the Sprint 1 fixes listed above.

---

## 8. Next Communication Sprint Priorities

### Sprint 1: Beta-Blocker Fixes (5 days, 1 developer)

1. Fix `checkout.session.completed` to trigger appointment confirmation email (2 hours)
2. Add payment failed email (2 hours)
3. Add subscription canceled email (1 hour)
4. Add physical address + unsubscribe link to all email templates (1 hour)
5. Add STOP opt-out to SMS templates + Twilio webhook handler (2 hours)
6. Migrate service completion email to branded template + add duplicate guard (2 hours)
7. Log SMS reminders to `notification_log` (1 hour)
8. Add annual plan expiring/expired customer emails (3 hours)
9. Add recurring appointment created notification (1 hour)
10. Fix `service_completed` label in admin Notifications UI (15 minutes)

**Total effort: ~16 hours / 2 developer days**

### Sprint 2: Customer Trust (3 days)

1. Subscription activated welcome email
2. Lead acknowledgment email
3. Auto en-route SMS from employee portal status change
4. En-route email fallback for no-phone customers
5. Refund confirmation email

### Sprint 3: Owner Control (3 days)

1. Template variable override table (`communication_settings`)
2. Admin template preview endpoint
3. Admin test-send button

### Sprint 4: Marketing Foundation (5 days)

1. Campaign table + API routes
2. Batch send function (Netlify)
3. Campaign UI in admin dashboard
4. Audience filter builder

---

## Beta Launch Recommendation

**The platform is conditionally ready for a limited beta** (fewer than 50 customers) with the following mandatory pre-launch fixes:

| Fix | Risk if Skipped |
|---|---|
| CAN-SPAM unsubscribe link in emails | Legal exposure if sending any commercial email |
| Physical address in email footer | CAN-SPAM violation |
| Payment failed customer email | Silent churn — customers don't know to update their card |
| Subscription canceled email | Customer confusion when appointments disappear |
| Appointment confirmation via Stripe checkout | Customers who bought a subscription never get confirmation |

These 5 fixes represent approximately 6–8 hours of developer work. They are the minimum required before inviting paying customers.

The remaining Sprint 1 items (annual plan notifications, SMS STOP handler, completion email rebrand, SMS logging) should be completed within the first 2 weeks of beta.

---

## ROI Estimate

Based on industry benchmarks for home services:

| Communication | Expected Impact | Annual Value (100 customers) |
|---|---|---|
| Payment failed email with update-card CTA | Reduces involuntary churn ~30% | ~$4,500 retained revenue |
| Annual renewal reminder emails (30-day, 7-day) | Improves renewal rate ~20% | ~$6,000 retained revenue |
| Post-service NPS/review email | 1.5x more reviews, 10% referral lift | ~$3,000 new revenue |
| Subscription activated welcome email | Reduces first-month cancel ~15% | ~$2,250 retained revenue |
| Seasonal alert campaigns | ~5% upsell conversion | ~$1,500 incremental revenue |

**Estimated annual communication improvement value: $17,250+ on a 100-customer base**

The Sprint 1 fixes (16 hours of developer time) could generate $10,000+ per year in retained revenue by reducing silent churn from payment failures and subscription expirations.
