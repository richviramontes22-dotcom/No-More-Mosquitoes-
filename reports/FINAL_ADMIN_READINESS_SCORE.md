# FINAL ADMIN READINESS SCORE
## Generated: 2026-05-29
## Core Question: Can the owner successfully operate and scale No More Mosquitoes using the current Admin Dashboard?

---

## Overall Admin Readiness Score

**52 / 100**

**Verdict: Partially Ready — Operational but with Critical Blind Spots**

The admin dashboard is structurally sound and covers day-to-day scheduling, billing visibility, and employee management at a basic level. However, six critical operational blind spots exist that will cause the owner to miss important business events and make decisions without adequate information as the business scales.

---

## Domain Scores (from Phase 7 analysis)

| Domain | Score | Justification |
|--------|-------|---------------|
| Customers | 45/100 | List + search works. Detail sheet is incomplete. No per-customer activity view. No profile editing. |
| Employees | 50/100 | Roster + invite works. No productivity metrics, no shift tracking, no performance data. |
| Scheduling | 55/100 | Full appointment table with filters and CRUD. No calendar view. No auto-generation. |
| Dispatch | 50/100 | Bulk assign + dispatch works. No live GPS. No today's dispatch board. |
| Billing | 60/100 | Payment list, marketplace orders, Stripe link. Cannot cancel/refund from admin. |
| Subscriptions | 15/100 | Export only. No management page. Cannot cancel/pause/view renewal dates. |
| Marketplace | 65/100 | Order list + fulfillment update works. No export or refund. |
| Leads | 5/100 | Zero lead capture. Quote tool is a calculator only. |
| Marketing | 45/100 | Promo codes exist. No campaign analytics. No proof checkout validates codes. |
| Support | 40/100 | Ticket Kanban works. No reply, no search, no assignment, no contact inquiries view. |
| Service Areas | 85/100 | Add/toggle/remove works. No geo visualization. |
| Capacity Planning | 10/100 | Business hours define max capacity but no visibility into fill rate. |
| Revenue Metrics | 40/100 | Real Stripe data. Hardcoded trend %s. No MRR/ARR. No plan-type breakdown. |
| Retention Metrics | 5/100 | Customer status badge only. No churn rate, at-risk alerts, or cohort analysis. |
| Technician Productivity | 5/100 | Current assignment status only. No jobs/day, completion rate, or duration stats. |
| Appointment Utilization | 5/100 | No slots filled vs available metric anywhere. |

**Average Domain Score: 52/100**

---

## Critical Blind Spots

These gaps will cause the owner to miss or be blind to real business events:

### Blind Spot 1: Job Completion Status Never Updates
**What happens:** Technician marks job done → `appointments.status` stays `scheduled` → Customer sees "scheduled" indefinitely → Admin Visits page shows empty → Quality control requires manual investigation.

**Evidence:** `server/routes/employeeAssignments.ts` status route does not update `appointments` table. Confirmed by code inspection.

**Who gets hurt:** Customers (wrong status shown), Admin (can't see completed visits), Quality team (no job media surfaced).

---

### Blind Spot 2: Quote Tool Captures Zero Lead Data
**What happens:** 100% of visitors who get a quote and don't immediately sign up disappear without any record. The business collects no email, no address context, no plan interest from any anonymous visitor.

**Evidence:** `QuoteWidgetSection.tsx` makes no server call to store lead data. `parcel_lookup_cache` is anonymous. No `quote_leads` table in any migration.

**Who gets hurt:** Owner (no retargeting, no follow-up), Sales (no pipeline).

---

### Blind Spot 3: No Subscription Management
**What happens:** Owner cannot see a list of all subscriptions, renewal dates, at-risk customers, or cancel/pause from admin. Must use Stripe dashboard for all subscription management.

**Evidence:** No `/admin/subscriptions` page. `subscriptions` table has no dedicated admin UI beyond export.

**Who gets hurt:** Owner (cannot manage recurring revenue), Support staff (cannot handle cancellation calls in-app).

---

### Blind Spot 4: Cancellation Leaves Employee Assignments Active
**What happens:** Customer or admin cancels appointment → technician's assignment remains in `status='scheduled'` → technician drives to a canceled job.

**Evidence:** `server/routes/adminAppointments.ts` cancel route updates `appointments` only. No `assignments` update.

**Who gets hurt:** Technicians (wasted time), Owner (wasted vehicle costs), Customer (confused if technician shows up anyway).

---

### Blind Spot 5: Contact Inquiries and Schedule Requests Are Invisible
**What happens:** Potential customers fill out contact form or schedule request → data goes into `contact_inquiries` and `schedule_requests` tables → admin has no UI to see or respond.

**Evidence:** `contact_inquiries` table has admin RLS policy but no admin page queries it. `schedule_requests` table receives no data from current flows.

**Who gets hurt:** Owner (missed leads), Potential customers (no response).

---

### Blind Spot 6: No Retention or Churn Visibility
**What happens:** Customers quietly cancel subscriptions. Owner has no churn rate, no at-risk alerts, no renewal tracking. Cannot identify customers likely to churn before they do.

**Evidence:** No churn calculation anywhere. Customer status badge is the only signal. No subscription timeline for admin.

**Who gets hurt:** Owner (revenue surprise), Business (cannot proactively retain customers).

---

## Short-Term Fixes (1-3 Days That Would Meaningfully Improve Operability)

Prioritized by highest business impact per implementation hour:

### Fix 1: Cascade job completion to appointments.status (1-2 hours)
Add to `server/routes/employeeAssignments.ts` status handler: when status=completed, also run `UPDATE appointments SET status='completed' WHERE id = $appointmentId`. This alone unlocks the Visits page and restores the customer dashboard completion display.

### Fix 2: Cascade cancellation to assignments (30 minutes)
Add to both cancel routes: `UPDATE assignments SET status='skipped' WHERE appointment_id = $id AND status NOT IN ('completed','no_show')`.

### Fix 3: Revenue trend calculations (2-3 hours)
Replace the two hardcoded strings in `Revenue.tsx` with real period-over-period calculations from the Stripe revenue API.

### Fix 4: MRR on Overview dashboard (2-3 hours)
Add MRR KPI: `SELECT SUM(amount_cents) FROM subscriptions WHERE status='active'` → divide by cadence_days × 30 to approximate monthly value. Add as a 7th KPI card.

### Fix 5: Contact inquiries admin view (2-4 hours)
Add a simple table at the bottom of `/admin/tickets` or a new tab that reads from `contact_inquiries`. Single Supabase query + table component.

### Fix 6: Email capture on quote widget (half day)
Add an optional email field before price display. On submission, write to a new `quote_leads` table (address, email, plan, price_seen, created_at). Admin can see leads in a new simple table page.

### Fix 7: Customer activity tab — real appointments list (half day)
In `CustomerDetailsSheet`, Activity tab: query `appointments WHERE user_id = customerId LIMIT 5`. Render a small table. Replace placeholder with real data.

---

## Sprint Plan — Recommended Priority Order

### Sprint A: Critical Data Integrity + Visibility (Week 1)
Goal: Fix broken data flows and add the minimum visibility needed to operate.

1. Job completion cascade to appointments.status
2. Cancellation cascade to assignments
3. Revenue trend real calculations
4. MRR KPI card on Overview
5. Contact inquiries admin view
6. Customer detail activity tab — real appointment list
7. Quote widget email capture + quote_leads table + admin table

**Estimated: 4-6 days of engineering**

---

### Sprint B: Subscriptions + Retention (Week 2-3)
Goal: Make recurring revenue manageable without Stripe dashboard.

1. Subscriptions management page (`/admin/subscriptions`)
2. Subscription cancel/pause from admin (calls Stripe API via server)
3. Churn rate calculation on Overview or Revenue page
4. At-risk customer alert (past_due + no upcoming appointment)
5. Auto-generate recurring appointments (scheduled Netlify function)

**Estimated: 5-7 days of engineering**

---

### Sprint C: Operations Quality (Week 3-4)
Goal: Complete the scheduling, dispatch, and support workflows.

1. Appointment calendar view
2. Job media display in Visits admin
3. Ticket reply capability
4. Technician productivity metrics
5. Business hours window editing
6. Admin alert for new bookings

**Estimated: 7-10 days of engineering**

---

### Sprint D: Employee Accountability (Week 5-6)
Goal: Add employee tracking and time recording.

1. Shift clock-in/out in employee portal
2. Admin shift hours view
3. Assignment view/acknowledgment tracking
4. Assignment future dates in employee portal
5. GPS location reporting (if required)

**Estimated: 5-8 days of engineering**

---

## Final Verdict

**Verdict: Partially Ready**

The platform can support day-to-day operations for a small team (< 5 customers, < 3 technicians) where the owner personally monitors everything manually. However, it is NOT ready to scale without addressing the Critical Blind Spots above.

The most dangerous single condition is **Blind Spot 1** (job completion status bug) because it means the system's record of what has been completed is fundamentally broken. Every completed job appears perpetually scheduled. This is not a missing feature — it is a data integrity defect that should be fixed before any customer-facing launch.

**Pre-scale readiness requires at minimum Sprint A completion.**

At Sprint A completion, estimated readiness: **68/100**
At Sprint B completion, estimated readiness: **78/100**
At Sprint C+D completion, estimated readiness: **88/100**

A score of 88/100 represents a mature, operationally capable field service management platform. The remaining 12 points represent advanced analytics and integrations that most small-to-medium businesses do not require at launch.
