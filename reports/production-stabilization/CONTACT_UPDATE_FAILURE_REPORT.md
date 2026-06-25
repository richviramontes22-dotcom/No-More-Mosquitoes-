# Contact Update Failure Report

## Root cause

**Wrong column name — not RLS, not auth, not stale form state.** `client/pages/dashboard/Profile.tsx`'s
`handleSave()` sent `{ name, email, phone, updated_at: new Date().toISOString() }` to
`supabase.from("profiles").update(...)`. The `profiles` table has **no `updated_at` column** (confirmed
directly against the live schema — only `created_at` exists). PostgREST validates every column in an update
payload before applying any of it; one invalid column fails the *entire* request, so the otherwise-valid
`name`/`email`/`phone` fields never got written either.

## Reproduction (live, not simulated)

1. Created a fresh `@test.com` account via the dev-only `/api/dev/create-test-account` endpoint.
2. Signed in as that account, obtained a real user JWT.
3. Issued the exact PATCH request the browser would issue (anon key + user JWT, the same payload shape as
   the pre-fix code).
4. Got back **`400 PGRST204: Could not find the 'updated_at' column of 'profiles' in the schema cache`** —
   reproduced the user-reported failure exactly, with a precise error message identifying the cause.

## Other call sites checked

Every other `profiles` update call site in the codebase was checked for the same pattern
(`ScheduleFlow.tsx` x3, `billingStripe.ts`, `webhooksStripe.ts`) — none of them include `updated_at`. The
bug was isolated to this single call site in `Profile.tsx`.

## Fix

`client/pages/dashboard/Profile.tsx` — removed `updated_at: new Date().toISOString()` from the update
payload. `name`, `email`, and `phone` are unaffected; `created_at` is set once at row-creation time and was
never meant to be touched by this update.

## Verification (live, not simulated)

Re-ran the identical PATCH request against the live database with the corrected payload (no `updated_at`
field): **`200 OK`**, response body confirms `name`, `email`, and `phone` all updated to the new values.

## Before / after

| | Before | After |
|---|---|---|
| Request | `{ name, email, phone, updated_at }` | `{ name, email, phone }` |
| Result | `400 PGRST204` — entire update rejected | `200 OK` — all three fields saved |
| User-visible behavior | "Update failed" toast, every time, for every customer | "Profile updated" toast, contact info actually saved |

This was a **100% reproduction rate** bug — every customer attempting to update their contact info would
have hit this, not an intermittent or conditional failure.
