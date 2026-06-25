# ADMIN GAP ANALYSIS
## Generated: 2026-05-29
## Scope: Prioritized list of all admin capability gaps found in Phases 1–8

---

## Gap 1: Job Completion Does Not Update Appointment Status

| Field | Value |
|-------|-------|
| **Gap Title** | Employee job completion does not cascade to appointments.status |
| **Severity** | Critical |
| **Business Justification** | When a technician marks a job done, customers and admin must see "completed." Currently the appointment status stays "scheduled" forever after the technician marks the assignment complete. |
| **Current State** | `POST /api/employee/assignments/:id/status` updates `assignments.status=completed` only. `appointments.status` is never updated by this route. |
| **Desired State** | When `assignments.status` is set to `completed`, a corresponding `UPDATE appointments SET status='completed'` should execute as either a server-side follow-up write or a PostgreSQL trigger. |
| **Operational Impact** | Admin Visits page never shows completed visits. Customers see "scheduled" status indefinitely. Metrics for completion rate are impossible. Job media review requires knowing which appointment completed — impossible if status is wrong. |
| **Implementation Complexity** | S (< 1 day) — add one additional Supabase update call in the employee status route OR add a DB trigger |
| **Recommended Priority** | Sprint A |

---

## Gap 2: Cancellation Does Not Cascade to Employee Assignments

| Field | Value |
|-------|-------|
| **Gap Title** | Appointment cancellation does not update linked employee assignments |
| **Severity** | Critical |
| **Business Justification** | When admin or customer cancels an appointment, the assigned technician should be notified and their assignment cleared. Otherwise technicians drive to canceled jobs. |
| **Current State** | `PATCH /api/admin/appointments/:id/cancel` sets `appointments.status='canceled'` and sends customer email. Does not touch `assignments` table. Customer-cancel route same behavior. |
| **Desired State** | On cancellation: `UPDATE assignments SET status='skipped' WHERE appointment_id = ?`. Optional: send notification to assigned employee. |
| **Operational Impact** | Technicians waste time and fuel traveling to jobs that were canceled. Employee tracking shows en_route to a canceled appointment. |
| **Implementation Complexity** | S (< 1 day) — add one additional Supabase update in both cancel routes |
| **Recommended Priority** | Sprint A |

---

## Gap 3: No Subscriptions Management Page

| Field | Value |
|-------|-------|
| **Gap Title** | Admin has no subscription management interface |
| **Severity** | Critical |
| **Business Justification** | Subscriptions are the core revenue model. Admin must be able to see all active subscriptions, their renewal dates, plan type, and status without going to Stripe. |
| **Current State** | `subscriptions` table exists. Customer status badge inferred from it in customers list. Export available. No dedicated subscriptions page. |
| **Desired State** | `/admin/subscriptions` page showing: customer name, plan/cadence, status, current_period_end, amount, cancel_at_period_end, last_payment_at. Actions: cancel, pause, view in Stripe. |
| **Operational Impact** | Owner cannot manage recurring revenue without leaving the app. Cannot identify which customers are at risk (past_due, about to cancel). Cannot answer basic business questions: "How many 21-day subscribers do I have?" |
| **Implementation Complexity** | M (1-3 days) — new page querying existing `subscriptions` table with profiles join |
| **Recommended Priority** | Sprint A |

---

## Gap 4: No Lead Capture at Quote Widget

| Field | Value |
|-------|-------|
| **Gap Title** | Quote tool captures zero lead data |
| **Severity** | Critical |
| **Business Justification** | The homepage/pricing page quote widget is the primary customer acquisition tool. Every visitor who gets a quote is a warm lead. Currently these visitors are invisible. |
| **Current State** | Quote widget collects address + shows price. No email capture, no visitor identification, no data persistence beyond parcel cache. |
| **Desired State** | At minimum: email capture field before showing price results. All quote sessions stored in a `quote_leads` table with address, email, plan selected, price shown, timestamp. Admin `/admin/leads` page to review. |
| **Operational Impact** | 100% of abandoned quotes result in zero follow-up opportunity. The business has no awareness of interest level or address distribution of potential customers. |
| **Implementation Complexity** | M (1-3 days) — email field + leads table + admin page |
| **Recommended Priority** | Sprint A |

---

## Gap 5: Job Media Not Visible to Admin

| Field | Value |
|-------|-------|
| **Gap Title** | Employee-uploaded job photos/videos are inaccessible to admin |
| **Severity** | Critical |
| **Business Justification** | Job media is evidence of service delivery, customer documentation, and quality control. Admin must be able to view photos submitted by technicians. |
| **Current State** | `job_media` table and `job-media` Supabase Storage bucket exist. Employee portal writes to both. Zero admin pages query `job_media`. |
| **Desired State** | `/admin/visits` should show job media thumbnails. `/admin/appointments` modify dialog should optionally show media. An admin job media gallery for quality review. |
| **Operational Impact** | Quality control is impossible. Customer disputes about service quality cannot be investigated. Required for "requireCompletionVideo" feature flag to have any meaning. |
| **Implementation Complexity** | M (1-3 days) — add `job_media` join to Visits query + render thumbnails/video |
| **Recommended Priority** | Sprint A |

---

## Gap 6: Contact Inquiries Not Visible to Admin

| Field | Value |
|-------|-------|
| **Gap Title** | Contact form submissions have no admin UI |
| **Severity** | High |
| **Business Justification** | Customers who fill out the contact form are active leads. They should be responded to promptly. Currently admin has no visibility. |
| **Current State** | `contact_inquiries` table exists with RLS policy "Admins can read contact inquiries." No admin page queries it. |
| **Desired State** | Simple table in `/admin/tickets` or a new `/admin/leads` page showing contact inquiries with name, email, phone, message, status, created_at. Mark as read/replied. |
| **Operational Impact** | Contact form submissions go unread unless admin manually queries the DB. Lost conversion opportunity. |
| **Implementation Complexity** | S (< 1 day) — one Supabase query + simple table component |
| **Recommended Priority** | Sprint A |

---

## Gap 7: Customer Activity Tab Is a Placeholder

| Field | Value |
|-------|-------|
| **Gap Title** | Customer detail sheet Activity and Finance tabs are placeholders |
| **Severity** | High |
| **Business Justification** | Support staff need to see a customer's full history from a single view (appointments, tickets, payments) to handle a support call effectively. |
| **Current State** | Activity tab shows `AdminEmptyState` with links to other pages. Finance tab same. Links open full lists without filtering to the customer. |
| **Desired State** | Activity tab should show the customer's last 5 appointments (filtered by user_id). Finance tab should show the customer's last 5 payments and active subscription. |
| **Operational Impact** | Every support interaction requires admin to manually navigate to 3-4 different pages and search for the customer each time. High friction support workflow. |
| **Implementation Complexity** | M (1-3 days) — add filtered queries inside CustomerDetailsSheet for appointments, payments, tickets |
| **Recommended Priority** | Sprint A |

---

## Gap 8: No Appointment Calendar View

| Field | Value |
|-------|-------|
| **Gap Title** | Appointments page has no calendar/weekly view |
| **Severity** | High |
| **Business Justification** | Visualizing the week's schedule as a calendar is fundamentally easier than reading a table. Essential for scheduling and capacity decisions. |
| **Current State** | `/admin/appointments` shows a sortable/filterable table only. Date filter narrows the table but no visual calendar. |
| **Desired State** | Calendar view (day/week) showing appointment blocks per technician. Click slot to create/edit appointment. |
| **Operational Impact** | Higher cognitive load for schedulers. Harder to spot open slots or over-scheduled days. |
| **Implementation Complexity** | L (3-7 days) — add calendar component (react-big-calendar or similar) with appointment data |
| **Recommended Priority** | Sprint B |

---

## Gap 9: No Recurring Appointment Auto-Generation

| Field | Value |
|-------|-------|
| **Gap Title** | Active subscriptions do not auto-generate next appointments |
| **Severity** | High |
| **Business Justification** | Customers paid for recurring service. The system should automatically schedule appointments based on the subscription cadence. Manual queue monitoring is error-prone. |
| **Current State** | Admin must notice the Scheduling Queue alert and manually create each appointment. |
| **Desired State** | A scheduled function (cron job) runs daily, identifies active subscriptions whose next appointment is due, and creates appointment records automatically (or sends admin a daily digest). |
| **Operational Impact** | If admin misses the queue for 2 days, customers go without scheduled appointments. Manual burden scales poorly. |
| **Implementation Complexity** | M (1-3 days) — scheduled Netlify function or cron script that queries subscriptions + appointments and auto-creates records |
| **Recommended Priority** | Sprint A |

---

## Gap 10: No Ticket Reply Capability

| Field | Value |
|-------|-------|
| **Gap Title** | Admin cannot reply to customer support tickets |
| **Severity** | High |
| **Business Justification** | Support tickets require responses. Admin needs to communicate with customers through the ticket system. |
| **Current State** | `/admin/tickets` Kanban board allows status changes only. No reply input. |
| **Desired State** | Ticket detail view with reply textarea + "Send Reply" button that emails the customer and records the reply in a `ticket_replies` table. |
| **Operational Impact** | Admin must use external email for all ticket responses. Ticket system is tracking-only. No communication history. |
| **Implementation Complexity** | M (1-3 days) — ticket replies table + reply UI + email send |
| **Recommended Priority** | Sprint B |

---

## Gap 11: Business Hours Window Editing Not Functional

| Field | Value |
|-------|-------|
| **Gap Title** | Business hours windows (times, labels, max_jobs_per_tech) cannot be edited from admin |
| **Severity** | High |
| **Business Justification** | If the business extends afternoon hours or adds an evening window, admin must be able to update this. Currently locked to seeded values. |
| **Current State** | `/admin/business-hours` allows toggling days on/off. The `windows` JSONB (start time, end time, label, max_jobs_per_tech) is read-only. |
| **Desired State** | Editable fields for each window's start/end time and capacity per tech. Add/remove windows per day. |
| **Operational Impact** | Cannot adjust service hours without a developer deploying a migration or SQL update. |
| **Implementation Complexity** | M (1-3 days) — add window editing form within BusinessHours page, update PATCH endpoint to accept windows array changes |
| **Recommended Priority** | Sprint B |

---

## Gap 12: Technician Productivity Metrics

| Field | Value |
|-------|-------|
| **Gap Title** | No technician performance data visible to admin |
| **Severity** | High |
| **Business Justification** | Owner must be able to evaluate technician performance: jobs per day, completion rate, media submission, time per job. |
| **Current State** | `assignments` table stores lifecycle timestamps. No admin page aggregates this. |
| **Desired State** | Employee detail or a new `/admin/reports` section showing per-technician: jobs completed this month, average job duration (started_at to completed_at), no_show/skip count, media submitted. |
| **Operational Impact** | Cannot identify underperforming employees. Cannot make data-driven staffing decisions. |
| **Implementation Complexity** | M (1-3 days) — SQL aggregation queries on `assignments` table + new admin metrics component |
| **Recommended Priority** | Sprint B |

---

## Gap 13: No Admin Alert for New Bookings

| Field | Value |
|-------|-------|
| **Gap Title** | Admin has no notification when new appointments are booked |
| **Severity** | Medium |
| **Business Justification** | When a new customer books, admin should know promptly to prepare for service. |
| **Current State** | Appointments appear in the list when admin next checks. No real-time notification. |
| **Desired State** | Email to admin when new appointment is scheduled (during off-hours). Notification badge on appointments nav link. |
| **Operational Impact** | Admin who checks the dashboard once a day may miss same-day bookings. |
| **Implementation Complexity** | S (< 1 day) — add admin email notification in schedule route, or add unread appointments count to nav |
| **Recommended Priority** | Sprint B |

---

## Gap 14: No Subscription Cancel/Pause from Admin

| Field | Value |
|-------|-------|
| **Gap Title** | Admin cannot cancel or pause a subscription from the admin panel |
| **Severity** | Medium |
| **Business Justification** | When a customer calls to cancel or pause, admin should be able to do it from the CRM without logging into Stripe. |
| **Current State** | Stripe dashboard required for subscription management. |
| **Desired State** | Cancel/pause button in customer detail or subscriptions page that calls Stripe API via backend. |
| **Operational Impact** | Two-platform workflow. Increases risk of errors (modifying wrong customer in Stripe). Friction for support staff. |
| **Implementation Complexity** | M (1-3 days) — server route calling Stripe API for subscription cancellation + UI button |
| **Recommended Priority** | Sprint B |

---

## Gap 15: Revenue Trend Calculations Are Hardcoded

| Field | Value |
|-------|-------|
| **Gap Title** | Revenue page shows fake trend percentages (+8.4%, +12.1%) |
| **Severity** | Medium |
| **Business Justification** | Trend data is used for decision-making. Hardcoded trends are misleading and will undermine owner confidence when they realize the numbers are false. |
| **Current State** | `Revenue.tsx` lines ~68 and ~79 show hardcoded `+8.4%` and `+12.1%` trend strings. |
| **Desired State** | Calculate real trend by comparing current period vs previous period using Stripe revenue data. |
| **Operational Impact** | Misleading metrics. Decision-making based on false data. |
| **Implementation Complexity** | S (< 1 day) — fetch two periods from Stripe revenue endpoint and calculate percentage |
| **Recommended Priority** | Sprint A |

---

## Gap 16: GPS Tracking Not Implemented

| Field | Value |
|-------|-------|
| **Gap Title** | Employee location tracking shows null GPS for all technicians |
| **Severity** | Medium |
| **Business Justification** | Real-time location tracking enables ETAs and confirms technicians are on route. |
| **Current State** | `adminTracking.ts` explicitly states location is null. Employee portal does not report location. Map on tracking page has no data. |
| **Desired State** | Employee mobile app/PWA that reports location while on shift. GPS stored in `time_events.geo` or periodic location update. |
| **Operational Impact** | Tracking page is visually present but non-functional. Cannot confirm technician location. |
| **Implementation Complexity** | L (3-7 days) — geolocation permission request in employee PWA + periodic location reporting API |
| **Recommended Priority** | Sprint B |

---

## Gap 17: No Shift/Time Tracking

| Field | Value |
|-------|-------|
| **Gap Title** | Shift clock-in/clock-out not implemented despite schema existing |
| **Severity** | Medium |
| **Business Justification** | Accurate hours tracking for employee pay, compliance, and productivity analysis. |
| **Current State** | `shifts` and `time_events` tables created in migrations. No employee portal UI for clock in/out. No admin page for shift data. |
| **Desired State** | Employee portal clock-in/out button that writes to `shifts`. Admin view of daily/weekly hours per employee. |
| **Operational Impact** | No hours-worked data. Cannot calculate labor cost per job. |
| **Implementation Complexity** | M (1-3 days) — clock-in/out UI in employee portal + admin shift view |
| **Recommended Priority** | Sprint B |

---

## Gap 18: Chemicals/Checklist/Signatures Not Visible to Admin

| Field | Value |
|-------|-------|
| **Gap Title** | Job artifact tables (chemicals_logs, job_checklists, signatures) have no admin UI |
| **Severity** | Medium |
| **Business Justification** | Chemical application records are regulatory requirements (EPA). Checklists verify job completion. Signatures provide legal protection. |
| **Current State** | Tables exist with correct schema. No data is written (no employee UI). No admin query. |
| **Desired State** | Employee portal allows filling checklist, logging chemicals, capturing signature. Admin can view per-job artifacts in Visit detail. |
| **Operational Impact** | Regulatory compliance gap. No proof of service for disputed jobs. |
| **Implementation Complexity** | L (3-7 days) — employee portal artifact UI + admin visit detail with artifact display |
| **Recommended Priority** | Sprint B |

---

## Gap 19: No Customer Profile Edit from Admin

| Field | Value |
|-------|-------|
| **Gap Title** | Admin cannot update customer name, phone, or email |
| **Severity** | Medium |
| **Business Justification** | Customers call to update their information. Admin needs to make that change. |
| **Current State** | Customer detail sheet shows current profile. No edit button. |
| **Desired State** | "Edit Profile" button in customer detail sheet that allows updating name/phone. Email change requires Supabase Auth admin API. |
| **Operational Impact** | Customer support call requiring profile update sends admin to Supabase dashboard. |
| **Implementation Complexity** | S (< 1 day) — edit form in CustomerDetailsSheet + PATCH /api/admin/customers/:id |
| **Recommended Priority** | Sprint B |

---

## Gap 20: No MRR/ARR Calculation

| Field | Value |
|-------|-------|
| **Gap Title** | No Monthly Recurring Revenue or Annual Recurring Revenue metric visible |
| **Severity** | Medium |
| **Business Justification** | MRR is the single most important metric for a subscription business. Owner needs to see it on the Overview page. |
| **Current State** | MTD revenue (payments this month) shown. No MRR. |
| **Desired State** | MRR = sum(active subscription monthly amounts). ARR = MRR × 12. Shown on Overview and Revenue pages. |
| **Operational Impact** | Owner cannot evaluate business health or project revenue without MRR. |
| **Implementation Complexity** | S (< 1 day) — query active subscriptions × amount_cents, aggregate by month |
| **Recommended Priority** | Sprint A |

---

## Gap 21: No Ticket Search or Filter

| Field | Value |
|-------|-------|
| **Gap Title** | Tickets page has no search or filter capability |
| **Severity** | Low |
| **Business Justification** | As ticket volume grows, admin needs to search by customer, subject, or date. |
| **Current State** | Full ticket list shown in Kanban. No search input. No filter. |
| **Desired State** | Search input filtering tickets by customer name or subject. Date range filter. |
| **Operational Impact** | Minor until ticket volume exceeds 50. |
| **Implementation Complexity** | S (< 1 day) — add search input + client-side filter |
| **Recommended Priority** | Sprint B |

---

## Gap 22: Employee Cannot See Future Assignments

| Field | Value |
|-------|-------|
| **Gap Title** | Employee portal only shows today's assignments, not upcoming week |
| **Severity** | Low |
| **Business Justification** | Employees need to plan their week. Seeing tomorrow's jobs allows advance preparation. |
| **Current State** | `GET /api/employee/assignments` defaults to today. Date query param exists but employee portal only offers "today." |
| **Desired State** | Date picker in employee portal + "Upcoming" tab showing next 7 days of assignments. |
| **Operational Impact** | Employees learn of assignments only on the day. Cannot prepare in advance. |
| **Implementation Complexity** | S (< 1 day) — add date navigation in employee portal |
| **Recommended Priority** | Sprint B |

---

## Priority Summary

### Sprint A (Launch-Critical Fixes, < 1 week total)

| # | Gap | Complexity |
|---|-----|------------|
| 1 | Job completion does not cascade to appointments.status | S |
| 2 | Cancellation does not cascade to assignments | S |
| 3 | No subscriptions management page | M |
| 4 | No lead capture at quote widget | M |
| 5 | Job media not visible to admin | M |
| 6 | Contact inquiries not visible to admin | S |
| 7 | Customer activity tab is a placeholder | M |
| 9 | No recurring appointment auto-generation | M |
| 15 | Revenue trend calculations are hardcoded | S |
| 20 | No MRR/ARR calculation | S |

### Sprint B (Important, Post-Launch)

| # | Gap | Complexity |
|---|-----|------------|
| 8 | No appointment calendar view | L |
| 10 | No ticket reply capability | M |
| 11 | Business hours window editing | M |
| 12 | Technician productivity metrics | M |
| 13 | No admin alert for new bookings | S |
| 14 | No subscription cancel/pause from admin | M |
| 16 | GPS tracking | L |
| 17 | Shift/time tracking | M |
| 18 | Chemicals/checklist/signatures | L |
| 19 | No customer profile edit from admin | S |
| 21 | No ticket search/filter | S |
| 22 | Employee future assignments view | S |
