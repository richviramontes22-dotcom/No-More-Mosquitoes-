# Referral Automation Phase 2 — Implementation Report
**Date:** 2026-06-18

## What Was Built

| Piece | File |
|---|---|
| Schema | `db/migrations/2026-06-18_referral_automation_phase2.sql` — `referrals.status` gains `conversion_candidate`; new `referral_reward_settings` table |
| Detection service | `server/services/referrals/referralService.ts` — `detectConversionCandidates()`, `approveConversion()`, `rejectConversion()`, `getRewardSettings()`/`updateRewardSettings()` |
| Admin API | `server/routes/adminReferrals.ts` — `POST /admin/referrals/detect-conversions`, `POST /admin/referrals/:id/approve-conversion`, `POST /admin/referrals/:id/reject-conversion`, `GET`/`PATCH /admin/referrals/reward-settings` |
| Admin UI | `client/pages/admin/Referrals.tsx` — new "Conversion Review" tab (Detect Now button + approve/reject queue), new "Reward Settings" tab |

## Conversion Detection — How It Works

`detectConversionCandidates()` is read-only with respect to business state: it queries `referrals` where `status = 'pending'` and `lead_id IS NOT NULL`, joins to `leads`, and flags any referral whose lead now has `subscription_id` or `converted_customer_id` set, by moving its status to `conversion_candidate`. That's the entire effect — no reward is created, no Stripe call is made, and `converted` is never set automatically.

This runs only when an admin clicks **Detect Now** in the new Conversion Review tab. No scheduled job was added for this — running it on every routing automation sweep would conflate two unrelated systems, and a manual trigger is a complete, safe way to satisfy "service that flags conversion candidates" without growing the scheduled-function footprint. (A daily cron is a reasonable later addition if admins find clicking the button tedious — flagged as a natural next step, not built here.)

## Admin Review Queue

The Conversion Review tab lists every `conversion_candidate` referral with **Approve** / **Reject** actions:
- **Approve** → `approveConversion()` sets `status = 'converted'`. If (and only if) `referral_reward_settings.enabled` AND `auto_create_rewards` are both true, it additionally inserts one reward row via the existing `createReward()` with `status: 'pending'` — using the customer/partner reward type+amount from settings depending on the referral code's `owner_type`. That reward still must be approved and issued manually from the existing Rewards tab (`updateRewardStatus`) — this sprint does not change that workflow at all.
- **Reject** → `rejectConversion()` sets `status = 'invalid'`. No reward, no further action.

## Reward Settings — Defaults and Guarantees

`referral_reward_settings` is a singleton table, seeded disabled:

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `false` | Master switch for all reward automation |
| `auto_create_rewards` | `false` | Whether Approve also creates a pending reward row |
| `require_admin_approval` | `true` | Documents that issuance is a separate manual step (enforced today by the existing `updateRewardStatus` admin-only endpoint, unchanged) |
| `customer_reward_type` / `partner_reward_type` | `account_credit` / `manual_reward` | What kind of reward to pre-fill if auto-create fires |
| `*_amount_cents` | `NULL` | No amount until an admin sets one |

**Guarantee, unconditionally true regardless of any of these settings:** no code path in this sprint calls Stripe, mutates a customer's account balance, or sets a reward to `issued`/`approved`. The only possible automated effect of `auto_create_rewards=true` is inserting a single row with `status: 'pending'` into `referral_rewards` — the same table and same status a manual "Create Reward" click already produces today. Verified by reading `createReward()` (unchanged) and confirming it does not call any payment/credit code.

## Validation

`pnpm typecheck` and `pnpm test` (72/72) pass after this phase's changes.
