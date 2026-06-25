# DATABASE VISIBILITY AUDIT
## Generated: 2026-05-29
## Scope: Every table in the database schema, admin visibility assessment

---

## Table Index (from migrations)

Tables identified from `db/migrations/`:
1. `profiles` — initial_schema
2. `properties` — initial_schema + admin_features_support
3. `appointments` — initial_schema + multiple extensions
4. `schedule_requests` — initial_schema
5. `plans` / `service_plans` — admin_features_support
6. `pricing_rules` — admin_features_support
7. `service_areas` — admin_features_support + missing_tables
8. `payments` — admin_features_support
9. `subscriptions` — admin_features_support + annual_plan_tracking
10. `invoices` — missing_tables
11. `employees` — employee_portal + missing_tables
12. `shifts` — employee_portal + missing_tables
13. `time_events` — employee_portal + missing_tables
14. `routes` — employee_portal
15. `route_stops` — employee_portal
16. `assignments` — employee_portal + phase3a
17. `job_media` — employee_portal + job_media_storage
18. `job_checklists` — employee_portal + missing_tables
19. `chemicals_logs` — employee_portal + missing_tables
20. `signatures` — employee_portal + missing_tables
21. `message_threads` — employee_portal (extended)
22. `messages` — employee_portal (extended)
23. `tickets` — tickets_table
24. `contact_inquiries` — contact_inquiries + missing_tables
25. `notification_log` — phase2_notification_infrastructure
26. `business_hours` — phase1_reliable_availability
27. `blackout_dates` — phase1_reliable_availability
28. `parcel_lookup_cache` — parcel_lookup_cache
29. `parcel_lookup_attempts` — parcel_lookup_cache

---

## 1. `profiles`

| Field | Value |
|-------|-------|
| **Purpose** | Core user identity — name, email, phone, role (admin/customer/employee), card_last4, card_brand, card_expiry |
| **Row Count Estimate** | Grows with every account (customer + employee + admin) |
| **Admin Visible** | Fully |
| **Admin Page** | `/admin/customers` (list + detail), `/admin/employees` (joined) |
| **Should Admin See This** | Yes |
| **Missing UI** | No — admin can see name, email, phone, created_at, subscription status. Missing: card fields (last4/brand/expiry), last_login, role change |
| **Gap Description** | Admin cannot see or edit card details stored in `profiles.card_last4`. Admin cannot change a customer's role. No ability to edit profile from admin panel. |

---

## 2. `properties`

| Field | Value |
|-------|-------|
| **Purpose** | Customer service addresses with acreage, plan, cadence, program |
| **Row Count Estimate** | Grows with customer onboarding |
| **Admin Visible** | Fully |
| **Admin Page** | `/admin/properties` (full list), `/admin/customers` → Properties tab |
| **Should Admin See This** | Yes |
| **Missing UI** | Yes — plan, cadence, program, gate_code columns are not displayed in any admin UI |
| **Gap Description** | Admin cannot see a property's service plan or cadence from the Properties page. gate_code is a significant field for operations but not shown. |

---

## 3. `appointments`

| Field | Value |
|-------|-------|
| **Purpose** | Service appointments — status, scheduled_at, window, service_type, notes |
| **Row Count Estimate** | High growth — multiple appointments per customer per year |
| **Admin Visible** | Fully |
| **Admin Page** | `/admin/appointments` (full CRUD), `/admin/visits` (completed only) |
| **Should Admin See This** | Yes |
| **Missing UI** | Partial — `service_area_id` column not displayed. No history of status changes shown. |
| **Gap Description** | Status change history not tracked. No audit log of admin modifications. `technician_id` column exists but assignments are tracked separately in `assignments` table — dual reference. |

---

## 4. `schedule_requests`

| Field | Value |
|-------|-------|
| **Purpose** | Guest/lead schedule requests submitted before account creation |
| **Row Count Estimate** | Moderate — created via public schedule form |
| **Admin Visible** | No |
| **Admin Page** | Nowhere |
| **Should Admin See This** | Yes — these are leads |
| **Missing UI** | Yes — complete gap |
| **Gap Description** | `schedule_requests` table captures full_name, email, phone, address, zip, frequency, preferred_date from the public schedule form. Admin has zero visibility into this table. These are warm leads who have expressed interest. |

---

## 5. `plans` / `service_plans`

| Field | Value |
|-------|-------|
| **Purpose** | Service plan definitions — price, cadence, acreage ranges, Stripe price IDs |
| **Row Count Estimate** | Static — small number of plan configurations |
| **Admin Visible** | Fully |
| **Admin Page** | `/admin/pricing` |
| **Should Admin See This** | Yes |
| **Missing UI** | Partial — can view and edit price_cents but cannot create/delete plans or sync changes to Stripe |
| **Gap Description** | Price changes in the UI do not create new Stripe prices. This means if admin changes price_cents from 9500 to 10000, Stripe still charges the old price. |

---

## 6. `pricing_rules`

| Field | Value |
|-------|-------|
| **Purpose** | Multipliers by acreage range or ZIP code per plan |
| **Row Count Estimate** | Small — config table |
| **Admin Visible** | No |
| **Admin Page** | Nowhere |
| **Should Admin See This** | Yes |
| **Missing UI** | Yes — complete gap |
| **Gap Description** | Admin cannot see or manage pricing rules. If there are location-based or acreage overrides, they are invisible. |

---

## 7. `service_areas`

| Field | Value |
|-------|-------|
| **Purpose** | Serviceable ZIP codes with capacity and active status |
| **Row Count Estimate** | Small — config table |
| **Admin Visible** | Fully |
| **Admin Page** | `/admin/service-areas` |
| **Should Admin See This** | Yes |
| **Missing UI** | No — add/toggle/remove all available |
| **Gap Description** | None significant. Capacity per area is stored but not used in capacity planning calculations visible to admin. |

---

## 8. `payments`

| Field | Value |
|-------|-------|
| **Purpose** | Stripe payment records — amount, status, user_id, stripe_payment_intent_id |
| **Row Count Estimate** | High growth — one row per payment |
| **Admin Visible** | Fully |
| **Admin Page** | `/admin/billing` |
| **Should Admin See This** | Yes |
| **Missing UI** | Partial — no refund action, no Stripe charge link, no invoice link |
| **Gap Description** | Admin can see payments but cannot initiate refund, retry failed payment, or navigate to the Stripe charge. |

---

## 9. `subscriptions`

| Field | Value |
|-------|-------|
| **Purpose** | Subscription records linking users to Stripe — status, cadence_days, current_period_end, program |
| **Row Count Estimate** | One-to-many per customer |
| **Admin Visible** | Partially |
| **Admin Page** | Customer status badge in `/admin/customers`. Export in `/admin/reports`. No dedicated subscription management page. |
| **Should Admin See This** | Yes — needs a full subscriptions page |
| **Missing UI** | Yes — no subscriptions management page showing renewal dates, cancel_at_period_end, last_payment_at per subscription |
| **Gap Description** | No admin subscriptions list. Owner cannot see MRR, upcoming renewals, or at-risk subscriptions. Cannot cancel/pause subscription from admin panel. |

---

## 10. `invoices`

| Field | Value |
|-------|-------|
| **Purpose** | Invoice records (Stripe invoice mirror) |
| **Row Count Estimate** | One per billing cycle |
| **Admin Visible** | Partially — Stripe invoices visible via `/admin/revenue` (directly from Stripe API, not this table) |
| **Admin Page** | `/admin/revenue` (Stripe invoices), not the local table |
| **Should Admin See This** | Yes |
| **Missing UI** | Yes — local `invoices` table is not queried in any admin page |
| **Gap Description** | The local `invoices` table appears unused or minimally populated. Revenue page uses Stripe API directly. The two data sources may diverge. |

---

## 11. `employees`

| Field | Value |
|-------|-------|
| **Purpose** | Employee records — role, phone, vehicle, nav preference, status |
| **Row Count Estimate** | Small — one per technician |
| **Admin Visible** | Fully |
| **Admin Page** | `/admin/employees` |
| **Should Admin See This** | Yes |
| **Missing UI** | No critical gaps in current state |
| **Gap Description** | No `updated_at` column. No assignment count or productivity stats shown. |

---

## 12. `shifts`

| Field | Value |
|-------|-------|
| **Purpose** | Employee shift records — clock_in_at, clock_out_at, break_minutes |
| **Row Count Estimate** | Should grow daily — currently empty |
| **Admin Visible** | No |
| **Admin Page** | Nowhere |
| **Should Admin See This** | Yes |
| **Missing UI** | Yes — complete gap |
| **Gap Description** | No shift data is being written (no employee UI for clock in/out). Admin has no hours-worked data. |

---

## 13. `time_events`

| Field | Value |
|-------|-------|
| **Purpose** | Granular GPS-timestamped work events (clock_in, travel_start, arrive, complete_job, etc.) |
| **Row Count Estimate** | Should be high — currently empty |
| **Admin Visible** | No |
| **Admin Page** | Nowhere |
| **Should Admin See This** | Yes |
| **Missing UI** | Yes — complete gap |
| **Gap Description** | Table has `geo geography(point,4326)` column for GPS coordinates. No data is written. Admin has no event timeline. |

---

## 14. `routes`

| Field | Value |
|-------|-------|
| **Purpose** | Daily route plans per employee — status (draft/assigned/in_progress/completed) |
| **Row Count Estimate** | Should grow daily — minimal data currently |
| **Admin Visible** | Partially |
| **Admin Page** | `/admin/route-planning` |
| **Should Admin See This** | Yes |
| **Missing UI** | Partial — route planning page exists but route management is minimal |
| **Gap Description** | Route optimization (auto-sequencing by geography) not implemented. |

---

## 15. `route_stops`

| Field | Value |
|-------|-------|
| **Purpose** | Individual stops within a route — sequence, ETA, status |
| **Row Count Estimate** | Grows with routes |
| **Admin Visible** | Partially |
| **Admin Page** | `/admin/route-planning` (when route selected) |
| **Should Admin See This** | Yes |
| **Missing UI** | Partial |
| **Gap Description** | No reordering of stops. No ETA calculation. |

---

## 16. `assignments`

| Field | Value |
|-------|-------|
| **Purpose** | Links appointments to employees — status + lifecycle timestamps (en_route_at, arrived_at, started_at, completed_at) |
| **Row Count Estimate** | Grows with appointments |
| **Admin Visible** | Partially |
| **Admin Page** | `/admin/appointments` (technician column shows employee name), `/admin/employee-tracking` (current status) |
| **Should Admin See This** | Yes |
| **Missing UI** | Yes — no admin page shows the full assignment timeline or all lifecycle timestamps |
| **Gap Description** | Admin cannot see en_route_at, arrived_at, started_at, completed_at for any assignment from any admin page. |

---

## 17. `job_media`

| Field | Value |
|-------|-------|
| **Purpose** | Photos/videos uploaded by employees for completed jobs |
| **Row Count Estimate** | Grows with job completions |
| **Admin Visible** | No |
| **Admin Page** | Nowhere |
| **Should Admin See This** | Yes |
| **Missing UI** | Yes — critical gap |
| **Gap Description** | `job_media` table has `assignment_id`, `media_type`, `url`, `caption`. Supabase Storage bucket `job-media` exists. No admin page queries this table. Admin cannot review employee job documentation. |

---

## 18. `marketplace_orders` (and `marketplace_order_items`)

| Field | Value |
|-------|-------|
| **Purpose** | Add-on product purchases — status, fulfillment_status, confirmation_id |
| **Row Count Estimate** | Grows with marketplace purchases |
| **Admin Visible** | Fully |
| **Admin Page** | `/admin/billing` — Marketplace Orders section |
| **Should Admin See This** | Yes |
| **Missing UI** | Partial — no export of marketplace orders |
| **Gap Description** | No export. No refund capability. |

---

## 19. `job_checklists`

| Field | Value |
|-------|-------|
| **Purpose** | Job completion checklist JSONB per assignment |
| **Row Count Estimate** | Should grow with completions — currently unknown |
| **Admin Visible** | No |
| **Admin Page** | Nowhere |
| **Should Admin See This** | Yes |
| **Missing UI** | Yes |
| **Gap Description** | Checklist data invisible to admin. If an employee skips checklist items, admin cannot detect this. |

---

## 20. `chemicals_logs`

| Field | Value |
|-------|-------|
| **Purpose** | Chemical application records per assignment (EPA reg no, item, amount, unit) |
| **Row Count Estimate** | Grows with job completions |
| **Admin Visible** | No |
| **Admin Page** | Nowhere |
| **Should Admin See This** | Yes — regulatory compliance |
| **Missing UI** | Yes — critical for regulatory compliance |
| **Gap Description** | Pesticide application records are legally significant. Admin has no way to audit chemical usage. EPA registration numbers are stored but invisible. |

---

## 21. `signatures`

| Field | Value |
|-------|-------|
| **Purpose** | Customer/tech digital signatures per assignment |
| **Row Count Estimate** | Should grow with completions |
| **Admin Visible** | No |
| **Admin Page** | Nowhere |
| **Should Admin See This** | Yes |
| **Missing UI** | Yes |
| **Gap Description** | Legal document management gap. Signatures stored but admin cannot retrieve or review. |

---

## 22. `message_threads` + `messages`

| Field | Value |
|-------|-------|
| **Purpose** | Customer-agent messaging threads |
| **Row Count Estimate** | Grows with support interactions |
| **Admin Visible** | Partially |
| **Admin Page** | `/admin/messages` (but likely broken — see Feature Inventory) |
| **Should Admin See This** | Yes |
| **Missing UI** | Yes — send reply is not wired |
| **Gap Description** | Message threads may have no data if not seeded. Admin reply functionality unconfirmed. |

---

## 23. `tickets`

| Field | Value |
|-------|-------|
| **Purpose** | Customer support tickets |
| **Row Count Estimate** | Grows with support requests |
| **Admin Visible** | Fully |
| **Admin Page** | `/admin/tickets` |
| **Should Admin See This** | Yes |
| **Missing UI** | Partial — no reply, no assignment, no search |
| **Gap Description** | Tickets are visible but minimal management capabilities exist. |

---

## 24. `contact_inquiries`

| Field | Value |
|-------|-------|
| **Purpose** | Contact form submissions from marketing site |
| **Row Count Estimate** | Grows with contact form usage |
| **Admin Visible** | No |
| **Admin Page** | Nowhere |
| **Should Admin See This** | Yes — these are potential leads |
| **Missing UI** | Yes — complete gap |
| **Gap Description** | Every contact form submission goes into a black hole. Admin has no page to view/respond to contact inquiries. |

---

## 25. `notification_log`

| Field | Value |
|-------|-------|
| **Purpose** | Log of all outbound emails and SMS |
| **Row Count Estimate** | Grows with every notification sent |
| **Admin Visible** | Fully |
| **Admin Page** | `/admin/notifications` |
| **Should Admin See This** | Yes |
| **Missing UI** | Partial — no resend capability |
| **Gap Description** | Read-only log. Cannot resend failed notifications from UI. |

---

## 26. `business_hours`

| Field | Value |
|-------|-------|
| **Purpose** | Operational days and service time windows (JSONB) |
| **Row Count Estimate** | Static — 7 rows (one per day) |
| **Admin Visible** | Fully |
| **Admin Page** | `/admin/business-hours` |
| **Should Admin See This** | Yes |
| **Missing UI** | Partial — cannot edit window times/labels from UI |
| **Gap Description** | Window configuration (times, labels, max_jobs_per_tech) can be viewed but not edited from admin. |

---

## 27. `blackout_dates`

| Field | Value |
|-------|-------|
| **Purpose** | Blocked dates when no service is available |
| **Row Count Estimate** | Small — manual entries |
| **Admin Visible** | Fully |
| **Admin Page** | `/admin/appointments` → Blackout Dates Panel |
| **Should Admin See This** | Yes |
| **Missing UI** | No significant gaps |
| **Gap Description** | None — fully functional. |

---

## 28. `parcel_lookup_cache`

| Field | Value |
|-------|-------|
| **Purpose** | Cache of address → acreage lookups from Regrid API |
| **Row Count Estimate** | Grows with quote activity |
| **Admin Visible** | No |
| **Admin Page** | Nowhere |
| **Should Admin See This** | No/Optional — operational cache |
| **Missing UI** | N/A |
| **Gap Description** | Not needed for admin operations. Useful for debugging quote failures. Could expose cache hit rates as a metric. |

---

## 29. `parcel_lookup_attempts`

| Field | Value |
|-------|-------|
| **Purpose** | Log of failed/slow Regrid API calls for debugging |
| **Row Count Estimate** | Grows with errors |
| **Admin Visible** | No |
| **Admin Page** | Nowhere |
| **Should Admin See This** | Optional — developer-facing |
| **Missing UI** | N/A |
| **Gap Description** | Debugging tool. Not needed in day-to-day admin. |

---

## Summary of Admin Visibility by Table

| Table | Admin Visible | Missing UI | Priority |
|-------|--------------|------------|----------|
| profiles | Fully | Partial (card fields, edit) | Medium |
| properties | Fully | Partial (plan/cadence/gate_code) | High |
| appointments | Fully | Partial (history) | Medium |
| schedule_requests | No | Yes — complete gap | High |
| plans/service_plans | Fully | Partial (create/delete/Stripe sync) | Medium |
| pricing_rules | No | Yes | Medium |
| service_areas | Fully | None | — |
| payments | Fully | Partial (refund, link to Stripe) | High |
| subscriptions | Partially | Yes — no subscriptions page | Critical |
| invoices | Partially | Yes | Medium |
| employees | Fully | None | — |
| shifts | No | Yes | High |
| time_events | No | Yes | High |
| routes | Partially | Partial | Medium |
| route_stops | Partially | Partial | Medium |
| assignments | Partially | Yes (timeline) | High |
| job_media | No | Yes — complete gap | Critical |
| marketplace_orders | Fully | Partial (export/refund) | Medium |
| job_checklists | No | Yes | High |
| chemicals_logs | No | Yes — compliance | Critical |
| signatures | No | Yes | Medium |
| message_threads | Partially | Partial | Medium |
| tickets | Fully | Partial (no reply/assign/search) | High |
| contact_inquiries | No | Yes — complete gap | High |
| notification_log | Fully | Partial (no resend) | Low |
| business_hours | Fully | Partial (window editing) | Medium |
| blackout_dates | Fully | None | — |
| parcel_lookup_cache | No | N/A | Low |
| parcel_lookup_attempts | No | N/A | Low |
