# Customer Satisfaction / NPS — Implementation Report
**Date:** 2026-06-19

## What Was Built

| Piece | File |
|---|---|
| Migration | `db/migrations/2026-06-19_customer_satisfaction_nps.sql` — `customer_satisfaction_surveys` + classification trigger |
| Service | `server/services/satisfaction/satisfactionService.ts` — `submitSurvey()`, `resolveSatisfactionIssue()`, `getSatisfactionDashboard()` |
| Customer API | `server/routes/satisfaction.ts` — `GET/POST /api/satisfaction/surveys*` |
| Admin API | Same file — `GET /api/admin/satisfaction/dashboard`, `POST /api/admin/satisfaction/:id/resolve` |
| Role middleware | `server/middleware/requireRole.ts` — new `requireCustomerService`/`requireSales`, used here for the first time |
| Customer UI | `client/components/dashboard/SatisfactionPrompt.tsx`, embedded in `client/pages/dashboard/Appointments.tsx`'s Past Visits table |
| Admin UI | `client/pages/admin/Satisfaction.tsx` — `/admin/satisfaction` |

## Classification Is Server-Enforced, Not Client-Trusted

The DB trigger `classify_satisfaction_survey()` computes `satisfaction_type` from `rating` on every insert/update, overwriting whatever the caller sent. A client (or a bug in the API layer) cannot submit `rating: 3, satisfaction_type: 'promoter'` — the trigger fires after the row values are set but before they're persisted, so the stored value is always correct: 9-10 → promoter, 7-8 → passive, 0-6 → detractor. This was a deliberate choice over computing the classification in the Express route, specifically so it can never drift even if a future code path inserts a row a different way.

## One Survey Per Appointment

Enforced at the DB level via `UNIQUE (appointment_id)`, not just app logic. `submitSurvey()` catches Postgres error code `23505` (unique violation) and returns a clean `{ error: "already_submitted" }` rather than a raw DB error; the route turns that into `409 Conflict`. The customer-facing component also checks `GET /api/satisfaction/surveys/:appointmentId` on mount and shows a "Rating submitted" state instead of the form if one already exists, so the common case never even reaches the conflict path.

## Detractor Handling

On insert, if `satisfaction_type === 'detractor'`, `handleDetractor()` fires (fire-and-forget, matching the established pattern for non-blocking side effects elsewhere in this codebase):
1. `notifyAdmin()` — a new event type, `satisfaction.detractor_reported`, `severity: 'warning'`, with the rating and comment.
2. A `tickets` row is created automatically — `category: 'service_quality'`, `priority: 'high'`, `status: 'open'` — and linked back via `customer_satisfaction_surveys.ticket_id`. This directly reuses the ticketing system hardened in this same sprint rather than building a separate escalation path.

Promoters and passives never create an alert or a ticket — confirmed by code inspection (the `if (survey.satisfaction_type === "detractor")` guard is the only call site for `handleDetractor`).

**Scope note on "optionally creates a support ticket":** implemented as *always* creating one for detractors, not gated behind a new settings toggle. A foundation-level feature doesn't need a configurable on/off switch for its core safety behavior, and adding one would be exactly the kind of unrequested complexity the project's conventions ask to avoid. If the business wants this toggleable later, it's a small, well-scoped follow-up.

## NPS Calculation

Standard formula: `(% promoters − % detractors)`, returned as an integer. Returns `null` (not `0`) when there are zero responses — the admin UI renders this as "—" with a "(no data yet)" label, since a 0 score would otherwise look like a measured neutral result rather than "nothing to measure."

## Customer Experience

A "Rate This Service" button appears on every **completed** past visit in the dashboard (`client/pages/dashboard/Appointments.tsx`'s Past Visits table, new "Feedback" column) — chosen over an email per the spec's either/or framing ("survey email **or** dashboard prompt"), since the dashboard prompt requires no new email template, notification type, or scheduled job, and the appointment list is somewhere a just-serviced customer is already likely to check. The rating dialog is a simple 0-10 scale plus an optional comment. After submission, the button is replaced with a quiet confirmation state — "Thanks for the great rating!" for promoters, "Rating submitted" otherwise. No separate review-request CTA/link was added here: the existing Platform Growth Phase 2 review-request email (sent on service completion, with the admin-configured review link) already covers that delivery path, and duplicating it here would risk sending two different review prompts through two different channels.

## Admin Dashboard (`/admin/satisfaction`)

Four stat cards (NPS score, promoter/passive/detractor counts) and a Detractor Queue table (rating, comment, issue category, linked ticket, "Mark Resolved" action). "Mark Resolved" calls the resolve endpoint, which sets `resolved_at`/`resolved_by` — it does not touch `followup_required` (which remains a historical "this was a detractor needing follow-up" marker) or the linked ticket's status (closing the ticket, if desired, is a separate, explicit action in the Tickets page — resolving the satisfaction record and closing the ticket are deliberately not coupled, since staff may resolve one before the other).

## Validation

`pnpm typecheck` clean after this phase.
