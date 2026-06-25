# Legal Acceptance Gate — Implementation Report
**Date:** 2026-06-17

## The Core Timing Problem (and why it shapes this design)

`client/contexts/AuthContext.tsx`'s `signUp()` calls `supabase.auth.signUp()`, and this Supabase project requires **email confirmation** for normal signups (confirmed by the existing success copy: "Check your inbox to confirm your email, then sign in"). That means for the overwhelming majority of signups, **there is no active session immediately after `signUp()` resolves** — `data.user` exists, but `auth.uid()` is null until the customer clicks the confirmation link and logs in. Any database write gated by `profile_id = auth.uid()` (which `customer_legal_acceptances`'s INSERT policy is) cannot happen synchronously at signup time for these users.

The design accounts for this directly rather than working around it:

1. **At signup**, the customer's checked boxes are captured as intent and saved to `localStorage` (`savePendingLegalAcceptance()`), then a best-effort immediate write is attempted (`submitAcceptances()`). This immediate write only succeeds for the dev `@test.com` fast path or if email confirmation happens to be disabled — for the normal case it silently fails (expected, not an error condition) and the pending payload is what's left to work with.
2. **At first authenticated dashboard load** (after the customer has actually confirmed their email and logged in — guaranteed to have a real session by this point), the SAME pending payload is read back and submitted for real. This checkpoint is `client/components/auth/RequireCustomer.tsx`, and it's the exact same mechanism Phase 7 needs anyway for re-acceptance — see `LEGAL_REACCEPTANCE_IMPLEMENTATION_REPORT.md`.

## Default Behavior (enforcement disabled) — Verified Unchanged

`client/components/auth/AuthTabs.tsx` fetches `/api/legal/status` once on mount via `fetchLegalStatus()`, which is built to **fail safe to "disabled"**: any network error, non-200 response, or the (default) `enforcement_enabled: false` row all resolve to `{ enforcement_enabled: false, required: [] }`. The signup form's `legalEnforced` flag is computed from this and is `false` in every one of those cases — meaning:
- The original single "I agree to Terms… and Privacy Policy" checkbox renders exactly as before.
- `invalidSignupReason`'s validation falls through to the original `if (!termsAccepted) return "..."` branch.
- No fetch to `/api/legal/my-acceptances`, no pending-payload save, no acceptance-write attempt — none of the new code paths execute at all.

This was the explicit, repeatedly-stated constraint, so it's verified here rather than just asserted: **registration behaves identically to before this sprint unless an admin has both deployed the required documents and flipped the enforcement toggle.**

## When Enforcement Is Enabled

- The single checkbox is replaced by `<LegalDocumentChecklist>` (shared component, also used by the re-acceptance screen) — one checkbox per currently-required, currently-deployed document, each linking to its public `/legal/:type` page so the customer can actually read it.
- "Create Account" stays disabled (via `invalidSignupReason`) until every required box is checked.
- On submit, the checked document IDs/versions are what gets saved as the pending payload and (best-effort) submitted — not a generic "yes I agree," but the specific document IDs and versions the customer saw at that moment, which is what `customer_legal_acceptances.document_version` needs to be meaningful for future re-acceptance comparisons.

## Files Changed

| File | Change |
|---|---|
| `client/lib/legalGate.ts` (new) | `fetchLegalStatus()`, `fetchMyAcceptances()`, `submitAcceptances()`, `diffRequiredAgainstAccepted()`, pending-payload localStorage helpers |
| `client/components/legal/LegalDocumentChecklist.tsx` (new) | Shared checkbox-list UI |
| `client/components/auth/AuthTabs.tsx` | Conditional rendering + validation + pending-payload capture, all gated on `legalEnforced` |
| `server/routes/adminLegal.ts` | `GET /legal/status` (public), `POST /legal/acceptances` (authenticated) |

`client/contexts/AuthContext.tsx`'s `signUp()` was **not** modified — its signature and behavior are completely unchanged. All new logic lives in the caller (`AuthTabs.tsx`), wrapped around the existing call, which keeps the blast radius of this change to one component instead of touching the shared auth context every other auth-consuming component depends on.
