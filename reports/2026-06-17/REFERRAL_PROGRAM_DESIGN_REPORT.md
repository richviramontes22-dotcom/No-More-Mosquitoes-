# Referral Program — Design Report
**Date:** 2026-06-17

## Schema

```
referral_codes        — one row per code, owned by either a customer or a partner
referrals              — one row per attribution event (a lead that came in via a code)
referral_rewards       — one row per reward owed/issued for a referral
```

`referral_codes`: `owner_type ('customer'|'partner')`, `customer_id` (FK `profiles`, required when `owner_type='customer'`), `partner_name`/`partner_type`/`partner_contact_email`/`partner_contact_phone` (required when `owner_type='partner'`), `active`. A DB-level CHECK enforces the owner-type shape (can't have a customer code with no customer, or vice versa). A unique partial index guarantees one active referral code per customer — customers don't accumulate multiple codes.

`referrals`: `referral_code_id` (FK), `lead_id` (FK `leads`, nullable), `referred_customer_id` (FK `profiles`, nullable, set once the referred person becomes an account holder), `appointment_id` / `subscription_id` (FK, nullable, set on manual conversion), `conversion_value_cents`, `status ('pending'|'converted'|'rewarded'|'invalid')`. A unique partial index (`lead_id` where not null) prevents the same lead being attributed to two different referral codes.

`referral_rewards`: `referral_id` (FK), `reward_type ('account_credit'|'service_credit'|'free_service'|'manual_reward')`, `amount_cents`, `status ('pending'|'approved'|'issued'|'denied')`, `approved_by` (FK `profiles`).

## Scope Decisions (read before assuming more was automated)

**`quote_id` → `lead_id`.** The spec's tracking list names `quote_id`, but this codebase has no persistent "quote" entity — an instant quote is a stateless calculation (`/api/parcel`), and the *persistent* record of that attempt is the `leads` row itself (this is also why CRM Phase 1 dedups leads by address/email/phone rather than by a quote ID). `referrals.lead_id` is the correct, already-existing FK for this — using it instead of fabricating a `quotes` table that doesn't otherwise exist.

**Conversion is a manual admin action, not an automatic Stripe-webhook hook.** A referral's `status` only moves to `converted`/`rewarded` when an admin explicitly does so from the admin Referrals page (optionally attaching the resulting `appointment_id`/`subscription_id`/`conversion_value_cents`). This sprint does **not** add any code to `server/routes/webhooksStripe.ts` — automatically detecting "this Stripe subscription resulted from referral X" would require correlating subscription creation back to a lead/profile through several hops and touching the billing webhook path, which carries real regression risk to a system explicitly called out as "do not break." Manual conversion marking is the safe foundation; automatic detection is a reasonable Phase 2 enhancement once this foundation is proven.

**Reward issuance is recorded, not executed.** Creating a `referral_rewards` row (e.g., "$25 account credit, pending") does not itself touch Stripe, apply a balance, or send anything — it's a ledger entry an admin manages manually (mark `approved` → `issued`), exactly like the spec's "manual_reward" type implies should always be available, applied here as the *only* implemented path for this foundation. The other three `reward_type` values exist as a vocabulary for future automation but carry no automatic behavior yet.

**One capture point: the public Schedule form.** A referred visitor's code is captured from a `?ref=CODE` URL parameter (stored client-side, mirroring the existing `pendingOnboarding.ts` localStorage pattern) and forwarded only through the schedule-request submission (`server/routes/schedule.ts`), the same endpoint that already creates/merges `leads` rows via CRM Phase 1's `upsertLeadFromScheduleRequest`. The instant-quote widget and the authenticated `ScheduleFlow.tsx` checkout are **not** wired to capture referral codes in this sprint — adding it to every lead-capture surface multiplies the touched-file count and risk for a foundation phase; the schedule-request form is the highest-signal, lowest-risk single integration point (it's where `leads`, `profiles`, and `appointments` already converge).

## RLS

All three tables: admin-only `FOR ALL`, matching the `lead_notes`/`promo_codes` convention. `referral_codes` additionally has a public `SELECT` policy for `active = true` rows — needed so the public `/api/referrals/validate` endpoint (used to confirm a code before attribution, no auth required, mirrors `/api/promos/validate`) keeps working in any environment where `SUPABASE_SERVICE_ROLE_KEY` isn't configured and the server falls back to the anon client. `referrals`/`referral_rewards` have no public policy — there is no unauthenticated read need for them.

## API Surface

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/referrals/validate` | none | Confirms a code exists/is active before the client stores it for attribution |
| `GET /api/referrals/my-code` | customer (JWT) | Returns the caller's referral code (creating one on first call) + their successful-referral count |
| `GET /api/admin/referrals/codes` | admin | List all codes (customer + partner) |
| `POST /api/admin/referrals/codes` | admin | Create a partner code |
| `PATCH /api/admin/referrals/codes/:id` | admin | Toggle active, edit partner details |
| `GET /api/admin/referrals` | admin | List referrals with status/code filters |
| `PATCH /api/admin/referrals/:id` | admin | Update status, attach appointment/subscription/conversion value |
| `POST /api/admin/referrals/:id/rewards` | admin | Create a reward record |
| `PATCH /api/admin/referrals/rewards/:id` | admin | Update reward status (approve/issue/deny) |

## UI

- **Admin**: new `/admin/referrals` page (routed + nav entry under the existing Billing group, next to "Promotions") — codes table, referrals table with status, reward management.
- **Customer**: a "Refer & Earn" card added to the existing `dashboard/Profile.tsx` page (no new nav entry) — shows the customer's code, a copyable share link, and how many referrals have converted.
