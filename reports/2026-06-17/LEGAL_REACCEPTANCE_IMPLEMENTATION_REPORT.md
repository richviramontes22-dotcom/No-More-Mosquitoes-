# Legal Re-Acceptance — Implementation Report
**Date:** 2026-06-17

## Design: One Mechanism, Two Triggers

Phase 6 (signup-time pending acceptance) and Phase 7 (re-acceptance after a document version changes) are **the same code path** at the dashboard-entry checkpoint, not two separate features. Both situations reduce to the identical question: *"does this customer have an acceptance record matching every currently-required, currently-deployed document version?"* — the only difference is *why* the answer is no (never written yet, vs. superseded by a new deployed version). Building one mechanism that answers that question, and reusing it for both triggers, avoids maintaining two parallel "is the customer compliant" checks that could drift out of sync.

## Where It Runs

`client/components/auth/RequireCustomer.tsx` — the existing guard for every `/dashboard/*` route. A `useEffect` runs once enforcement is confirmed enabled (skipped entirely, with zero extra fetches, when `enforcement_enabled: false`):

1. `fetchLegalStatus()` — if disabled or no required documents, done; render the dashboard.
2. `fetchMyAcceptances()` — the customer's own most-recent acceptance per document type.
3. `diffRequiredAgainstAccepted()` — compares `version` field-for-field; any required document where the customer's stored `document_version` doesn't match the currently-deployed `version` (or has no record at all) counts as missing.
4. If anything is missing: `<Navigate to="/legal-acceptance" state={{ from: location.pathname }} />` — the dashboard route never renders its children.

`/legal-acceptance` (`client/pages/LegalAcceptance.tsx`) re-runs the same `fetchLegalStatus` + `fetchMyAcceptances` + diff on its own mount (defensive — it doesn't trust that the redirect's reasoning is still accurate by the time it loads), then:

- **Tries the pending-payload shortcut first**: if `localStorage` holds a signup-time payload that covers every currently-missing document at the exact currently-deployed version, it submits that automatically and redirects straight through — the customer never sees a screen, because they already agreed seconds/minutes ago at signup. This only fires when the payload's versions still match what's deployed *right now* — if an admin deployed yet another new version in between, the pending payload's stale version no longer "covers" the requirement, and the path falls through to the explicit screen instead.
- **Otherwise shows the checklist** (`LegalDocumentChecklist`, same component used at signup) for whatever is still missing, with "Accept & Continue" disabled until every box is checked.
- **On write failure**: the error is shown inline, the customer stays on this screen, and "Accept & Continue" remains available to retry — `/dashboard` is never reached without a successful, confirmed acceptance write. This directly satisfies "if acceptance write fails, block onboarding access and require retry."

## Why an Outdated Version Counts as "Missing," Not Just a Missing Record

`diffRequiredAgainstAccepted()` compares `document_version` exactly, not just presence of *any* acceptance for that `document_type`. So when an admin deploys a new version of, say, the Pesticide Consent document (old version archived, new one deployed per the admin page's deploy logic), every customer whose stored acceptance still says the old version is immediately treated as needing re-acceptance the next time they load the dashboard — there's no separate "did the version change" detection job or cron needed; it falls out naturally from the comparison running on every dashboard load.

## Dormant When Disabled

With `enforcement_enabled: false` (the default), `RequireCustomer`'s effect short-circuits on `fetchLegalStatus()`'s first response and never calls `fetchMyAcceptances()` — zero added network calls, zero behavioral change versus before this sprint, exactly as the instructions require ("If enforcement_enabled = false: do nothing").

## Files Changed

| File | Change |
|---|---|
| `client/pages/LegalAcceptance.tsx` (new) | The re-acceptance/acceptance screen |
| `client/components/auth/RequireCustomer.tsx` | Added the legal-gate `useEffect` + redirect, ahead of the existing `is_onboarded` redirect check |
| `client/App.tsx` | Routed `/legal-acceptance` under `CheckoutLayout` + `RequireAuth` only (deliberately *not* `RequireCustomer`, which would redirect back here and loop) |
