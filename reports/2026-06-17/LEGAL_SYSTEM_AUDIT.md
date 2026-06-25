# Legal Document Management System — Pre-Build Audit
**Date:** 2026-06-17

## Where is account creation initiated?

Entirely client-side, in `client/contexts/AuthContext.tsx`'s `signUp()` function, called from the single shared `client/components/auth/AuthTabs.tsx` component (used by both `/login` and the signup tab — there is no separate registration page or server-side registration endpoint for production traffic). The flow:

1. `supabase.auth.signUp({ email, password, options: { data: {...} } })` — creates the `auth.users` row. **Email confirmation is required** for normal signups (confirmed by the existing success toast: "Check your inbox to confirm your email, then sign in") — meaning `signUp()` resolves with `data.user` set but **no active session** until the user clicks the confirmation link. This is the critical timing constraint for Phase 6.
2. A DB trigger, `handle_new_user()` (`db/migrations/2026-05-29_ensure_profile_trigger.sql`, `SECURITY DEFINER`, bypasses RLS), fires on the `auth.users` INSERT and creates the `profiles` row server-side, before the client ever regains control.
3. The client then makes a best-effort `supabase.from("profiles").insert(...)` call of its own, wrapped in try/catch ("Profile creation skipped or failed") — this is expected to often fail (duplicate key against the trigger's row, or blocked by RLS since there's no session yet) and is **not** the real profile-creation mechanism; the trigger is.
4. There is also a dev-only `@test.com` fast path that bypasses `signUp()`'s email entirely via `/api/dev/create-test-account` (server-side, immediate session) — out of scope for the production gate but must not be broken.

**There is no `profile_id` available with an active session at the moment `signUp()` returns for a normal (non-test) signup.** Any acceptance-record write that depends on `auth.uid()` (via RLS) cannot happen synchronously after signup — it must happen later, when the user actually has a session (i.e., after they confirm their email and log in).

## Where can the acceptance gate be inserted safely?

Two insertion points, matching the two distinct moments the spec describes:

1. **At signup (`AuthTabs.tsx`)** — before calling `signUp()`, when enforcement is enabled: show the required-document checklist (replacing/extending the existing single "I agree to Terms… and Privacy Policy" checkbox already in the form), and disable "Create Account" until all required boxes are checked. The *intent* to accept (which document IDs/versions were checked) is captured here, but — per the timing constraint above — cannot always be durably written to `customer_legal_acceptances` yet.
2. **At first authenticated dashboard load (`client/components/auth/RequireCustomer.tsx`)** — this guard already runs on every `/dashboard/*` route and already redirects based on profile state (`is_onboarded === false` → `/onboarding`). It's the natural, single place to add: "if enforcement is enabled and this profile's accepted document versions don't match the currently-deployed required versions, redirect to a Legal Acceptance screen and block the dashboard." This same check organically handles **both** Phase 6 (writing the pending signup-time acceptance once a session exists) **and** Phase 7 (re-acceptance when a deployed document version changes) — they are the same mechanism running at the same checkpoint, just with different reasons for being "out of date" (never written vs. superseded).

## Where should uploaded documents be stored?

Supabase Storage, following the **exact existing pattern** from `db/migrations/2026-05-28_job_media_storage.sql` (the `job-media` bucket): a public bucket (`legal-documents`), with `storage.objects` RLS restricting `INSERT` to admin-role users only (checked via a `profiles.role = 'admin'` subquery, same shape as every other RLS policy already added across CRM Phase 1–3, promo codes, and routing automation this week). No new architectural pattern needed.

**Security model note:** like `job-media`, the bucket is public-by-path — anyone with the exact storage path can fetch the object directly, regardless of the row's `status` in `legal_documents` (Supabase Storage RLS for public buckets doesn't consult the application's own tables). The actual access control is enforced **one layer up**, in the API: the public-facing endpoint only ever returns `file_url` for documents with `status = 'deployed'`; draft/attorney_review/approved file URLs are only ever returned by `requireAdmin`-gated endpoints. Storage paths are UUID-keyed, not guessable. This is the same trust model already accepted for `job-media`, not a new risk introduced by this system. A fully private bucket + signed-URL-on-demand is a more airtight alternative, noted here as a future hardening option, not implemented now (bigger lift, not requested).

## Does Supabase Storage exist/configured?

Yes — confirmed via `2026-05-28_job_media_storage.sql`. The `legal-documents` bucket will be created the same way, in its own new migration.

## What existing admin document/content patterns can be reused?

- **RLS shape**: every admin-only table added this week (`lead_notes`, `promo_codes`, `route_automation_settings`, `referral_codes`, `lead_assignments`, `lead_followups`) uses the identical `FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))` policy. `legal_documents` and `legal_acceptance_settings` will use the same shape; `customer_legal_acceptances` needs a customer-facing INSERT policy too (new shape, but simple: `profile_id = auth.uid()`, gated further at the app layer by `enforcement_enabled`).
- **Admin CRUD page pattern**: `client/pages/admin/Promos.tsx` / `client/pages/admin/Referrals.tsx` (tabs, table, status badges, dialogs, all via `adminApi()`) is the template for the new `/admin/legal` page.
- **Versioned-content-with-activation pattern**: `client/pages/admin/LegalCompliance.tsx` (the *existing, employee-facing* "Legal & Compliance" page at `/admin/legal-compliance`) already implements "add version → activate version, old versions preserved for audit" for **employee onboarding forms** — structurally similar to what's being asked for customer legal documents (draft → attorney_review → approved → deployed → archived), but it's a **separate system for a separate audience** (employees, not customers) and must not be confused with or merged into the new one. The new admin page is deliberately a different path (`/admin/legal`, not `/admin/legal-compliance`) and a different nav label ("Legal Documents" vs. "Legal & Compliance") to keep them distinct.
- **No markdown rendering library** exists in this codebase (`Terms.tsx`/`Privacy.tsx` are hand-written JSX with Tailwind's `prose` class, not markdown-rendered). The new system stores `content_md` as plain text and renders it with `whitespace-pre-wrap` inside a `prose` container — no new dependency added. A real markdown parser is a reasonable future enhancement, not built now.
- **Existing `/terms` and `/privacy` static pages** (`client/pages/Terms.tsx`, `Privacy.tsx`) are separate, hardcoded marketing pages already linked from the footer and the signup checkbox. They are **not** replaced by this system — the new `/legal/terms`, `/legal/privacy`, `/legal/service-agreement`, `/legal/pesticide-consent` routes are additive. Recommend in the final report that the business eventually point the footer/signup links at the new attorney-approved, versioned documents once deployed — but that's a follow-up decision, not done automatically here.

## Admin nav placement

New "Legal Documents" entry added to the existing "Workforce" nav group, directly below "Legal & Compliance" — same group an admin would already think to look in, distinct label avoids any confusion between the two systems.
