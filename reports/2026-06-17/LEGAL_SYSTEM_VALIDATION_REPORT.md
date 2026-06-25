# Legal System — Validation Report
**Date:** 2026-06-17

## Commands Run

| Command | Result |
|---|---|
| `pnpm typecheck` | ✅ Pass — 0 errors (run repeatedly after each phase: schema, admin page, registration gate, re-acceptance gate, public pages — never broke) |
| `pnpm test` | ✅ Pass — 8 test files, 72 tests, 0 failures (68 pre-existing + 4 new in `client/lib/legalGate.spec.ts`) |
| `pnpm build` | ✅ Pass — client + server, same pre-existing chunk-size/dynamic-import warnings, no new errors |

## Automated Tests Added

`client/lib/legalGate.spec.ts` covers the one piece of this system's logic that's pure and unit-testable without a database or DOM: `diffRequiredAgainstAccepted()`, the function both the signup gate and the re-acceptance gate rely on to decide "does this customer need to accept anything right now":

- All required documents flagged missing when nothing has been accepted.
- Nothing flagged missing when every required document is accepted at the current version.
- A document flagged missing when its accepted version is older than what's currently deployed (the re-acceptance case).
- Empty input → empty output (the "enforcement effectively off" / no required documents case).

The localStorage-backed pending-payload helpers (`savePendingLegalAcceptance`/`getPendingLegalAcceptance`/`clearPendingLegalAcceptance`) were **not** unit tested — this project's `vitest.config.ts` runs tests in Node's default environment with no `jsdom`, so `localStorage` isn't available in the test runner. This is consistent with the two pre-existing, structurally identical localStorage helpers in this codebase (`client/lib/pendingOnboarding.ts`, `client/lib/referralCapture.ts`), neither of which has unit tests for the same reason — not a new gap introduced by this sprint.

The remaining scenarios from the original task list (enforcement disabled allows normal registration; enforcement enabled blocks without acceptance; enforcement cannot enable without deployed required docs; deployed docs visible publicly / drafts not; upload creates new draft version; deploy approved document; acceptance records save document version) are all **server-side, RLS-dependent, and Supabase-Storage-dependent** behaviors with no existing test harness in this codebase to exercise them against a real or faked Postgres instance (the one DB-backed test file in this repo, `leadService.spec.ts`, uses a hand-built in-memory fake Supabase client scoped specifically to `leadService.ts`'s query patterns — extending that fake to cover three more tables, RLS-equivalent logic, and Storage bucket behavior was out of scope for this sprint). These were instead verified by **code-path review**, documented below.

## Functional Checks (by code path)

| Scenario | Verification |
|---|---|
| Enforcement disabled → normal registration | `fetchLegalStatus()` fails safe to `{enforcement_enabled: false}` on any error; `AuthTabs.tsx`'s `legalEnforced` is `false` in that case, so the original checkbox/validation/submit path runs completely unchanged — confirmed by reading the conditional render and `invalidSignupReason` logic, which falls through to the pre-existing `termsAccepted` branch. |
| Enforcement enabled → blocks without acceptance | `invalidSignupReason` returns a blocking message whenever `legalEnforced && !allLegalChecked`; the "Create Account" button is `disabled` on that same condition (existing pattern, just re-pointed at the new check). |
| Cannot enable without deployed required docs | `PATCH /api/admin/legal/settings` computes `missing` document types server-side before accepting `enforcement_enabled: true`, returns `400` with the specific list if any required type lacks a `deployed` row — confirmed by reading the handler; there is no other code path that can set this flag. |
| Deployed docs visible publicly / drafts not | `GET /api/legal/documents/:type` hard-codes `.eq("status", "deployed")` in its query — no parameter or header can make it return a non-deployed row. |
| Upload creates new draft version | `POST /api/admin/legal/documents` always `.insert()`s; there is no update-in-place code path for creating a "replacement" — confirmed no PUT/PATCH-based upload route exists. |
| Deploy approved document | `POST /api/admin/legal/documents/:id/deploy` checks `status === 'approved'` before proceeding, archives the prior deployed row of the same type, then sets the target to `deployed` — confirmed by reading the handler. |
| Acceptance records store document version | `POST /api/legal/acceptances` inserts `document_version` directly from the request body (which both call sites — `AuthTabs.tsx` and `LegalAcceptance.tsx` — populate from `RequiredLegalDocument.version`, i.e. the live deployed version at read time, not a hardcoded value). |
| Re-acceptance required after deployed version changes | `diffRequiredAgainstAccepted()` compares `document_version` exactly (unit-tested above) — deploying a new version naturally makes every existing acceptance for that type "stale" on the next dashboard load, with no separate detection job needed. |

## Regression Checks

| Area | Result |
|---|---|
| `client/contexts/AuthContext.tsx` | ✅ Not modified — `signUp()` signature and behavior unchanged |
| Existing `/terms`, `/privacy`, `/guarantee`, `/licenses` static pages | ✅ Not modified |
| Existing `/admin/legal-compliance` (employee onboarding compliance) | ✅ Not modified — confirmed separate route, separate tables, separate nav entry |
| Routing automation / referrals / CRM Phase 3 (this week's prior sprints) | ✅ Not touched by this sprint |
| Stripe billing, promo codes, service areas | ✅ Not touched |
