# BUSINESS OPERATIONS COMPLETENESS REPORT
## Generated: 2026-05-29
## Scope: Can the owner effectively manage all operational domains?

---

## Rating Scale
- ✓ COVERED — Fully functional, meets operational needs
- ⚠ PARTIAL — Some capability exists but meaningful gaps remain
- ✗ MISSING — No meaningful capability

---

## Domain 1: Customers

**Rating: ⚠ PARTIAL**

**What is covered:**
- View all customers in `/admin/customers` with name, email, phone, join date, property count
- Search by name/email/phone
- Filter by status (active/paused/canceled)
- Invite new customers via email
- View customer's properties from detail sheet
- Export customers CSV

**What is missing:**
- No customer-specific view that shows all their appointments, payments, tickets in one place
- Activity tab in customer detail is a placeholder (links to other pages but doesn't filter)
- Finance tab in customer detail is a placeholder (same issue)
- Cannot edit customer profile (name, phone) from admin
- Cannot see customer's last login date
- No status for "lead" vs "customer" — accounts without subscriptions show as "active"
- Cannot delete or merge customer accounts
- No customer notes field for admin observations

**Business Impact:** Admin cannot get a full picture of any single customer in one view. Opening a customer record and seeing their history requires navigating to 3-4 different pages and manually filtering.

---

## Domain 2: Employees

**Rating: ⚠ PARTIAL**

**What is covered:**
- View all employees with role, phone, vehicle, nav preference, status
- Invite new employees via email
- Edit employee details (role, phone, vehicle, status)
- Activate/deactivate employees

**What is missing:**
- No productivity metrics (jobs completed today/this week/this month)
- No assignment history per employee
- No completion rate (assignments completed vs skipped/no-show)
- No media submission rate (did they upload photos?)
- No shift hours (shift tracking not implemented)
- No GPS history
- Cannot view an employee's assignment calendar

**Business Impact:** Admin knows who employees are but cannot evaluate their performance, workload, or activity.

---

## Domain 3: Scheduling

**Rating: ⚠ PARTIAL**

**What is covered:**
- View all appointments in list form with filters (date range, customer, technician, plan type, area)
- Modify appointment (date, time, technician)
- Create appointments from the Overview alert panel
- Blackout dates management
- Business hours configuration

**What is missing:**
- No calendar view — only table list
- No daily/weekly schedule overview
- Cannot create appointment for a specific customer directly from the Appointments page (only from Overview alert)
- No recurring appointment template view
- No capacity indicator (how many slots are filled vs available on a given day)

**Business Impact:** The owner cannot visualize the schedule as a calendar. Planning for a busy week requires mentally processing a table of dates. No calendar = higher cognitive load for day-to-day scheduling.

---

## Domain 4: Dispatch

**Rating: ⚠ PARTIAL**

**What is covered:**
- Bulk assign technicians to selected appointments in `/admin/appointments`
- Dispatch (en_route) individual appointments with SMS notification to customer
- View current employee status in Employee Tracking page

**What is missing:**
- No "today's dispatch board" — no single view showing all today's appointments with assigned technician and status
- Employee Tracking shows no GPS location (always null)
- No "re-dispatch" or status override from Employee Tracking
- No way to see which technician is available/busy right now vs tomorrow

**Business Impact:** Dispatcher must cross-reference appointment list and employee tracking manually. No true dispatch console.

---

## Domain 5: Billing

**Rating: ⚠ PARTIAL**

**What is covered:**
- View all payments (amount, customer, status, date)
- Filter/search payments
- View marketplace orders with fulfillment management
- Unified billing timeline
- Stripe Dashboard link

**What is missing:**
- Cannot cancel subscription from admin panel
- Cannot process refund from admin panel (must use Stripe Dashboard)
- Cannot retry a failed payment
- No invoice management (local `invoices` table not surfaced)
- No subscription billing history per customer
- No billing alerts for upcoming renewals
- No dunning management UI (Stripe handles dunning but admin can't see/configure it)

**Business Impact:** For anything beyond reading payment history, admin must leave the app and go to Stripe. Two-platform billing management.

---

## Domain 6: Subscriptions

**Rating: ✗ MISSING**

**What is covered:**
- Export subscriptions CSV from `/admin/reports`
- Customer status badge (active/paused/canceled) inferred from subscription status in customer list

**What is missing:**
- No dedicated subscriptions admin page
- Cannot see all active subscriptions with renewal dates
- Cannot cancel, pause, or modify subscriptions from admin
- Cannot see which plan/cadence each subscription is on
- Cannot see `cancel_at_period_end` status
- Cannot see when the next charge will occur
- No MRR calculation
- No churn tracking

**Business Impact:** The owner cannot manage subscriptions. They cannot answer "how many active subscribers do I have on the 21-day plan?" without going to Stripe. Critical operational capability is missing.

---

## Domain 7: Marketplace

**Rating: ⚠ PARTIAL**

**What is covered:**
- View all marketplace orders in `/admin/billing`
- View order line items
- Update fulfillment status (pending/processing/scheduled/fulfilled/cancelled)
- Search orders

**What is missing:**
- No marketplace orders export
- Cannot process refund from admin
- No inventory tracking for physical products (if any)
- No product catalog management in admin (Pricing page manages service plans, not marketplace items)
- Link from order to appointment is shown in reschedule dialog (read-only)

**Business Impact:** Functional for basic fulfillment tracking. Refunds require Stripe. Product management is missing.

---

## Domain 8: Leads

**Rating: ✗ MISSING**

**What is covered:**
- The `schedule_requests` legacy table exists but receives no data
- Contact form writes to `contact_inquiries` table

**What is missing:**
- No lead capture on quote widget
- No admin page for leads or contact inquiries
- No conversion tracking
- No UTM tracking
- No lead source reporting

**Business Impact:** Every visitor who gets a quote and doesn't immediately convert is lost forever. No retargeting, no follow-up. See `LEAD_GENERATION_AUDIT.md` for full analysis.

---

## Domain 9: Marketing

**Rating: ⚠ PARTIAL**

**What is covered:**
- Promo codes: create, activate/deactivate, delete (percent or fixed discount)
- Marketing campaigns: create, link to promo code
- Content management (CMS) via `/admin/content` and `/admin/website-manager`

**What is missing:**
- No proof that promo codes are validated at checkout (needs tracing through billing flow)
- No campaign performance metrics (how many times was a code used?)
- No customer segmentation for targeted offers
- No email campaign integration
- Campaigns have no performance tracking beyond code usage count

**Business Impact:** Basic promo functionality exists. No marketing analytics or segmentation.

---

## Domain 10: Support

**Rating: ⚠ PARTIAL**

**What is covered:**
- Support tickets visible in Kanban board
- Ticket status updates (move between open/in_progress/resolved)
- Recent tickets shown on Overview dashboard

**What is missing:**
- Cannot reply to customer from ticket view
- Cannot assign tickets to staff
- No ticket search or filter
- No SLA tracking
- No escalation workflow
- Contact inquiries (from marketing site) have zero admin visibility
- Messages page may be broken (message_threads data dependency unclear)

**Business Impact:** Admin knows tickets exist but support workflow is minimal. Cannot close the loop with customers via ticketing system.

---

## Domain 11: Service Areas

**Rating: ✓ COVERED**

**What is covered:**
- Add ZIP codes to service area
- Toggle active/inactive per ZIP
- Capacity field per area
- Changes affect booking availability

**What is missing:**
- No polygon-based geographic visualization
- Cannot set capacity per time window (capacity is a flat number)

**Business Impact:** Functionally covered for ZIP-based service area management.

---

## Domain 12: Capacity Planning

**Rating: ✗ MISSING**

**What is covered:**
- `business_hours` defines max_jobs_per_tech per window
- Scheduling system checks capacity before allowing bookings

**What is missing:**
- No admin view showing "Morning window: 3/6 slots filled" for any given day
- No capacity heatmap or calendar
- No alert when capacity is nearly full
- No ability to temporarily increase/decrease capacity without editing business hours
- Cannot see technician load distribution across days

**Business Impact:** Admin cannot proactively manage capacity. They will only discover capacity issues when customers can't book, or when they see a pile of appointments on one day.

---

## Domain 13: Revenue Metrics

**Rating: ⚠ PARTIAL**

**What is covered:**
- MTD revenue on Overview dashboard (real Stripe data)
- 30-day revenue chart in `/admin/revenue`
- Recent Stripe invoices list
- Last 7 days / Last 30 days totals

**What is missing:**
- Hardcoded trend percentages (+8.4%, +12.1%) — not real calculations
- No MRR (Monthly Recurring Revenue) calculation
- No ARR (Annual Recurring Revenue)
- No revenue by plan type (how much from 14-day vs 21-day vs annual)
- No revenue by service area / ZIP
- No average revenue per customer
- No customer lifetime value

**Business Impact:** Owner knows revenue totals but lacks the metrics needed to make strategic decisions (which plan is most profitable, which area drives most revenue).

---

## Domain 14: Retention Metrics

**Rating: ✗ MISSING**

**What is covered:**
- Customer status (active/paused/canceled) visible in customer list

**What is missing:**
- No churn rate calculation
- No at-risk customer identification (long gap since last appointment, payment failures)
- No renewal tracking (when do subscriptions renew?)
- No cohort retention analysis
- No reactivation tracking (customers who canceled and came back)
- No "customers without upcoming appointment" alert beyond the scheduling queue

**Business Impact:** Owner cannot measure retention, predict churn, or identify customers to proactively contact. A customer could quietly cancel and the owner wouldn't notice until running an export.

---

## Domain 15: Technician Productivity

**Rating: ✗ MISSING**

**What is covered:**
- Assignment status (en_route/in_progress) visible in Employee Tracking

**What is missing:**
- No jobs per day / week / month per technician
- No completion rate (completed vs no_show vs skipped)
- No average job duration
- No media submission rate
- No shift hours worked
- No chemical usage per technician
- No customer satisfaction per technician

**Business Impact:** No way to evaluate technician performance. All technicians appear equally active/inactive in the system. Cannot identify the best or worst performing employee.

---

## Domain 16: Appointment Utilization

**Rating: ✗ MISSING**

**What is covered:**
- Total appointment count visible per date range

**What is missing:**
- No slots-filled vs slots-available metric
- No booking rate (what % of available capacity is booked)
- No peak/trough visibility
- No forecast based on subscription cadences
- No "X appointments scheduled for next week" widget

**Business Impact:** Owner cannot tell if the business is at 40% capacity or 90% capacity without manually counting appointments.

---

## Summary Scorecard

| Domain | Rating | Priority for Improvement |
|--------|--------|--------------------------|
| Customers | ⚠ PARTIAL | High |
| Employees | ⚠ PARTIAL | Medium |
| Scheduling | ⚠ PARTIAL | High |
| Dispatch | ⚠ PARTIAL | Medium |
| Billing | ⚠ PARTIAL | High |
| Subscriptions | ✗ MISSING | Critical |
| Marketplace | ⚠ PARTIAL | Low |
| Leads | ✗ MISSING | Critical |
| Marketing | ⚠ PARTIAL | Low |
| Support | ⚠ PARTIAL | High |
| Service Areas | ✓ COVERED | — |
| Capacity Planning | ✗ MISSING | High |
| Revenue Metrics | ⚠ PARTIAL | High |
| Retention Metrics | ✗ MISSING | High |
| Technician Productivity | ✗ MISSING | Medium |
| Appointment Utilization | ✗ MISSING | Medium |

**Fully Covered: 1/16 (6%)**
**Partially Covered: 9/16 (56%)**
**Missing: 6/16 (38%)**
