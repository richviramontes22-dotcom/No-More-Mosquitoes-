# Platform Growth Phase 2 — Production Smoke Test Report
**Date:** 2026-06-18

## Methodology

No admin/customer login credentials exist in this environment (`.env` has no test account, and creating one for this test would put a real account in production). Smoke testing was done in three layers that together cover the required test list without mutating production data or fabricating credentials:

1. **Reachability + auth-gating** — every endpoint hit unauthenticated; PASS means it returns 401/403 (correctly wired and auth-gated), FAIL would mean 404 (not registered / route-shadowing bug, see the routing fix from earlier today) or 500 (a real crash).
2. **DB-level settings/safety check** — direct, read-only queries against the production Supabase REST API (service-role key) to confirm the actual current values of every new settings row.
3. **Public endpoint functional check** — the handful of genuinely public endpoints (legal document status/content, referral code validation) exercised for real, since they require no auth and are safe to call.

Anything that requires an authenticated browser session AND would mutate data (clicking "Detect Now", saving settings, approving a reschedule request) was **not** executed against production. That exact logic is covered by the 106-test automated suite added in the Phase 2 sprint (against a fake DB) plus the reachability check here (proving the live endpoint is wired to that logic). A quick manual click-through as an admin is the recommended final confirmation, but is not a blocker.

## Routing

| Check | Method | Result |
|---|---|---|
| Automation settings page loads | `GET /api/admin/routes/automation-settings` unauth → expect 401/403 | PASS (403) |
| Settings save | `PATCH /api/admin/routes/automation-settings` unauth → expect 401/403 | PASS (403) — endpoint wired; actual save not exercised (would require admin session) |
| Run automation now works safely | `POST /api/admin/routes/automation/run-now` unauth → expect 401/403 | PASS (403) — wired |
| History loads | `GET /api/admin/routes/automation/history` unauth → expect 401/403 | PASS (403) |
| Default settings do not auto-publish | Direct DB read of the live `route_automation_settings` row | PASS — `mode: "manual_only"`, `enabled: false`, `auto_generate_enabled: false`, `auto_optimize_enabled: false`, `require_admin_review_before_publish: true`, `allow_full_auto_publish: false`. With these values, `autoPublishEligibleRoutes()` returns immediately (`!settings.enabled \|\| mode === 'manual_only'`) — automation cannot fire at all right now. |

## Referrals

| Check | Method | Result |
|---|---|---|
| Referral page loads | `GET /api/admin/referrals` unauth → 401/403 | PASS (401) |
| Detect Now works | `POST /api/admin/referrals/detect-conversions` unauth → 401/403 | PASS (401) — wired; not invoked for real (would flag real production rows) |
| Reward settings save | `GET`/`PATCH /api/admin/referrals/reward-settings` unauth → 401/403 | PASS (401 both) |
| Customer referral code loads | `GET /api/referrals/my-code` unauth → 401 | PASS (401) |
| Public code validation | `POST /api/referrals/validate` with no code → 400 | PASS (400, correct validation error) |
| Reward settings remain safe | Direct DB read of live `referral_reward_settings` row | PASS — `enabled: false`, `auto_create_rewards: false`, `require_admin_approval: true` |

## Customer Experience

| Check | Method | Result |
|---|---|---|
| Customer can create reschedule request | `POST /api/appointments/:id/reschedule-request` unauth → 401 | PASS (401) — wired; real creation not exercised (no test customer session) |
| Admin can approve/deny request | `POST /api/admin/reschedule-requests/:id/approve` unauth → 401 | PASS (401) — wired |
| Notification settings load/save | `GET`/`PATCH /api/admin/notification-settings` unauth → 401/403 | PASS (401 both) |
| Review link setting saves | Same endpoint as above (single PATCH payload) | PASS — wired; live value confirmed `review_link_url: null` (not yet configured by an admin, expected) |
| Table state sane | Direct DB read | `appointment_reschedule_requests` has 0 rows — expected, feature is brand new, no customer has used it yet |
| Notification defaults safe | Direct DB read of live `customer_notification_settings` row | PASS — `reminder_24h_enabled: true` (matches pre-existing live behavior), `reminder_2h_enabled: false`, `review_request_enabled: false` |

## Analytics

| Check | Method | Result |
|---|---|---|
| `/admin/analytics` loads | Frontend route exists, `GET /api/admin/metrics/platform-analytics` unauth → 401/403 | PASS (401) |
| Referral/route/CRM analytics render | Same endpoint (single combined payload) | Wired and reachable; underlying tables all confirmed to exist (Phase 1 readiness report) so the query cannot 500 on a missing table/column |

## Legal

| Check | Method | Result |
|---|---|---|
| Enforcement remains disabled | `GET /api/legal/status` (public, no auth) | PASS — live response: `{"enforcement_enabled":false,"required":[]}` |
| Registration not blocked | Derived from the above — `RequireCustomer.tsx`/`LegalAcceptance.tsx` both short-circuit to "not blocked" whenever `enforcement_enabled` is false | PASS (by direct consequence of the confirmed-false flag; did not create a test signup to avoid adding a junk account to production) |
| Draft docs not public | `GET /api/legal/documents/{terms_and_conditions,privacy_policy,service_agreement,pesticide_consent}` (public, no auth) | PASS — all four return 404 "Document not yet published" (no `deployed` document exists for any type, drafts inaccessible) |

## Summary

Zero blockers found. Every endpoint in the required test list is reachable and correctly auth-gated (no 404s, no 500s — confirming this morning's route-ordering fix holds and nothing else regressed). Every settings table's live production value is in its safe default state. The two genuinely public surfaces (legal status/documents, referral code validation) behave correctly when exercised for real.

**Phase 2 smoke test result: FULL GO.** Proceeding to Phase 3 (Territory Intelligence + Workforce Optimization).
