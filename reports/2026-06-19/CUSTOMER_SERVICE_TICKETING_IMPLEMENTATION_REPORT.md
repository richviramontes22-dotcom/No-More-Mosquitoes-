# Customer Service / Ticketing — Implementation Report
**Date:** 2026-06-19

## What Was Built

| Piece | File |
|---|---|
| Migration | `db/migrations/2026-06-19_ticketing_hardening.sql` — extends the existing `tickets` table, adds `ticket_messages` + `ticket_internal_notes` |
| Customer UI | `client/pages/dashboard/Help.tsx` — category/priority on create, ticket detail Sheet with reply thread |
| Admin UI | `client/pages/admin/Tickets.tsx` — category filter, assignment, status/category editing, reply, internal notes, escalate/close/reopen |

No new tables for the ticket entity itself, no parallel `support_tickets` table, and `client/pages/dashboard/Support.tsx` (confirmed dead/redirected in the audit) was not touched.

## Schema Changes

- `tickets.category` — new, 7 values exactly as specified, default `general`.
- `tickets.status` — CHECK widened to a **superset** of the live values (`open`, `in_progress`, `resolved`, `closed`) plus the three new ones (`pending_customer`, `pending_staff`, `escalated`). Existing rows remain valid; `in_progress` was kept rather than removed, since live data already uses it and removing it would require a data migration for zero benefit.
- `tickets.priority` — unchanged; the original migration already allowed `low/medium/high/urgent`. The spec's "normal" tier maps to the existing "medium" value rather than introducing a synonym, to avoid touching every existing UI reference and historical row for a label-only difference.
- `ticket_messages` — customer-visible reply thread, `sender_role` (`customer`/`staff`), RLS: customers can read/write only their own ticket's messages (and only as `sender_role: 'customer'`, own `sender_id`); staff (`admin` or `customer_service`) can read/write all.
- `ticket_internal_notes` — staff-only. **No RLS policy grants customers any access at all** — under RLS, a customer querying this table gets zero rows, not a filtered subset. This is the actual enforcement mechanism for "customer cannot see internal notes," not just a UI omission.

## Customer Experience (`Help.tsx`)

Ticket creation now collects `category` (required, defaults to General) and `priority` (optional, defaults to Medium; `urgent` is intentionally not customer-selectable — escalation to urgent is a staff/triage judgment, not a self-service option). Clicking any ticket in the list opens a detail Sheet (reusing the same `Sheet` component and visual pattern as the existing job-conversation "Messages" tab, for consistency) showing the full description, status, category, the reply thread, and a reply box — hidden once the ticket is `resolved`/`closed`, since replying to a closed ticket isn't a supported action here (the customer would open a new ticket instead).

## Admin/Customer Service Experience (`Tickets.tsx`)

The existing kanban board (open/in_progress/resolved columns) is preserved unchanged for quick status moves, plus a category filter and an `escalated` column. Each card now also shows its category and assignee, and a "Manage / Reply" button opens a detail dialog with:
- Status (full 7-value dropdown), category, and assignment (dropdown populated from `profiles` where `role IN ('admin','customer_service')`) — all three are simple field updates.
- Escalate / Close / Reopen — explicit one-click actions, each just a status write (escalate → `escalated`, close → `closed`, reopen → `open`).
- The customer-visible reply thread, with a reply box that **also auto-transitions the ticket to `pending_customer`** when staff sends a reply (the natural "ball is in their court now" signal) — the only automatic status transition in this system, and it's a narrow, sensible default rather than a workflow surprise.
- The internal-notes thread, visually marked (amber background, lock icon, "staff only" label) so it's unambiguous to whoever's looking at the screen that this content never reaches the customer.

## Architecture Note: No New Server Routes

Per the audit, the *existing* ticket system talks directly from the client to Supabase, relying on RLS for security — there was no `server/routes/*ticket*.ts` file before this change, and none was added. The new `ticket_messages`/`ticket_internal_notes` tables follow the same established pattern for this specific feature area, with the RLS policies in the migration doing the actual security enforcement (verified in Phase 9's tests). This is a deliberate consistency decision, not an oversight — introducing an Express layer here would be a bigger architectural change than the spec asked for, and the existing RLS pattern already gives the exact guarantees needed (customer can't read another customer's ticket, customer can never read internal notes).

## Validation

`pnpm typecheck` clean after this phase.
