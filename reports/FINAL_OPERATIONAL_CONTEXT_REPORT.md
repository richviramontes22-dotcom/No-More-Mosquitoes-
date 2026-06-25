# FINAL OPERATIONAL CONTEXT REPORT
## Generated: 2026-05-29
## Synthesizes: All prior audits + Revenue Lifecycle + Data Integrity + Owner Daily Workflow Simulation

---

## 1. Highest-Risk Operational Blind Spots

These are conditions that can go silently wrong with no visible alert to the owner.

### Blind Spot A: Job Completion Is Permanently Invisible
**What happens silently:** Technician marks job complete in the employee portal. `assignments.status = "completed"`. `appointments.status` never changes — stays `"scheduled"` forever. The admin Visits page shows zero completed visits. The customer sees "scheduled" indefinitely. The owner has no end-of-day confirmation that any service was delivered.

**Evidence:** `server/routes/employeeAssignments.ts` status update route does not update the `appointments` table. Confirmed in `WORKFLOW_SYNCHRONIZATION_AUDIT.md` and `ADMIN_GAP_ANALYSIS.md` (Gap 1).

**Consequence:** After a full week of service, the admin dashboard shows zero completed visits. Disputes about whether service occurred cannot be resolved from the admin side.

---

### Blind Spot B: Canceled Appointments Leave Technicians En Route
**What happens silently:** Admin or customer cancels appointment. `appointments.status = "canceled"`. `assignments.status` remains `"scheduled"`. Technician's portal still shows the assignment. Technician drives to the canceled job.

**Evidence:** Both `adminAppointments.ts` cancel route and there is no customer cancel route that touches `assignments`. Confirmed in `DATA_INTEGRITY_AUDIT.md` Scenario 1 and `ADMIN_GAP_ANALYSIS.md` Gap 2.

**Consequence:** Wasted fuel, labor, and customer confusion if the technician shows up.

---

### Blind Spot C: Annual Subscriptions Expire Silently
**What happens silently:** Annual plan subscriptions have `current_period_end = purchase_date + 365 days`. No code ever sets these subscriptions to `expired` or `canceled` after that date. No alert fires. No renewal email is sent. The subscription row stays `status = "active"` indefinitely after expiry. Service may continue to be scheduled for a customer who has not renewed.

**Evidence:** `billingStripe.ts` writes `current_period_end` correctly. No cron job, trigger, or webhook to expire annual plans (there is no Stripe Subscription object for annual plans, so `customer.subscription.deleted` never fires). Confirmed in `DATA_INTEGRITY_AUDIT.md` Scenario 3.

**Consequence:** Service delivered after the annual period ends without payment. Renewal outreach is missed. Revenue leakage.

---

### Blind Spot D: Failed Payments May Lock Customers Out of Self-Service
**What happens silently:** Customer's subscription goes `past_due`. Customer tries to update their payment card to resolve the failure. `requireActiveSubscription()` in `billingStripe.ts` checks `status = "active"`. Status is `past_due`. Customer gets a 403 error and cannot access the Stripe Billing Portal to fix their payment method. The only recovery path is contacting admin, who also cannot remediate from the admin dashboard.

**Evidence:** `billingStripe.ts` lines 214–229, `requireActiveSubscription()` function. Status check is `.eq("status", "active")` — `past_due` does not pass.

**Consequence:** Failed payment deadlock. Stripe dunning retries but customer cannot proactively fix their card. Churn increases.

---

### Blind Spot E: Lead Funnel Is 100% Invisible
**What happens silently:** Visitors request quotes, view pricing, and leave. Zero data is captured. The business cannot know how many people considered signing up, what addresses/service areas are in demand, or which plan types get the most interest.

**Evidence:** `QuoteWidgetSection.tsx` makes no persistence calls beyond the parcel lookup. `parcel_lookup_cache` is anonymous. No `quote_leads` table. Confirmed across multiple prior audits.

**Consequence:** Marketing is flying blind. Cannot calculate CAC, conversion rate, or geographic demand concentration.

---

### Blind Spot F: Subscription Management Requires Leaving the App
**What happens silently:** Admin cannot see all active subscriptions, their renewal dates, plan types, or status in a single view without opening the Stripe Dashboard or running a CSV export. When a customer calls to cancel, admin must navigate to Stripe, find the customer, and cancel there.

**Evidence:** No `/admin/subscriptions` page. `subscriptions` table is export-only. Confirmed in `ADMIN_GAP_ANALYSIS.md` Gap 3 and `FINAL_ADMIN_READINESS_SCORE.md` (Subscriptions: 15/100).

---

## 2. Next Implementation Sprint (Immediate Priority)

These must be built before the system is operationally trustworthy. In priority order:

### Sprint Immediate — Data Integrity Fixes (1-2 days total)

**Fix 1: Cascade appointment cancellation to assignments** (Complexity: S — under 2 hours)
- File: `server/routes/adminAppointments.ts`, cancel route (line 144)
- Add: `UPDATE assignments SET status='skipped' WHERE appointment_id = $id AND status NOT IN ('completed', 'skipped')`
- Also update customer-side cancellation if that route exists
- Impact: Technicians no longer drive to canceled jobs

**Fix 2: Cascade job completion to appointment status** (Complexity: S — under 2 hours)
- File: `server/routes/employeeAssignments.ts`, status update route
- When `status === "completed"`: `UPDATE appointments SET status='completed', updated_at=NOW() WHERE id = (SELECT appointment_id FROM assignments WHERE id = $assignmentId)`
- Impact: Admin Visits page works. Customer sees correct status. Quality review becomes possible.

**Fix 3: Fix past_due billing portal lockout** (Complexity: S — under 1 hour)
- File: `server/routes/billingStripe.ts`, `requireActiveSubscription()` function (line 217)
- Change: `status = "active"` to `status IN ("active", "past_due")`
- Impact: Customers with failed payments can self-remediate. Prevents deadlock.

**Fix 4: Annual subscription expiry cron** (Complexity: S — under 3 hours)
- Add to existing Netlify scheduled function (or create new `check-subscriptions.ts`)
- SQL: `UPDATE subscriptions SET status='expired' WHERE program='annual' AND status='active' AND current_period_end < NOW()`
- Impact: Expired annual plans no longer appear active. Prevents service delivery after expiry.

---

### Sprint A — Visibility Gaps (3-5 days)

**Build 5: Subscription management page** `/admin/subscriptions` (Complexity: M — 1-2 days)
- Show: customer name, plan type, cadence, status, current_period_end, last_payment_at, cancel_at_period_end, amount
- Actions: Cancel (calls Stripe API), View in Stripe
- Filter: by status, by upcoming renewal date
- Impact: Owner can manage recurring revenue without Stripe Dashboard

**Build 6: Contact inquiries admin view** (Complexity: S — under half day)
- Add tab or section to `/admin/tickets` that queries `contact_inquiries` table
- Impact: Contact form submissions stop being silently lost

**Build 7: MRR/ARR KPI on Overview** (Complexity: S — under half day)
- Query: `SELECT SUM(amount_cents * 12 / cadence_days * 30) / 12 FROM subscriptions WHERE status = 'active' AND program = 'subscription'`
- Add to Overview page KPI cards
- Impact: Core business health metric now visible without Stripe

**Build 8: Job media visible in admin Visits** (Complexity: M — 1 day)
- Join `job_media` to `/admin/visits` page query
- Show thumbnails/video links per completed visit
- Impact: Quality control becomes possible

---

### Sprint B — Strategic Gaps (5-10 days total)

**Build 9: Lead capture at quote widget** (Complexity: M — 1-2 days)
- Add email field to `QuoteWidgetSection.tsx` after acreage lookup (optional, before plan selection)
- Create `quote_leads` table with address, acreage, email, plan_type, price_shown, source, created_at
- Add `/admin/leads` page with sortable table
- Impact: Marketing funnel becomes measurable

**Build 10: Appointment calendar view** (Complexity: L — 3-5 days)
- Add calendar toggle to `/admin/appointments` using react-big-calendar or similar
- Show day/week view with capacity fill rate
- Impact: Scheduling becomes visual and intuitive

**Build 11: Technician productivity metrics** (Complexity: M — 1-2 days)
- Add to `/admin/reports` or employee detail: jobs completed this month, avg duration, media submission rate
- Impact: Performance management becomes data-driven

**Build 12: Annual plan renewal alert** (Complexity: S — under half day)
- Add to Overview: "X annual plans expiring in 30 days" alert with customer list
- Impact: Revenue retention via proactive outreach

---

## 3. Do-Not-Build-Yet List

These would be wasteful to build before the above gaps are closed:

- **GPS tracking for employee portal** — GPS is null always and employees don't need real-time tracking until there are 5+ technicians running simultaneous routes. Current capacity makes this noise.
- **Win-back email automation** — No email marketing infrastructure. Build this after churn is measurable (requires churn metric, Scenario A above first).
- **Ticket reply system** — Tickets exist but there are likely fewer than 10 per month at beta. Email works fine for replies. Build when ticket volume justifies it (50+/month).
- **Stripe webhook reconciliation job** — The webhook handler is correct and Stripe retries for 3 days. A reconciliation job is premature until you've seen actual webhook delivery failures in production logs.
- **Promo code validation at checkout** — Promo codes are stored but no verified integration with Stripe checkout exists. This is a revenue leak only after promotional campaigns are running. Not needed for beta.
- **Shift/time tracking clock in/out** — Schema exists. Build when you have enough employees to need payroll data. Not needed for 1-2 technicians.

---

## 4. Post-Beta Deferral List

These are correct priorities for after beta stabilizes (week 3+):

- Chemicals/checklist/signatures (EPA compliance records) — needed before scaling, not for initial beta
- Calendar appointment view — table view works for low volume
- Customer portal with self-service subscription pause
- Ticket assignment to staff members
- GPS route visualization
- Custom report builder / accounting exports
- Cohort analysis and retention metrics
- Multi-service-area capacity planning

---

## 5. Pre-Scale Requirements

These must exist before growing beyond 10 customers:

1. **Fix 1 + Fix 2** (cascades) — Without these, every additional customer adds to the confusion. The Visits page stays empty forever.
2. **Fix 3** (billing portal lockout) — With 10+ customers, payment failure deadlocks will create support burden that grows exponentially.
3. **Fix 4** (annual expiry) — First annual subscriptions will start expiring around month 12. Need automation before then.
4. **Build 5** (subscriptions page) — With 10+ subscriptions, Stripe Dashboard for management does not scale. The owner will make errors in Stripe.
5. **Build 7** (MRR) — Without MRR, the owner cannot make hiring or pricing decisions. This is table stakes for a subscription business.
6. **Supabase profile creation trigger** (BLOCKER 1 from go/no-go report) — Must be confirmed deployed. Without it, any new user signup that doesn't trigger the hook means no profile row, which breaks billing, notifications, and onboarding.
7. **Admin RLS on appointments** (BLOCKER 2 from go/no-go report) — Must be verified. Without correct RLS, admin sees zero appointments.
8. **At least one active employee record** — The scheduling system needs an employee to assign. The capacity calculation divides by active employee count. Without an employee, capacity is calculated at 1 tech (the hardcoded fallback), which may over-constrain booking.

---

## 6. Is the Business Operable Today?

**Verdict: YES, with significant friction and dangerous blind spots**

**What works end-to-end:**
- Customer can visit the website, get a price quote, sign up, book, and pay via Stripe
- Appointment is created (in both `confirm-booking` and webhook paths with scheduling metadata)
- Admin receives the appointment in their dashboard
- Admin can assign a technician, dispatch en-route SMS, modify date/time, or cancel
- Employee receives email notification and can see the assignment in their portal
- Customer receives confirmation and reminder emails
- Stripe renewals fire correctly and update the subscription row

**What is broken and will cause real operational problems:**
- Technicians completing jobs do NOT update appointment status — admin has no visibility into service delivery
- Canceled appointments do NOT notify assigned technicians — technicians may drive to canceled jobs
- Past-due customers CANNOT self-remediate their payment method
- Annual subscriptions DO NOT expire automatically after 12 months
- Admin has NO subscription management page — all subscription actions require Stripe Dashboard

**Honest assessment:** At 1-3 customers and 1 technician, the system is operable because the owner is hands-on and can compensate for missing automation. At 5+ customers, the broken cascades, invisible completions, and absent metrics will cause operational errors daily. The platform is **beta-launchable for testing the booking flow** but **not production-ready for unattended operations**.

---

## 7. Top 5 Highest-ROI Fixes

Ranked by (business impact / implementation effort):

| Rank | Fix | Effort | Impact | ROI Rationale |
|------|-----|--------|--------|---------------|
| 1 | **Cascade job completion to appointments.status** | 2 hours | Critical | Unlocks Visits page, customer status display, quality control, and all completion-based metrics with a single ~5-line code change |
| 2 | **Cascade cancellation to assignments** | 2 hours | Critical | Prevents technicians from driving to canceled jobs. Protects labor cost from day 1. 5-line change in two routes. |
| 3 | **Fix billing portal lockout for past_due customers** | 1 hour | Critical | One-line fix that allows customers to self-remediate failed payments, reducing churn and support burden |
| 4 | **Annual subscription expiry cron** | 3 hours | High | Prevents revenue leakage from expired annual plans. Requires a small SQL update in the scheduled function. |
| 5 | **MRR/ARR KPI on Overview** | 4 hours | High | Adds the single most important subscription business metric without requiring any new infrastructure — just one SQL aggregation query |

---

## Recommended Sprint Plan

### Sprint 0 — Pre-Launch Verification (1 day, must complete before any real users)
| Task | Complexity | Owner |
|------|-----------|-------|
| Verify Supabase profile creation trigger is deployed | S | DevOps |
| Verify admin RLS policy on appointments table | S | DevOps |
| Confirm all env vars set in Netlify (STRIPE_SECRET_KEY live, RESEND, etc.) | S | DevOps |
| Register Stripe webhook with all required events | S | DevOps |
| Create at least 1 active employee record | S | Admin |

### Sprint 1 — Data Integrity Fixes (2-3 days, launch-critical)
| Task | Complexity | Priority |
|------|-----------|----------|
| Cascade job completion to appointments.status | S | P0 |
| Cascade cancellation to assignments | S | P0 |
| Fix past_due billing portal lockout | S | P0 |
| Annual subscription expiry cron | S | P1 |
| Add MRR/ARR KPI to Overview | S | P1 |

### Sprint 2 — Visibility (1 week, first 2 weeks post-launch)
| Task | Complexity | Priority |
|------|-----------|----------|
| Admin subscriptions management page | M | P0 |
| Contact inquiries visible in admin | S | P0 |
| Job media in admin Visits page | M | P1 |
| Annual renewal alerts on Overview | S | P1 |
| Revenue trend fix (remove hardcoded percentages) | S | P1 |

### Sprint 3 — Growth Infrastructure (2-3 weeks post-launch)
| Task | Complexity | Priority |
|------|-----------|----------|
| Lead capture at quote widget | M | P0 |
| Customer activity tab (appointments, payments per customer) | M | P1 |
| Admin cancel/pause subscription from admin | M | P1 |
| Technician productivity metrics | M | P2 |
| Appointment calendar view | L | P2 |

### Sprint 4 — Scale Readiness (month 2+)
| Task | Complexity | Priority |
|------|-----------|----------|
| Appointment utilization rate visibility | M | P1 |
| Churn rate metric | M | P1 |
| Stripe reconciliation job | M | P2 |
| Employee shift tracking | M | P2 |
| Ticket reply capability | M | P2 |
| GPS tracking | L | P3 |

---

## Revised Operational Readiness Score

*Previous score from FINAL_ADMIN_READINESS_SCORE.md: 52/100*

| Domain | Previous | Current | Change | Rationale |
|--------|----------|---------|--------|-----------|
| Core Payment Flow | 80/100 | 72/100 | -8 | Billing portal lockout (past_due deadlock) discovered |
| Appointment Management | 55/100 | 55/100 | 0 | CRUD works; cascade bug still present |
| Job Completion Tracking | 10/100 | 10/100 | 0 | Critical bug confirmed — no improvement |
| Subscription Management | 15/100 | 15/100 | 0 | No new work done |
| Revenue Lifecycle | 60/100 | 55/100 | -5 | Annual plan expiry gap confirmed; one-time service_orders gap found |
| Lead Generation | 5/100 | 5/100 | 0 | Still zero |
| Data Integrity | 40/100 | 35/100 | -5 | 3 new integrity gaps identified (stale card, orphaned assignments, annual expiry) |
| Owner Daily Workflow | 50/100 | 46/100 | -4 | Workflow simulation confirmed worse than estimated |
| Employee Operations | 50/100 | 50/100 | 0 | No change |
| Notifications | 70/100 | 70/100 | 0 | Working |

**Revised Overall Score: 46/100** (down from 52/100)

The lower score reflects newly discovered issues that were previously unverified: the billing portal lockout for past_due customers, the annual subscription expiry gap, and the deeper data integrity holes confirmed by code-level tracing. The platform is not weaker than previously assessed — the audit is simply more complete.

---

## Beta Go/No-Go — Final Recommendation

**CONDITIONAL GO** — same verdict as the prior FINAL_BETA_GO_NO_GO_REPORT.md, but with revised conditions.

### Pre-Launch Blockers (unchanged from prior report)
1. Supabase profile creation trigger must be confirmed deployed
2. Admin appointments RLS policy must be verified

### New Pre-Launch Conditions (discovered in this audit)
3. **Fix billing portal lockout** (`requireActiveSubscription` must accept `past_due` status) — this is a 1-line code change that prevents permanent customer lock-out when first payment fails
4. **Verify `payment_method.detached` won't cause confusion** — acceptable to skip for beta if payment card display is understood to be stale after card removal

### Launch with Known Technical Debt
The following bugs are accepted technical debt for beta launch but MUST be fixed before charging a second monthly cohort:
- Job completion cascade (Blind Spot A) — owner will notice when Visits page shows empty
- Cancellation cascade to assignments (Blind Spot B) — low risk at 1-2 technicians but increases with team size
- Annual subscription expiry (Blind Spot C) — first annual subscriptions expire in 12 months; cron must be in place before then

### Beta Monitoring Plan
Beyond the monitoring plan in the prior go/no-go report, add:
- Check `subscriptions` table weekly: count `status='past_due'` and manually verify Stripe matches
- Check `assignments` table weekly: find assignments where `appointment.status='canceled'` and `assignment.status='scheduled'` using Scenario 1 diagnostic query
- Check Stripe Dashboard daily for first 2 weeks: confirm every subscription is reflected in local `subscriptions` table

**Launch is appropriate for a controlled beta with the owner actively monitoring.** It is not appropriate for unsupervised operation or public marketing until Sprint 1 is complete.
