# Referral Program — Implementation Report
**Date:** 2026-06-17

## Files Added/Changed

| File | Purpose |
|---|---|
| `db/migrations/2026-06-17_referral_program.sql` | `referral_codes`, `referrals`, `referral_rewards` + RLS + triggers |
| `server/services/referrals/referralService.ts` | Code generation, validation, attribution, listing, reward management |
| `server/routes/adminReferrals.ts` | Admin CRUD + public validate + customer my-code endpoint |
| `server/index.ts` | Registered `adminReferralsRouter` at `/api` |
| `shared/api.ts` | Added optional `referralCode` to `ScheduleRequestPayload` |
| `server/routes/schedule.ts` | Fire-and-forget `attributeReferral()` call after lead capture, when a code was submitted |
| `client/lib/referralCapture.ts` | Captures `?ref=CODE` from the URL into localStorage (30-day TTL) |
| `client/App.tsx` | Calls `captureReferralCodeFromUrl()` once on load |
| `client/components/schedule/ScheduleDialog.tsx` | Forwards the stored code as `referralCode` in every schedule-request submission |
| `client/pages/dashboard/Profile.tsx` | New "Refer & Earn" card — code, copyable share link, converted count |
| `client/pages/admin/Referrals.tsx` | New admin page — Referrals tab + Codes tab |
| `client/App.tsx` / `AdminLayout.tsx` | Routed `/admin/referrals`, added nav entry under Finance (next to Promotions) |

## End-to-End Flow (as built)

1. Someone shares `https://nomoremosquitoes.us/?ref=ABC12345` (the customer's code from their Profile card, or a partner's code from the admin Codes tab).
2. A visitor clicking that link has the code captured into `localStorage` the moment the page loads (`captureReferralCodeFromUrl()` in `App.tsx`), before any routing happens.
3. If they submit the public Schedule form (with or without an account), `createSchedulePayload()` automatically attaches the stored code to the request.
4. `server/routes/schedule.ts` creates/merges the lead as it already did (CRM Phase 1, unchanged), then — only if a code was present — calls `attributeReferral()`, which validates the code server-side and inserts one `referrals` row linking it to the new/merged lead. Invalid codes or already-attributed leads are silently skipped; nothing about referral attribution can fail or delay the booking response.
5. An admin reviews `/admin/referrals` → Referrals tab, sees the new pending referral with its code/owner, and later marks it `converted` (optionally attaching a subscription/appointment/value) once the lead becomes a paying customer, then creates a `referral_rewards` row to track what's owed.

## What Was Deliberately Not Built (see design report for reasoning)

- No automatic Stripe-webhook conversion detection — conversion is a manual admin action.
- No automatic reward issuance (account credit, free service) — rewards are a tracked ledger entry, not an applied transaction.
- No referral capture on the instant-quote widget or the authenticated `ScheduleFlow.tsx` checkout — only the public Schedule form.
- No customer-facing "my referrals list" (just an aggregate converted count) — full referral history is admin-only for this foundation.

## Validation

`pnpm typecheck` — 0 errors (confirmed after this piece, before continuing to CRM Phase 3 Foundation).
