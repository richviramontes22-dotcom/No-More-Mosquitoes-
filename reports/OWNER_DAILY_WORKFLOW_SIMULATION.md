# OWNER DAILY WORKFLOW SIMULATION
## Generated: 2026-05-29
## Scope: Can the owner operate No More Mosquitoes for a full business day using only the current admin dashboard?

**Methodology:** Each task is evaluated against the actual admin pages in `client/pages/admin/` and confirmed server routes. Not assumed functional — traced to specific components.

**Gap Classifications:**
- **CRITICAL BLIND SPOT** — owner cannot run the business without this
- **HIGH PRIORITY** — significant friction, painful workaround
- **MEDIUM PRIORITY** — somewhat important, manual workaround available
- **NICE TO HAVE** — useful but not blocking

---

## Morning (Day Start)

| Task | Possible? | How? | Gap Classification |
|------|-----------|------|--------------------|
| See today's scheduled appointments | YES (partial) | `Overview.tsx` shows "Appointments Today" KPI count and "Upcoming Appointments" table filtered by `status='scheduled'` and `gte: now`. Can also filter by today's date in `/admin/appointments` table view. Note: the Overview panel labeled "Next 24h" not just "today." | Gap: No dedicated "Today's Schedule" view — owner must cross-reference date filter manually in appointments table |
| See unassigned appointments (no technician yet) | YES (partial) | `/admin/appointments` has a "Scheduling Queue" sub-panel on the page that shows active subscriptions with no upcoming appointment. Individual appointment rows in the table show assigned technician name if one exists. Unassigned = no technician name in row. No dedicated "unassigned" filter chip. | HIGH PRIORITY: Must scan the full appointment list to find unassigned ones; no quick filter |
| See which technicians are working today | NO | `/admin/employee-tracking` shows employee status (idle/en_route/in_progress) in real time. But this shows who is currently active, not who is scheduled to work today. No shift schedule or daily roster view. | CRITICAL BLIND SPOT: No way to know which technicians are available/scheduled for today without calling them |
| Know total appointment capacity for today | NO | Business hours define `max_jobs_per_tech` per window, and employee count is known, but no page calculates or displays "X of Y slots filled today." | CRITICAL BLIND SPOT: Cannot determine if day is over-scheduled or has slack capacity |
| See new leads from yesterday | NO | No lead capture exists. The quote widget stores no visitor data. No leads page or table. | CRITICAL BLIND SPOT: No lead pipeline visibility at all |
| See new quote lookups | NO | No visibility into quote widget activity. Parcel lookup cache exists but is not surfaced in admin. | CRITICAL BLIND SPOT: Completely invisible marketing funnel |
| See any new cancellations | YES (partial) | `/admin/appointments` table shows canceled appointments with status badge. Owner can sort by `updated_at` or filter status to see recent cancellations. But no notification or alert is sent when a cancellation happens. | HIGH PRIORITY: Must actively scan the appointments list; no proactive alert |
| See failed payments from last 24h | YES (partial) | Admin Overview shows "Past-due subscriptions" KPI count. Clicking "Go to Billing" opens `/admin/billing`. The past-due alert panel shows customer names. Full detail requires navigating to `/admin/billing` and scanning the payment timeline. No "last 24h failed payments" filter. | HIGH PRIORITY: Alert exists but no timestamp-filtered view of recent failures |
| See open support tickets | YES | Admin Overview shows "Open Tickets" KPI count and "Recent Support Tickets" table with last 5 open tickets. Full list in `/admin/tickets` Kanban. | Functional — minor gap: no ticket notification, no customer contact info on overview row |
| See overdue recurring appointments | YES (partial) | Admin Overview "Needs Scheduling" alert panel shows active subscriptions with no upcoming appointment. This is the closest proxy for "overdue" recurring appointments. But it doesn't show HOW overdue they are (last appointment date). | HIGH PRIORITY: Shows who needs scheduling, not how long it's been overdue |

**Morning Assessment:** Owner can get a rough operational overview but lacks precise tools. The absence of a daily capacity view, lead visibility, and technician roster makes the morning stand-up blind on 3 of 10 dimensions.

---

## Midday Operations

| Task | Possible? | How? | Gap Classification |
|------|-----------|------|--------------------|
| Assign technician to unassigned appointment | YES | `/admin/appointments` table: check the appointment row checkbox → "Assign Technician" bulk action → select from active employees dropdown → "Apply." Sends notification email to employee. | Functional |
| Reassign technician to different appointment | YES | `/admin/appointments` "Modify" dialog (pencil icon on appointment row) → change "Technician" field. Uses the same `POST /api/admin/assignments` upsert which will overwrite the existing assignment. | Functional |
| See which jobs are in-progress right now | YES (partial) | `/admin/employee-tracking` shows employees with status `en_route` or `in_progress` and their current assignment count. Auto-refreshes every 5 seconds. GPS coordinates are always null — no map visualization. | MEDIUM PRIORITY: Status is real, location is not |
| See which jobs are stuck/overdue | NO | No "time-in-progress" tracking. No alert when a job runs beyond expected duration. `assignments.started_at` exists if set, but no admin UI shows elapsed time or flags overdue jobs. | HIGH PRIORITY: Cannot tell if a job that started 4 hours ago is still running |
| Contact a customer | YES (partial) | `/admin/customers` → search for customer → "View Details" sheet shows email and phone. No click-to-call or in-app email compose. Owner must manually call or open their email client. | MEDIUM PRIORITY: Contact info is accessible but no in-app communication |
| View media uploaded by technician | NO | Job media is uploaded to `job_media` table and `job-media` Supabase storage bucket by employees. No admin page queries `job_media`. `/admin/visits` shows completed appointments without media. | CRITICAL BLIND SPOT: Zero quality control visibility |
| Cancel an appointment on customer's behalf | YES | `/admin/appointments` → find appointment → "Cancel" action → confirmation dialog → `PATCH /api/admin/appointments/:id/cancel` fires. Sends cancellation email to customer. | Functional. Gap: does not cascade to assignments (technician not notified) |
| Reschedule an appointment | YES | `/admin/appointments` → "Modify" dialog → change date, time, window. Updates appointment via Supabase direct write. | Functional |
| Handle a failed payment (retry/notify) | NO (partial) | Admin can SEE past-due subscriptions on Overview and in `/admin/billing`. Cannot trigger payment retry from admin (no route). Customer must update card via Stripe Portal, but the `requireActiveSubscription` guard may block `past_due` customers from accessing the portal. No admin-initiated retry. | CRITICAL BLIND SPOT: Cannot remediate payment failures in-app |
| Respond to a contact inquiry | NO | `contact_inquiries` table exists with RLS policy allowing admin reads, but no admin page queries it. Contact form submissions are invisible in the admin dashboard. | HIGH PRIORITY: Lost revenue opportunity |

**Midday Assessment:** Core scheduling operations (assign, reassign, reschedule, cancel) work. Quality control, payment remediation, and contact inquiry response are completely unavailable.

---

## End of Day

| Task | Possible? | How? | Gap Classification |
|------|-----------|------|--------------------|
| See all completed jobs today | NO | `/admin/visits` shows completed appointments (status='completed'). BUT: employee job completion (`POST /api/employee/assignments/:id/status`) does NOT cascade to `appointments.status`. Appointments remain `scheduled` after technician marks them done. `/admin/visits` would show zero completed visits even on a full work day. | CRITICAL BLIND SPOT: Core operational data is permanently broken |
| See any incomplete/missed jobs | NO | Same root cause as above. `assignments.status` may be `completed` but `appointments.status` stays `scheduled`. No "missed job" detection. | CRITICAL BLIND SPOT |
| See which technicians completed how many jobs | NO | `assignments` table has `status=completed` and `completed_at` but no admin page aggregates this. `/admin/employees` shows the roster, not productivity data. | CRITICAL BLIND SPOT: Cannot evaluate technician performance |
| Verify media was uploaded for completed jobs | NO | No admin page queries `job_media`. Even if job media exists in the storage bucket, it is not surfaced anywhere. | CRITICAL BLIND SPOT: Quality verification impossible |
| See any notification failures | YES | `/admin/notifications` shows last 200 notification log entries filterable by status (sent/failed/pending/skipped). Failed entries show error message. | Functional |
| See unresolved support tickets | YES | `/admin/tickets` Kanban shows all tickets in `open` and `in_progress` columns. Can see all unresolved tickets. No search or filter by date. | Functional (minor gap: no search) |
| See tomorrow's full schedule | YES (partial) | `/admin/appointments` → filter by tomorrow's date → see all scheduled appointments for that day. No calendar view, but the filtered table is functional. Does not show capacity fill rate for tomorrow. | MEDIUM PRIORITY: Table works but no visual capacity overview |

**End of Day Assessment:** The most critical end-of-day task — seeing what was completed today — is completely broken due to the appointments.status cascade bug. This is not a UI gap; it is a data integrity failure that makes the entire `/admin/visits` page useless.

---

## End of Month

| Task | Possible? | How? | Gap Classification |
|------|-----------|------|--------------------|
| See total revenue this month | YES | Admin Overview "MTD Revenue" KPI shows sum of `payments.amount_cents` from the 1st of the month. Also visible on `/admin/revenue` as a 30-day chart from Stripe API. | Functional |
| See MRR (monthly recurring revenue) | NO | No MRR calculation anywhere. `/admin/revenue` shows MTD revenue (actual collected this month). MRR = sum of active subscription amounts — not calculated. Revenue trend percentages on the Revenue page were previously hardcoded (`+8.4%`, `+12.1%`); according to prior audit Gap 15, these are hardcoded values. | CRITICAL BLIND SPOT: Core subscription business metric missing |
| See ARR (annual recurring revenue) | NO | Not calculated anywhere. | CRITICAL BLIND SPOT |
| See new subscriber count | YES (partial) | Admin Overview "Newest Customers" table shows last 5 profiles by `created_at`. Can filter in `/admin/customers` by recent join dates. No "new subscribers this month" metric that filters by subscription creation date (not profile creation). | MEDIUM PRIORITY: Account count proxy exists, true subscriber count requires manual filtering |
| See churn (canceled subscriptions) | NO | No churn metric or visualization. Canceled subscriptions show `status='canceled'` in the `subscriptions` table, accessible via CSV export from `/admin/reports`. No churn rate calculation, no month-over-month trend. | CRITICAL BLIND SPOT: Cannot measure retention |
| See annual plan renewal dates upcoming | NO | `current_period_end` exists on annual subscriptions in the `subscriptions` table. No admin page shows a list of annual subscriptions sorted by renewal date. No 30/60/90-day renewal alert. | HIGH PRIORITY: Revenue at risk from missed renewals |
| See technician productivity metrics | NO | `assignments` table has lifecycle timestamps but no admin page aggregates them. No jobs-per-day, average duration, or completion rate. | HIGH PRIORITY: Cannot make staffing decisions |
| See appointment utilization rate | NO | Business hours define capacity. No page shows slots filled vs available. Cannot calculate utilization percentage. | CRITICAL BLIND SPOT: Cannot optimize scheduling capacity |
| See lead-to-customer conversion rate | NO | No lead capture data exists. Cannot calculate conversion. | CRITICAL BLIND SPOT: Marketing ROI is unmeasurable |
| See marketplace revenue | YES (partial) | `/admin/billing` shows marketplace orders in the unified timeline. Individual order totals are visible. No aggregate marketplace revenue metric or month-over-month trend. | MEDIUM PRIORITY: Data exists, aggregation missing |
| Export customer/revenue data for accounting | YES (partial) | `/admin/reports` has 5 CSV exports: customers, properties, appointments, tickets, subscriptions. No payments export. No date-range filter on exports. Revenue export requires using the Stripe Dashboard. | MEDIUM PRIORITY: Partial export exists but incomplete for accounting purposes |

**End of Month Assessment:** Revenue data is accessible through MTD and Stripe. Every subscription business metric (MRR, ARR, churn, utilization, conversion) is absent. The owner cannot answer "Is the business growing?" using only the admin dashboard.

---

## Overall Simulation Score

| Time Period | Tasks Possible | Tasks Partial | Tasks Impossible | Score |
|-------------|---------------|---------------|------------------|-------|
| Morning (10 tasks) | 3 | 4 | 3 | 50% |
| Midday (10 tasks) | 5 | 2 | 3 | 65% |
| End of Day (7 tasks) | 2 | 1 | 4 | 32% |
| End of Month (11 tasks) | 2 | 4 | 5 | 37% |
| **Overall (38 tasks)** | **12** | **11** | **15** | **46%** |

---

## Critical Operational Blind Spots (Ranked by Business Impact)

1. **Job completion status is broken** — Admin visits page shows zero completed jobs. Owner has no end-of-day confirmation that service was delivered. (End of Day — CRITICAL)

2. **No lead visibility** — Every visitor who requests a quote and leaves is invisible. No follow-up possible. Marketing is operating blind. (Morning — CRITICAL)

3. **No MRR/ARR/Churn metrics** — Owner cannot evaluate business health or growth trajectory. (End of Month — CRITICAL)

4. **No appointment utilization rate** — Cannot tell if capacity is 10% or 95% filled. Scheduling decisions are guesses. (End of Month — CRITICAL)

5. **Technician roster for today unknown** — No shift schedule. Owner doesn't know who is available before assignments are made. (Morning — CRITICAL)

6. **Payment failure remediation is blocked** — Past-due customers may be locked out of Stripe Portal. Admin cannot retry payments. Revenue recovery requires Stripe Dashboard access. (Midday — CRITICAL)

7. **Job media not visible to admin** — Quality control relies on calling the technician. No photographic evidence of service delivery accessible from admin. (Midday — CRITICAL)

8. **Contact inquiries invisible** — Customers who fill out the contact form never receive a response unless admin manually queries the database. (Midday — HIGH)

9. **No tomorrow's capacity view** — Tomorrow's appointment table is accessible but there is no fill rate indicator or over-capacity warning. (End of Day — MEDIUM)

10. **Annual renewal dates not surfaced** — Subscriptions approaching their 1-year expiry are invisible until after they expire. (End of Month — HIGH)
