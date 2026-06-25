# SYSTEM OF RECORD AUDIT
## Generated: 2026-05-29
## Scope: Single authoritative source of truth for every major entity

---

## Methodology

For each entity, code and migration evidence is cited. "Conflicting writers" means multiple code paths write the same fields. "Source of truth" answers what wins if Stripe and local DB disagree.

---

## Entity 1: Customer Identity (`auth.users` + `profiles`)

| Field | Value |
|-------|-------|
| **Authoritative Table** | `auth.users` (managed by Supabase Auth) + `public.profiles` (application-managed extension) |
| **Authoritative Route** | Supabase Auth client (signup) for `auth.users`. No dedicated server route for `profiles` creation — it must be created by a DB trigger on `auth.users INSERT` or during onboarding. |
| **Conflicting Writers** | `billingStripe.ts` (`confirm-booking`) writes `is_onboarded`, `onboarding_progress` to `profiles`. `webhooksStripe.ts` (`invoice.paid`) also writes `is_onboarded: true` to `profiles`. `billingStripe.ts` (`attach-payment-method`) writes `card_last4`, `card_brand`, `card_expiry`. `webhooksStripe.ts` (`invoice.paid`) also writes these same card fields. Three separate writes to `profiles` for the same data. |
| **Source of Truth** | `auth.users` is the canonical identity record. `profiles` is the application extension. Stripe stores email and name separately — NOT authoritative for identity. |
| **Dependent Systems** | Billing (requires `stripe_customer_id`), employee auth (`employees.user_id`), notifications (requires `email`), appointments (`user_id`), admin customer list. |
| **Stale Risk** | Medium. If the `auth.users` trigger that creates `profiles` is not deployed, a `profiles` row may never be created, breaking billing, notifications, and onboarding. No periodic reconciliation between `auth.users` and `profiles`. |

**Key Conflict:** Both `confirm-booking` and `invoice.paid` webhook write `is_onboarded: true`. Neither checks if the other has already written it. This is benign but is evidence of multiple writers without a single owner.

---

## Entity 2: Subscription Status

| Field | Value |
|-------|-------|
| **Authoritative Table** | `public.subscriptions` (local mirror) |
| **Authoritative Route** | `webhooksStripe.ts` — `invoice.paid` sets `status: "active"`, `customer.subscription.deleted` sets `status: "canceled"`, `invoice.payment_failed` sets `status: "past_due"`, `customer.subscription.updated` syncs non-active states. |
| **Conflicting Writers** | `billingStripe.ts` (`confirm-booking`) writes `status: "active"` immediately on payment confirmation (before webhook fires). `billingStripe.ts` (`update-subscription-plan`) writes `status: subscription.status` (uses live Stripe value). Both the client route and the webhook can set `status`. |
| **Source of Truth** | **Stripe is authoritative.** The webhook is the canonical update path. `confirm-booking` writes an optimistic `active` status that may be slightly ahead of Stripe's state. If they disagree (e.g., webhook delivery failure), local DB status may be stale. |
| **Dependent Systems** | `requireActiveSubscription()` guard in `billingStripe.ts` reads `subscriptions.status`. Admin scheduling queue reads `status = 'active'`. Customer dashboard subscription display. Past-due alert on Overview page. |
| **Stale Risk** | High. Annual subscriptions (`program = 'annual'`) have no Stripe Subscription object and no `customer.subscription.deleted` webhook. Their `status` will never auto-expire. Recurring subscriptions can become stale if webhook delivery fails (Stripe retries for 3 days; after that, local DB stays at prior state). |

**Status values in use:** `active`, `past_due`, `canceled`, `incomplete` (from `update-subscription-plan` upsert), `expired` (mentioned in code as desired state but not written anywhere in production code paths).

---

## Entity 3: Payment Method

| Field | Value |
|-------|-------|
| **Authoritative Table** | Stripe (authoritative). `public.profiles` columns `card_last4`, `card_brand`, `card_expiry` are a denormalized cache. |
| **Authoritative Route** | Stripe API (payment method is stored in Stripe). Local cache updated by: `billingStripe.ts` (`attach-payment-method`, line 1087) and `webhooksStripe.ts` (`invoice.paid`, lines 503-520). |
| **Conflicting Writers** | Two routes write to the same `profiles.card_*` fields: the manual attach route and the invoice.paid webhook. The test-only `create-and-attach-payment-method` route writes customer metadata in Stripe only (not profiles). |
| **Source of Truth** | Stripe is authoritative. `profiles.card_*` fields are a display cache only. |
| **Dependent Systems** | Customer billing dashboard display (reads from `profiles.card_*`). Admin customer detail (does NOT display these fields — they are customer-facing only). |
| **Stale Risk** | High. `payment_method.detached` Stripe webhook is NOT handled in `webhooksStripe.ts`. If a customer removes their card from Stripe, `profiles.card_*` fields are never cleared. Stale card info displayed to customer. Evidence: `webhooksStripe.ts` switch statement — no `payment_method.detached` case. |

---

## Entity 4: Appointment Status

| Field | Value |
|-------|-------|
| **Authoritative Table** | `public.appointments` — `status` column |
| **Authoritative Route** | Multiple routes write to `appointments.status`: `billingStripe.ts` (`confirm-booking`) writes `scheduled`. `webhooksStripe.ts` (`checkout.session.completed`) writes `scheduled`. `adminAppointments.ts` (`dispatch`) writes `en_route`. `adminAppointments.ts` (`cancel`) writes `canceled`. `employeeAssignments.ts` (status update) writes `completed` when assignment transitions to `completed` (line 212-223). `customerAppointments.ts` (`reschedule`) writes `scheduled`. |
| **Conflicting Writers** | Booking confirmation (client-side) and webhook both create appointments (guarded by idempotency check on `user_id + property_id + scheduled_date`). Admin dispatch and employee completion both write status. |
| **Source of Truth** | `appointments.status` is the local record. No external system holds an independent copy. |
| **Dependent Systems** | Customer dashboard (`appointments WHERE user_id = current_user`). Admin Visits page (`appointments WHERE status = 'completed'`). Admin appointments list. Employee portal (reads appointment via assignment join). Scheduling queue checks `status NOT IN ('completed', 'canceled')`). |
| **Stale Risk** | Medium. As of the latest `employeeAssignments.ts` code, job completion DOES cascade to `appointments.status = 'completed'` (line 212-223, added in recent sprint). The prior gap is closed. However, cancellation still does NOT cascade to `assignments`. |

**Known status values from migrations and code:**
- Initial schema (2025-02-23): `requested`, `scheduled`, `completed`, `canceled`
- Code references also: `en_route`, `in_progress`, `confirmed`, `cancelled` (with double-l)
- `customerAppointments.ts` ACTIVE_STATUSES constant: `["requested", "scheduled", "confirmed"]`
- Admin dispatch route blocks transitions for: `"canceled", "cancelled", "completed"`

**Inconsistency:** Two spellings of canceled exist — `canceled` (used in most code) and `cancelled` (alternate spelling guarded against in multiple NOT IN clauses). The initial migration CHECK constraint only allows `canceled` (single-l). Rows with `cancelled` (double-l) would violate the constraint unless the constraint was later modified or removed.

---

## Entity 5: Assignment Status

| Field | Value |
|-------|-------|
| **Authoritative Table** | `public.assignments` — `status` column |
| **Authoritative Route** | `adminAppointments.ts` (`POST /api/admin/assignments`) writes `status: "scheduled"` on upsert. `adminAppointments.ts` (`dispatch`) writes `status: "en_route"`. `employeeAssignments.ts` (`POST /api/employee/assignments/:id/status`) writes: `assigned`, `en_route`, `in_progress`, `completed`, `no_show`, `skipped`. |
| **Conflicting Writers** | Admin creates assignments at `scheduled`. Employee updates them through the lifecycle. No other writers confirmed. |
| **Source of Truth** | `assignments.status` is fully local — no external system mirrors it. |
| **Dependent Systems** | Employee portal (reads `assignments` for today). Admin employee tracking page. Admin appointment view (shows technician assignment status). Job media upload (gated on assignment ownership). |
| **Stale Risk** | Critical. When an appointment is canceled (admin or customer), the linked `assignments.status` is NOT updated. An assignment can remain `scheduled` or `en_route` while `appointments.status = 'canceled'`. Evidence: `adminAppointments.ts` cancel route does not touch `assignments` table. |

**Valid status values (from `employeeAssignments.ts` VALID_STATUSES constant, line 11):**
`"assigned"`, `"en_route"`, `"in_progress"`, `"completed"`, `"no_show"`, `"skipped"`

**Note:** The migration constraint (2025-11-10, line 56) allows `('scheduled','en_route','in_progress','completed','no_show','skipped')`. The code constant uses `"assigned"` instead of `"scheduled"`. This is a discrepancy between the DB constraint and the application. Admin assignments route uses `status: "scheduled"` (matching the DB constraint). The code VALID_STATUSES includes `"assigned"` but not `"scheduled"`. There may be rows with `status = 'scheduled'` written by admin that the employee portal displays as `"assigned"`.

---

## Entity 6: Employee Status

| Field | Value |
|-------|-------|
| **Authoritative Table** | `public.employees` — `status` column |
| **Authoritative Route** | No dedicated admin employee PATCH route found in the audited server routes (admin management routes not fully audited). The employees table is written by admin via Supabase directly or via admin routes not shown in the key files. |
| **Conflicting Writers** | Single writer assumed (admin). No automated process changes employee status. |
| **Source of Truth** | Local `employees.status` column. No external system. |
| **Dependent Systems** | `employeeAssignments.ts` — `getAuthenticatedEmployee()` checks `status = 'active'` (line 31). Assignment capacity calculation in `customerAppointments.ts` queries `employees WHERE status = 'active'`. Admin employee list. |
| **Stale Risk** | Low for the column itself. High for its implications: deactivating an employee does not cancel their existing `assignments`. An inactive employee can have `status = 'inactive'` while having open `assignments` with `status IN ('scheduled', 'en_route')`. |

**Valid status values (from migration 2025-11-28, line 75):** `'active'`, `'inactive'`

---

## Entity 7: Property Record

| Field | Value |
|-------|-------|
| **Authoritative Table** | `public.properties` |
| **Authoritative Route** | Client-side Supabase call during scheduling flow (property upsert). `billingStripe.ts` (`confirm-booking`) writes `program`, `cadence`, `service_preferences`. `webhooksStripe.ts` (`checkout.session.completed`) writes `program`, `cadence`, `service_preferences`. |
| **Conflicting Writers** | Three writers update the same `program` and `cadence` fields: the scheduling flow client call, `confirm-booking` server route, and `checkout.session.completed` webhook. All write identical values (idempotent in practice) but there is no declared single owner. Admin can add properties via admin panel (not examined in detail). |
| **Source of Truth** | Local `properties` table. No external authoritative source. |
| **Dependent Systems** | Appointments (FK `property_id`). Subscriptions (FK `property_id`). Availability calculation (uses `service_area_id`, `service_preferences`). Property display in employee portal. Parcel quote (reads `acreage`). |
| **Stale Risk** | Low for core fields. Medium for `service_preferences` — stored as JSONB and written from multiple paths. If client and webhook disagree on preferences, last-write-wins with no audit trail. |

---

## Entity 8: Service Order

| Field | Value |
|-------|-------|
| **Authoritative Table** | `public.service_orders` (schema not found in migrations but referenced in `server/services/serviceOrders.ts`) |
| **Authoritative Route** | `server/services/serviceOrders.ts` — `createSubscriptionServiceOrder()`, `createOneTimeServiceOrder()`, `createMarketplaceAddOnServiceOrder()`. Called from `webhooksStripe.ts`. |
| **Conflicting Writers** | `checkout.session.completed` webhook calls `createOneTimeServiceOrder()` and `createMarketplaceAddOnServiceOrder()`. `payment_intent.succeeded` webhook also calls `createMarketplaceAddOnServiceOrder()`. `invoice.paid` webhook calls `createSubscriptionServiceOrder()`. Multiple webhook events can attempt to create the same service order. Idempotency handling unclear without reading `serviceOrders.ts` internals. |
| **Source of Truth** | Local `service_orders` table. No Stripe-side equivalent. |
| **Dependent Systems** | Admin billing page (shows service orders). Admin marketplace order view (linked service order). Refund tracking (`markServiceOrderRefunded` updates service order status). |
| **Stale Risk** | Medium. Edge cases where `checkout.session.completed` fires before `payment_intent.succeeded` can cause duplicate creation attempts. The `charge.refunded` webhook marks service orders as refunded. |

---

## Entity 9: Marketplace Order

| Field | Value |
|-------|-------|
| **Authoritative Table** | `public.marketplace_orders` |
| **Authoritative Route** | `webhooksStripe.ts` (`checkout.session.completed`) creates the order. `webhooksStripe.ts` (`payment_intent.succeeded`) updates `status: "completed"`. `webhooksStripe.ts` (`payment_intent.payment_failed`) sets `status: "failed"`. `webhooksStripe.ts` (`checkout.session.expired`) sets `status: "expired"`. `webhooksStripe.ts` (`charge.refunded`) sets `status: "refunded"`. Admin route `adminMarketplace.ts` updates `fulfillment_status`. |
| **Conflicting Writers** | Two webhook events write to the same row: `checkout.session.completed` creates it, `payment_intent.succeeded` updates its status. Race condition possible if events arrive out of order. |
| **Source of Truth** | Stripe is authoritative for payment state. `marketplace_orders.status` mirrors Stripe payment status. `fulfillment_status` is operationally owned by admin. |
| **Dependent Systems** | Admin billing page (order list). Customer dashboard order history. Service orders (linked via `marketplace_order_id`). |
| **Stale Risk** | Medium. Out-of-order webhook delivery can leave `marketplace_orders` in `pending` after payment was actually confirmed. The `payment_intent.succeeded` handler patches this, but if `checkout.session.completed` hasn't fired yet, the order row doesn't exist. |

**Status values in use:**
- `marketplace_orders.status`: `pending`, `completed`, `failed`, `expired`, `refunded`
- `marketplace_orders.fulfillment_status`: `pending`, `processing`, `scheduled`, `fulfilled`, `cancelled`

---

## Entity 10: Job Media

| Field | Value |
|-------|-------|
| **Authoritative Table** | `public.job_media` |
| **Authoritative Route** | `employeeAssignments.ts` (`POST /api/employee/assignments/:id/media`) — single writer. |
| **Conflicting Writers** | None. Only the employee-facing route writes to `job_media`. |
| **Source of Truth** | Local `job_media` table + `job-media` Supabase Storage bucket. |
| **Dependent Systems** | Employee portal (upload form). Admin visits page (does NOT yet display job media — Gap 5 from prior audit). Completion notification email (checks for media to customize email text). |
| **Stale Risk** | Low. FK constraint `assignment_id REFERENCES assignments(id) ON DELETE CASCADE` (from migration 2025-11-10, line 69). If an assignment is deleted, media is cascade-deleted. However, assignments are never deleted in application code (only status-updated), so this trigger is never exercised in practice. |

---

## Entity 11: Notification State

| Field | Value |
|-------|-------|
| **Authoritative Table** | `public.notification_log` |
| **Authoritative Route** | Multiple routes write notification logs: `employeeAssignments.ts` (completion notification, line 278), `adminAppointments.ts` (cancellation and dispatch notifications via `logNotification()`), `customerAppointments.ts` (reschedule notification via `logNotification()`). The shared `server/services/notifications/notificationLogger.ts` utility is the canonical write path. |
| **Conflicting Writers** | Multiple server routes write to `notification_log` through the shared `logNotification()` utility. Some routes (e.g., `employeeAssignments.ts` completion) write directly via `db.from("notification_log").insert()` rather than using the shared utility. Inconsistent writer interface. |
| **Source of Truth** | Local only. No external notification system (Resend, Twilio) feeds back into `notification_log`. |
| **Dependent Systems** | Admin notification history view (if implemented). Deduplication index prevents duplicate `(appointment_id, notification_type)` with `status = 'sent'`. |
| **Stale Risk** | Low. FK `appointment_id REFERENCES appointments(id) ON DELETE SET NULL` (from migration 2026-05-16_phase2) ensures orphaned references are nulled if appointment is deleted. FK `profile_id REFERENCES profiles(id) ON DELETE SET NULL` same behavior. |

---

## Entity 12: Support Ticket

| Field | Value |
|-------|-------|
| **Authoritative Table** | `public.tickets` |
| **Authoritative Route** | Customer creates via dashboard Support page (Supabase client insert). Admin updates status via admin Tickets page. No server route wrapping tickets operations found in audited files — direct Supabase client calls. |
| **Conflicting Writers** | Customer can INSERT. Admin can UPDATE (RLS: `Admins can manage all tickets`). Customer cannot update their own ticket after submission (no UPDATE policy for customers). |
| **Source of Truth** | Local. No external ticketing system. |
| **Dependent Systems** | Admin Tickets page. Customer Support dashboard. |
| **Stale Risk** | Low. Self-contained table. `updated_at` trigger fires automatically. |

**Status values (from `2025-11-25_tickets_table.sql`):** `open`, `in_progress`, `resolved`, `closed`

---

## Entity 13: Business Hours

| Field | Value |
|-------|-------|
| **Authoritative Table** | `public.business_hours` |
| **Authoritative Route** | `server/routes/adminBusinessHours.ts` (new file, not fully audited). Admin writes via admin Settings/Business Hours page. Initial data seeded from migration `2026-05-16_phase1_reliable_availability.sql`. |
| **Conflicting Writers** | Seed migration provides defaults. Admin route allows override. No client-side writer. Single canonical writer: admin route. |
| **Source of Truth** | Local `business_hours` table. No external source. |
| **Dependent Systems** | `customerAppointments.ts` (`checkWindowAvailability`) reads this for window validation. Availability API for scheduling flow reads this. Capacity calculation reads `max_jobs_per_tech` from windows JSONB. |
| **Stale Risk** | Low. UNIQUE INDEX prevents duplicate global/area-day combinations. Admin changes are immediate. No caching layer between the table and availability queries. |

---

## Entity 14: Blackout Dates

| Field | Value |
|-------|-------|
| **Authoritative Table** | `public.blackout_dates` |
| **Authoritative Route** | `server/routes/adminBlackoutDates.ts` (new file, not fully audited). Admin-only writes via admin Settings page. |
| **Conflicting Writers** | Single writer: admin route. |
| **Source of Truth** | Local `blackout_dates` table. |
| **Dependent Systems** | `customerAppointments.ts` (`checkWindowAvailability`) reads blackout dates for reschedule validation. Availability API reads for scheduling. |
| **Stale Risk** | Low. Small table, infrequently written. No cache. |

---

## Entity 15: Revenue Metrics

| Field | Value |
|-------|-------|
| **Authoritative Table** | **Not stored.** Computed at query time from `subscriptions`, `payments`, and `service_orders`. |
| **Authoritative Route** | Admin Overview page queries `subscriptions` for active counts and past-due counts. No dedicated revenue metrics route confirmed. No `revenue_metrics` or `kpi_snapshots` table exists in migrations. |
| **Conflicting Writers** | N/A — not stored. |
| **Source of Truth** | Computed from `subscriptions` and `payments` tables on each page load. Stripe Dashboard for verified payment history. |
| **Dependent Systems** | Admin Overview KPI cards. Revenue trend chart (currently shows hardcoded percentages per prior audit). |
| **Stale Risk** | High. Because metrics are computed from local tables, any stale `subscriptions.status` (e.g., expired annual plans still showing `active`) will overstate MRR. No periodic snapshot or reconciliation. |

---

## Entity 16: Quote/Lead

| Field | Value |
|-------|-------|
| **Authoritative Table** | **Does not exist.** No `quote_leads` table in any migration. |
| **Authoritative Route** | `server/routes/parcelQuote.ts` — handles address lookup but writes nothing to a leads table. `parcel_lookup_cache` table (from migration `2026-05-26_parcel_lookup_cache.sql`) stores anonymous parcel lookup results keyed by address/APN — no visitor identity or email. |
| **Conflicting Writers** | N/A — no leads data is captured. |
| **Source of Truth** | None. Quote/lead data is entirely ephemeral. |
| **Dependent Systems** | None — no downstream system reads quote leads (because none exist). |
| **Stale Risk** | N/A. 100% abandonment rate from a data perspective. |

**Note:** `schedule_requests` table exists from the initial migration (2025-02-23) and captures name, email, phone, address for guest scheduling requests — but this is a separate form from the quote widget and is not wired to the current booking flow. It functions as a manual inquiry form, not a quote lead capture. No admin page displays it.

---

## Summary: Source of Truth Matrix

| Entity | Authoritative Source | Stale Risk | Critical Gap |
|--------|---------------------|-----------|-------------|
| Customer Identity | Supabase `auth.users` | Medium | Profile trigger may not be deployed |
| Subscription Status | Stripe (mirrored in `subscriptions`) | High | Annual plans never auto-expire; webhook gap for others |
| Payment Method | Stripe (cached in `profiles.card_*`) | High | `payment_method.detached` not handled |
| Appointment Status | `appointments.status` (local) | Medium | Multiple status spellings (`canceled` vs `cancelled`) |
| Assignment Status | `assignments.status` (local) | Critical | Not updated on appointment cancellation |
| Employee Status | `employees.status` (local) | Low | Deactivation doesn't cancel open assignments |
| Property Record | `properties` (local) | Low | Three writers for same fields (idempotent but messy) |
| Service Order | `service_orders` (local) | Medium | Duplicate creation risk from two webhook events |
| Marketplace Order | Stripe (mirrored in `marketplace_orders`) | Medium | Race condition on out-of-order webhooks |
| Job Media | `job_media` + Storage (local) | Low | Not visible to admin |
| Notification State | `notification_log` (local) | Low | Inconsistent writer interface |
| Support Ticket | `tickets` (local) | Low | — |
| Business Hours | `business_hours` (local) | Low | — |
| Blackout Dates | `blackout_dates` (local) | Low | — |
| Revenue Metrics | Computed (not stored) | High | Stale subscription data distorts all metrics |
| Quote/Lead | None — not captured | Critical | 100% lead loss at top of funnel |
