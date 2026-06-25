# Detractor Follow-up Automation Report

## What already existed (audited before changing anything)

`satisfactionService.ts`'s `handleDetractor()` already ran automatically whenever a detractor survey
(rating 0-6) was submitted: it created a support ticket, linked it back to the survey, and fired an admin
notification. The admin Satisfaction dashboard already showed an unresolved-detractor count via its
"Detractor Queue (N)" header (`detractors_pending.length`, filtered to `followup_required && !resolved_at`)
— this already satisfied "show unresolved detractor count" with no changes needed.

## What was actually missing, and what was added

The created ticket was never **assigned** and never given a **due date** — `tickets.assigned_to` and
`tickets.due_at` both already existed as columns, just unset by this code path. This was the entire gap
between "a ticket gets created" and "a customer-service follow-up task gets created":

1. **Assign to customer_service staff if available, else admin queue.** `handleDetractor()` now looks up an
   active `profiles` row with `role = 'customer_service'` (customer_service staff are profile-only, no
   `employees` table row — confirmed against `Dashboard.tsx`'s own comment on this) and sets
   `tickets.assigned_to` to it. With none found, `assigned_to` stays `null` — which *is* "the admin queue"
   in this codebase, since the same `notifyAdmin()` call that already fired is the only thing resembling an
   unassigned-ticket inbox today. No new queue concept was invented.
2. **Show due date.** `tickets.due_at` is now set to 48 hours from creation (a fixed SLA — not
   configurable, since nothing else in this codebase has asked for that yet). The admin notification's body
   text was extended to state who it's assigned to (or that it fell to the admin queue) and when it's due.
3. **Satisfaction dashboard UI** (`Satisfaction.tsx`) gained "Assigned To" and "Due" columns — previously
   absent entirely, even though the ticket's `assigned_to`/`due_at` existed once the backend change above
   landed. `getSatisfactionDashboard()` now enriches each pending detractor with its linked ticket's
   `due_at`/`assigned_to`/assignee name (a small additional query, not a rewrite of the existing NPS/count
   computation). An overdue due date renders in red with "(overdue)".

## No automatic customer contact — verified, not just assumed

`handleDetractor()` still only ever does two things: insert an internal `tickets` row and call
`notifyAdmin()` (an internal admin-facing notification, not a customer email/SMS). Confirmed by reading the
full function after the changes above — nothing was added that contacts the customer, and the existing
admin-only notification path was extended with more detail, not given a customer-facing counterpart.

## Verified live against real submitted surveys, both assignment branches

Submitted two real detractor surveys (rating 3 and rating 2) through the actual customer-facing
`POST /api/satisfaction/surveys` endpoint against real completed test appointments:

- **Before any customer_service profile existed**: the resulting ticket had `assigned_to: null`,
  `due_at` exactly 48 hours after creation — correctly fell into the admin-queue branch.
- **After creating one** (`role = 'customer_service'`): the next detractor's ticket had
  `assigned_to` set to that profile's id, confirmed by name (`assigned_to_name: "CS Agent"`) in the
  dashboard endpoint's response.
- The rendered Satisfaction page showed both rows correctly — one with "CS Agent" in the Assigned To
  column, one with the italicized "Admin queue" fallback, both with real due-date timestamps.
- All test tickets, surveys, appointments, and properties created for this verification were deleted
  afterward (these aren't covered by the existing `scripts/admin/cleanup-test-data.mjs`, which was scoped
  to route/appointment/employee test data in the prior sprint, not tickets/surveys — a gap worth knowing
  about, noted here rather than silently left for someone else to discover).

`pnpm typecheck` clean; `pnpm test` 216/216 — all 14 pre-existing `satisfactionService.spec.ts` tests still
pass unchanged, confirming the NPS/classification/duplicate-prevention behavior this phase didn't touch is
still intact.
