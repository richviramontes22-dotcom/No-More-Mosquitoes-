# Platform Growth Phase 2 — Pre-Build Audit
**Date:** 2026-06-17

## Routing

`route_automation_settings` (singleton, `enabled=false`/`mode='manual_only'` by default) and `routeAutomationPolicy.ts` currently cover **publish-stage** automation only: `evaluateRouteForAutoPublish()` + `autoPublishEligibleRoutes()` act on routes that already exist in `draft`/`approved` status — they never generate a route or invoke Smart Optimize themselves (a deliberate Phase 1 scope boundary, documented in last sprint's `ROUTING_AUTOMATION_POLICY_REPORT.md`). The actual generation logic lives in `adminRoutes.ts`'s `POST /routes/day/generate` handler (ZIP-grouping + nearest-neighbor), and Smart Optimize lives in `smartRoutingOptimizer.ts` + `POST /routes/optimize-preview` / `POST /routes/:id/reorder-stops`. All three are currently admin-button-triggered only — no scheduled job calls any of them. The `auto-publish-routes` Netlify function (every 15 min) only calls `autoPublishEligibleRoutes()`.

**Safe to automate now:** generation and Smart Optimize, gated behind new, independently-toggleable settings, both defaulting to off — extending the same scheduled sweep rather than adding a second job. **Still requires admin approval:** nothing changes about what "safe" means for publish — the four hard blockers (low confidence, mock geo, drive-cap exceeded, non-draft/approved status) stay exactly as strict.

## Referrals

`referralService.ts` has `updateReferralStatus()` (manual, admin-only, no Stripe/credit side effects) and `createReward()`/`updateRewardStatus()` (manual reward ledger, never auto-applied). There is currently **no detection logic at all** — an admin has to notice on their own that a referred lead converted. `referrals.lead_id` already links to `leads`, and `leads.converted_customer_id`/`subscription_id` exist on the `leads` table itself (set by nothing yet — confirmed in the Platform Growth Phase 1 audit, conversion detection was explicitly out of scope then).

**Safe to automate now:** a read-only *detection* pass that flags `referrals` rows as `conversion_candidate` when the underlying lead now has a `subscription_id`/`converted_customer_id` — this is pure observation, no money movement, no status that skips admin review. **Still requires admin approval:** marking a candidate `converted` for real, and creating any reward — both stay manual, exactly as Phase 1 left them.

## CRM

`leads`, `lead_followups`, `lead_assignments` are fully built (Phase 1 foundation). No changes needed — Phase 2's CRM "analytics" ask is read-only aggregation over what already exists (status counts, assignee counts, overdue follow-ups via `due_at < now() AND status = 'pending'`).

## Appointments / Reschedule

**Critical finding:** `server/routes/customerAppointments.ts`'s `POST /appointments/:id/reschedule` already lets a customer instantly reschedule into any open availability window — no admin step, immediate `scheduled_at` update, confirmation email sent. This is wired to `client/pages/dashboard/Appointments.tsx`'s existing `RescheduleDialog`. The newly-requested `appointment_reschedule_requests` table + admin approve/deny flow is **not a replacement** for this — building it as one would either gut working, shipped functionality or create two competing reschedule paths that confuse customers. **Decision:** the new request-based flow is added as a distinct, secondary option ("Request a different date" — for cases where the customer wants something outside what the open-availability picker offers, or simply wants a human to coordinate) — see `CUSTOMER_EXPERIENCE_PHASE1_REPORT.md`.

## Subscriptions / Payments

No changes needed for Phase 2 — referenced read-only by the new analytics surfaces (revenue/subscription counts already exist on `client/pages/admin/Revenue.tsx`; Phase 2 analytics targets referral/route/CRM specifically per spec, not duplicating Revenue.tsx).

## Email Notification System

Resend-backed, fully built: `emailTemplates.ts` (template builders), `notificationLogger.ts` (the dedup primitives `isDuplicateNotification(appointmentId, type)` / `isDuplicateProfileNotification` / `isDuplicateByPayload`), `reminderScheduler.ts` + `send-reminders.ts` (**24h and same-day reminders already exist and run daily at 7 AM UTC** — gated by the `ENABLE_REMINDER_EMAILS` env-var flag and `REMINDER_DRY_RUN`, not a DB-backed admin toggle). Service-completion emails already fire from `employeeAssignments.ts` when an assignment is marked `completed`.

**Safe to automate now:** a 2-hour reminder tier (new `notificationType`, same dedup pattern, same scheduler) and a review-request email fired from the exact same `completed`-status hook that already sends the completion email — both purely additive, both using `isDuplicateNotification()` to guarantee one send per appointment regardless of how many times the job/hook runs. **New requirement surfaced by this audit:** the existing reminder toggle is an env var, not an admin-UI setting — Phase 2 needs a real DB-backed settings row so an admin can flip it without a deploy, which the spec's "admin toggle" language implies anyway.

## Legal System

`legal_acceptance_settings.enforcement_enabled = false` (confirmed live in production via direct REST-API check in the prior session). Nothing in this sprint's scope touches `legal_*` tables, `AuthTabs.tsx`, or `RequireCustomer.tsx`'s legal-gate `useEffect` — verified clean in `LEGAL_SYSTEM_SAFETY_CHECK_REPORT.md`.

## Tables to Reuse

`route_automation_settings` (extend with new columns), `route_audit_log` (reuse as-is for all new automation decisions), `referrals`/`referral_codes` (extend `referrals.status` enum to include `conversion_candidate`), `leads`/`lead_followups`/`lead_assignments` (read-only for analytics), `notification_log` (reuse `isDuplicateNotification` for both new reminder tier and review requests), `appointments` (read for reschedule requests, written only on admin approval).

## New Tables/Settings Needed

| New | Purpose |
|---|---|
| `route_automation_settings` — 6 new columns | `auto_generate_enabled`, `auto_optimize_enabled`, `auto_generate_time`, `auto_generate_days`, `require_admin_review_before_publish`, `allow_full_auto_publish` |
| `referral_reward_settings` (new table, singleton) | `enabled`, reward-type/amount defaults per audience, `auto_create_rewards`, `require_admin_approval` |
| `appointment_reschedule_requests` (new table) | Customer-submitted requests, admin approve/deny |
| `customer_notification_settings` (new table, singleton) | `reminder_2h_enabled`, `review_request_enabled`, `review_link_url` — the DB-backed admin toggles the spec asks for |
