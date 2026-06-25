# Phase 4 — Operational Systems Audit
**Date:** 2026-06-19

Methodology: every table/column claim below was verified against the **live production schema** via direct, read-only Supabase REST API queries (not just migration files) — several of this codebase's tables have drifted from their tracked migrations (ad-hoc columns added directly in the SQL Editor, same pattern flagged in earlier sprints for `promo_codes`). Migration files were cross-checked but not trusted alone.

## 1. Customer Service / Ticketing

**Does it exist?** Yes — partially.

| Piece | File / Table | Status |
|---|---|---|
| `tickets` table | `db/migrations/2025-11-25_tickets_table.sql` (tracked) | Tracked migration defines `id, user_id, subject, description, status(open/in_progress/resolved/closed), priority(low/medium/high/urgent), created_at, updated_at`. **Live production schema has more**: `property_id`, `assigned_to`, `due_at` — added outside any migration. 5 rows live today. |
| Customer create/view | `client/pages/dashboard/Help.tsx` (the live page — see below) | Customer can create a ticket (subject + free-text description only) and see their own ticket list (status/priority badges). No categories, no reply thread, no way to add a follow-up message to an existing ticket. |
| Admin inbox | `client/pages/admin/Tickets.tsx` | Kanban-style board grouped by status (open/in_progress/resolved), drag-equivalent buttons to change status/priority. References `assigned_to` in its TS interface but **no UI to actually assign** a ticket to staff. No reply UI, no internal notes, no escalation. |
| Auto-created tickets | `server/services/appointments/generateRecurring.ts:167-174` | The recurring-appointment generator auto-creates a ticket when generation fails for a customer — an existing, working integration point. |

**Important — duplicate/dead code found:** `client/pages/dashboard/Support.tsx` is a near-identical, byte-for-byte-similar copy of the ticket-creation/viewing UI now in `Help.tsx`, but it is **dead code** — `App.tsx:184` redirects `/dashboard/support` → `/dashboard/help` via `<Navigate>`. `Help.tsx` is the live page (also bundles a separate, unrelated "Messages" tab — see below). **Do not extend `Support.tsx`. Extend `Help.tsx`.**

**Messages / `message_threads` — a different system, not to be confused with tickets.** `client/pages/dashboard/Help.tsx`'s "Messages" tab and `client/pages/admin/Messages.tsx` use `message_threads` (keyed by `assignment_id`, i.e. one thread per technician visit) + `messages` (`direction: inbound/outbound`, `channel`, `read_at`). This is a **job-specific chat channel**, unrelated to support-ticket categorization. **Do not reuse this for ticket replies** — it's keyed to a specific visit/assignment, not a ticket, and conflating the two would break the existing per-job chat UI.

**Complaints / retreatment / callbacks:** No dedicated concept. The existing "Re-service Promise" button on `Help.tsx` just creates a `tickets` row with a hardcoded subject — this is effectively an unlabeled "retreatment_request" category already in spirit, just not formalized as a category value.

**Admin alerts:** `server/services/notifications/adminNotificationService.ts` has no existing `event_type` resembling a customer complaint/service-quality issue — all existing types are operational (`field_ops.*`, `scheduling.*`, `workforce.*`).

**What's missing:** categories, a real reply thread per ticket, internal-only notes (hidden from customer), a working assignment UI, escalation status, the `pending_customer`/`pending_staff`/`escalated` statuses, `urgent` priority value (live data may or may not enforce a CHECK at all anymore — schema drift).

**What to reuse:** the `tickets` table itself (don't create a parallel `support_tickets` table — that would be the literal duplicate-system failure condition). **What not to duplicate:** `message_threads`/`messages` (job chat) and `Support.tsx` (dead code).

## 2. Technician Dashboard

**Does it exist? Is it complete?** Yes, and it's substantially complete already.

| Capability | Status | Evidence |
|---|---|---|
| Today's route, stop order | ✅ Complete | `client/pages/employee/Route.tsx` |
| Assigned appointments list | ✅ Complete | `client/pages/employee/Assignments.tsx` |
| Navigation link | ✅ Complete | `AssignmentDetail.tsx:441` — `navUrl(lat,lng)` opens external maps |
| Customer/property info | ✅ Complete | `AssignmentDetail.tsx` shows name/phone/address/service type |
| Service notes (admin-entered, read-only) | ✅ Complete | `AssignmentDetail.tsx:526-530` |
| Job photo/video upload | ✅ Complete | `job_media` table, `AssignmentDetail.tsx:175-204` |
| Mark en route / arrived / completed | ✅ Complete | `AssignmentDetail.tsx:428-430`, backed by `server/routes/employeeAssignments.ts` |
| Clock in/out | ✅ Complete | `client/pages/employee/Timesheets.tsx`, `shifts` table |
| Job-specific messaging | ✅ Complete | Same thread system audited above, technician side |
| **Blocked access / unable to service** | ❌ **Missing UI, backend ready** | Server already accepts `no_show`/`skipped` as valid assignment statuses (`employeeAssignments.ts` `VALID_STATUSES`), and the detail page *displays* those statuses if set — but there is **no button anywhere for the technician to set them**. Only `en_route`/`in_progress`/`completed` buttons exist. |
| **Treatment notes (technician-written)** | ❌ **Missing — no DB column** | `assignments` table (verified live: `id, appointment_id, employee_id, status, started_at, completed_at, en_route_at, arrived_at, created_at`) has **no notes column at all**. The "Notes" shown on the detail page is the admin-entered `appointments.notes`, not something the technician can write. |

**What's missing:** exactly two things, both narrow — a "blocked access" action and a technician-notes field. Everything else required by the spec already works.

**What to reuse:** the existing status-transition pattern (`updateStatus()` in `AssignmentDetail.tsx` + the `PATCH` handler in `employeeAssignments.ts`) — extend it, don't replace it.

## 3. Role-Based Dashboards

**Current roles, verified live:** `profiles.role` values actually in production today: `admin`, `customer`, `employee` (the tracked migration's original CHECK was `admin/support/customer`, but live data and the live guards have moved to `admin/customer/employee`; a probe insert with `role: "sales"` was rejected on an unrelated NOT NULL constraint, not a role CHECK — meaning the live constraint is already permissive enough not to block new role strings, or has no CHECK at all anymore).

**Existing routing:** `client/App.tsx` + `RequireAdmin`/`RequireCustomer`/`RequireEmployee` (each checks `profile.role` against a fixed allow-list, redirecting to the matching login page otherwise). `RequireEmployee` already treats `admin`, `support`, `technician`, `employee` as employee-portal-eligible (`client/components/auth/RequireEmployee.tsx:8`).

**What does NOT exist:**
- **`owner`** — no distinct role anywhere in the codebase. "Owner" and "admin" are the same `role: 'admin'` today.
- **`customer_service`** — not a recognized role anywhere; a `customer_service` profile today would either fail every guard or (if manually set to `support`) fall into the generic employee/technician portal, which is the wrong UI for that job.
- **`sales`** — same as above, no recognition anywhere.
- Server-side: `requireAdmin`/`requireAdminOrEmployee` (`server/middleware/requireAdmin.ts`) are the only two role-gating middlewares. There is no scoped middleware that grants partial access (e.g., tickets + customer lookup, but not employee/financial management) — exactly what `customer_service` and `sales` need without becoming full admins.

**Decision needed (see Phase 2 report):** whether to introduce real new role values + scoped middleware (real access control) vs. a cosmetic-only distinction. A cosmetic-only "owner" badge that doesn't gate anything differently would not satisfy "implement role-based dashboards" honestly.

## 4. Customer Satisfaction / NPS

**Does it exist?** No. Confirmed via a repo-wide search for `satisfaction|nps|promoter|detractor` — every hit is unrelated marketing copy ("satisfaction guarantee" on the public Guarantee page, legal/translation strings) or incidental. There is no survey table, no rating capture, no NPS calculation, and no detractor-routing logic anywhere in the codebase. **Classification: C — Missing, full foundation needed.**

The closest *related* existing pieces (to potentially hook into, not duplicate):
- `server/routes/employeeAssignments.ts`'s `status === "completed"` block (already the hook point for the service-completion email and, from the Phase 2 sprint, the review-request email) — the natural trigger point for "send satisfaction survey after completion."
- `server/services/notifications/adminNotificationService.ts` — the existing alert-creation pattern for the "detractor creates an admin alert" requirement.
- `tickets` table — the existing "detractor optionally creates a support ticket" requirement reuses this directly once ticketing is hardened (Phase 3).

## 5. Blog / CMS

**Does it exist? Is it complete?** Far more complete than expected — this needs careful reuse, not a rebuild.

| Piece | Status | Evidence |
|---|---|---|
| `blog_posts` table | Exists in production (0 rows), **not tracked by any migration** | Verified live columns via column-probing: `id, slug, title, excerpt, body, author, tags, published, published_at, reading_time_minutes, seo_title, seo_description, created_at, updated_at`. `seo_title`/`seo_description` already exist and are already unused by any UI. `content`/`featured_image_url` (the spec's exact field names) do **not** exist — `body` is the actual content column, no image field at all. |
| Admin CRUD API | **Already fully built** | `server/routes/adminContent.ts:12-55` — `GET/POST/PUT/DELETE /api/admin/content/blog`, all `requireAdmin`-gated. `POST` already accepts `body`, `tags`, `seo_title`, `seo_description`. `PUT` accepts any field (spreads `req.body` into the update). |
| Admin UI | **Partially built** | `client/pages/admin/Content.tsx` (the "Blog & FAQs" nav entry) — list, publish/unpublish toggle, delete, and a **create** dialog. The create dialog only collects `title/slug/excerpt/author/reading_time` — **it never sends `body`, `tags`, `seo_title`, or `seo_description`**, even though the API accepts them. **There is no edit dialog at all** — once created, a post's title/slug/excerpt/body can never be changed via the UI (only published-toggle and delete). |
| Public listing | **Built** | `client/pages/Blog.tsx:22-47` — queries `blog_posts` where `published = true`, falls back to static `data/blog.ts` if the DB query returns nothing. |
| Public single-post page | **Not wired to the DB at all** | `client/pages/BlogPost.tsx` — 100% hardcoded; literal comment in the source: *"in a real app, this would come from a CMS."* A post created via the admin UI would appear in the `/blog` list but its `/blog/:slug` page would show nothing real. |
| `author_id` (FK) | Missing | Only a free-text `author` display-name column exists; no link to `profiles`. |

**Classification: B — Partial, extend safely.** Do **not** build a parallel blog system or a new `/admin/blog` page from scratch — the backend is essentially done. The real gaps are: two missing DB columns, the create dialog not exposing fields the API already supports, no edit dialog, and the public detail page not reading from the DB.

## Cross-Cutting "Do Not Duplicate" List

- `client/pages/dashboard/Support.tsx` — dead code, redirected away. Do not extend.
- `message_threads`/`messages` — job-specific chat, not a ticket reply system.
- `server/routes/adminContent.ts` blog CRUD — already complete; extend the schema and the UI, not the API shape.
- `tickets` table — reuse as the ticket entity; do not create `support_tickets` alongside it.
