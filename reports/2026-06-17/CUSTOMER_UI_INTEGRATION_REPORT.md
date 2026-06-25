# Customer UI Integration Report
**Date:** 2026-06-17

## What Was Added

A single new "Refer & Earn" card on the existing customer Profile page (`client/pages/dashboard/Profile.tsx`), placed at the top of the sidebar (before the existing Security card). No new route, no new nav entry — the customer dashboard's structure is unchanged.

The card shows:
- **My referral code** — fetched from `GET /api/referrals/my-code`, which creates one on first call (so every customer has a code waiting for them the first time they open this page, with no separate "generate" step).
- **Copy share link** button — copies `https://<site>/?ref=<CODE>` to the clipboard.
- **Successful referrals count** — an aggregate number (e.g., "3 successful referrals so far"), not a detailed list. Full referral history (who, when, status) is admin-only for this foundation.

## What Was Deliberately Not Built

- No customer-facing list of individual referrals or their status — only the aggregate count.
- No reward balance/redemption UI — rewards are tracked and approved by admins; nothing for a customer to claim or apply themselves yet.
- No referral capture on any page except the public Schedule form (see `REFERRAL_IMPLEMENTATION_REPORT.md` for why this is the one chosen integration point).

## Verification

Confirmed by code path (no live browser test was run in this session):
- `client/lib/referralCapture.ts`'s `captureReferralCodeFromUrl()` is called once at module load in `App.tsx`, before routing — correctly positioned to catch a `?ref=` parameter on whatever page a referral link points to.
- `getStoredReferralCode()` is read inside `createSchedulePayload()` in `ScheduleDialog.tsx`, so every path that builds a schedule-request payload (the multi-step booking dialog and the inline `ScheduleFlow` form) picks it up automatically — there's only one payload-construction function, so there was no risk of missing a call site.
- The Profile card degrades gracefully: if the fetch fails (e.g. logged out, network error), it shows "Unable to load your referral code right now" rather than breaking the page.
