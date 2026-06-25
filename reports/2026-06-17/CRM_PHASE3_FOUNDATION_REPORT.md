# CRM Phase 3 Foundation — Implementation Report
**Date:** 2026-06-17
**Scope:** Lead assignment, follow-up tracking, lead ownership, referral attribution display. Explicitly *not* in scope (per sprint constraints and the CRM Phase 2 report's stated boundaries): SMS/call tracking, conversion-automation, tasks/reminders beyond simple due-dated follow-ups.

## Schema

`db/migrations/2026-06-17_crm_phase3_lead_assignment_followups.sql`:
- `leads.assigned_to` — new nullable FK to `profiles`, denormalized "current owner" cache (avoids a join on every Lead Inbox list render).
- `lead_assignments` — full assignment history (`lead_id`, `assigned_to`, `assigned_by`, `created_at`). Never overwritten — re-assigning a lead inserts a new row and updates the `leads.assigned_to` cache; the history stays intact for later audit.
- `lead_followups` — due-dated tasks (`due_at`, `status: pending|completed|skipped`, `notes`, `assigned_to`, `completed_at`). No reminder dispatch of any kind — due dates are surfaced in the admin UI only.

Both new tables use the exact RLS convention established by `lead_notes` (CRM Phase 2): admin-only `FOR ALL`.

## Backend

`server/services/leads/leadService.ts` — additive only, no existing function signatures changed:
- `LeadActivityType` extended with `lead_assigned`, `followup_created`, `followup_completed`, `followup_skipped`.
- `Lead` interface gained `assigned_to`; `LeadDetail` gained `followups: LeadFollowUp[]` and `linked.referral`.
- New functions: `assignLead()`, `createFollowUp()`, `updateFollowUpStatus()`, `listFollowUps()`.
- `getLead()` now also fetches the lead's follow-ups and, if one exists, its `referrals` row (joined with `referral_codes` for the code/owner display) — this is how a referred lead's origin becomes visible on the admin detail page.

`server/routes/adminLeads.ts` — new endpoints, all `requireAdmin`-gated:
- `GET /leads/staff` — lists `profiles` with `role IN ('admin','employee')`, the assignable-staff list (note: this is **not** the `employees` table, which has its own primary key distinct from `profiles.id` — using it would have produced an FK mismatch against `lead_assignments.assigned_to`).
- `GET /leads/followups` — cross-lead follow-up list (filterable by status/assignee/due date) for a future "my follow-ups" view.
- `POST /leads/:id/assign`, `POST /leads/:id/followups`, `PATCH /leads/followups/:followupId`.

**Route-ordering note:** `GET /leads/staff` and `GET /leads/followups` had to be registered *before* `GET /leads/:id` — Express matches routes in registration order, and `:id` would otherwise greedily capture the literal segments `staff`/`followups` as a lead ID. Caught and fixed during implementation, not left as a latent bug.

## Test Suite Impact

One existing assertion in `leadService.spec.ts` did an exact `.toEqual()` check on `getLead()`'s `linked` object. Adding `linked.referral` to the shape would have failed that specific assertion — updated it (and added a `followups: []` check) to match the intentionally-extended shape. This is the same kind of test maintenance CRM Phase 2 did when it extended `STATUS_RANK`; no other test was touched, and all 68 tests (now including this updated one) pass.

## Admin UI

- `client/pages/admin/LeadDetail.tsx`: new "Assign Lead" card (dropdown of staff), new "Follow-ups" section (list with complete/skip buttons + a create form: due date, optional assignee, optional notes), a referral badge in the summary header when the lead has an attributed `referrals` row, and an "Assigned to" badge.
- `client/pages/admin/Leads.tsx`: new "Assigned" column in the Lead Inbox table, showing the current assignee's name (or "—").
- `client/hooks/admin/useAdminLeads.ts`: extended types + `useAdminLeadStaff()` hook + `assignLeadTo()`/`postLeadFollowUp()`/`patchFollowUpStatus()` mutation helpers.

## Validation

`pnpm typecheck` — 0 errors, confirmed after this piece.
