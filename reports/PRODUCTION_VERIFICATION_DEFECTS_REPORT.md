# Phase 12 — Production Verification Defects Report
**Date:** 2026-05-30
**Sprint:** Production Verification & Operational Readiness Sprint

---

## Summary

All defects identified across Phases 1-11 are classified by severity. Only CRITICAL and HIGH defects are candidates for fixes. No code fixes were made in this phase because all critical issues are operational/environment configuration issues (not code defects), or are too risky to change without live testing.

---

## Defect Classification

### CRITICAL — Must Fix Before Beta

| ID | Defect | Location | Impact | Fix |
|----|--------|---------|--------|-----|
| DEF-CRIT-001 | `STRIPE_WEBHOOK_SECRET` not set in .env | `.env` file | All Stripe webhooks return HTTP 500. No payment confirmations, subscription lifecycle, or appointment creation from checkout will work. | Set `STRIPE_WEBHOOK_SECRET` in Netlify production environment variables. Cannot fix in code — requires operator action. |
| DEF-CRIT-002 | Stripe using TEST keys (`sk_test_`, `pk_test_`) | `.env` file | Test Stripe keys cannot process real payments. Customers will see test mode errors in production. | Replace `STRIPE_SECRET_KEY` with `sk_live_...` and `VITE_STRIPE_PUBLISHABLE_KEY` with `pk_live_...` in Netlify env. Cannot fix in code. |
| DEF-CRIT-003 | `RESEND_API_KEY` not set in .env | `.env` file | All emails fall back to NullProvider (console log only). No customer notifications delivered. | Set `RESEND_API_KEY` in Netlify production environment variables. App runs fine; emails just aren't delivered. |

**Note:** All CRITICAL defects are operational/environment configuration issues. The code handles them gracefully (no crashes). They must be resolved in Netlify Dashboard environment variables before production go-live.

---

### HIGH — Should Fix Before Beta

| ID | Defect | Location | Impact | Fix |
|----|--------|---------|--------|-----|
| DEF-HIGH-001 | `TWILIO_FROM_NUMBER` not set | `.env` file | All SMS falls back to NullSmsProvider. No appointment reminder SMS, en-route SMS, or employee SMS delivered. | Set `TWILIO_FROM_NUMBER` in Netlify production environment variables. Test vs live Twilio credentials must also be confirmed. |
| DEF-HIGH-002 | `OWNER_EMAIL` not set | `.env` file | Admin alert emails not delivered. Admin sees alerts in DB (bell UI still works) but no email alerting. | Set `OWNER_EMAIL` in Netlify production environment variables. Low urgency if owner monitors the admin bell UI. |
| DEF-HIGH-003 | `RESEND_FROM_EMAIL` not set | `.env` file | If RESEND_API_KEY is set but FROM email is missing, `getFromEmail()` uses hardcoded fallback. May cause Resend domain verification issues if the domain doesn't match. | Set `RESEND_FROM_EMAIL=No More Mosquitoes <hello@nomoremosquitoes.us>` in Netlify env. |
| DEF-HIGH-004 | Build/typecheck not run live in this session | N/A | Cannot confirm zero TypeScript errors for Phase 2 code without running `npx tsc --noEmit` | Operator must run `npx tsc --noEmit` and `pnpm build` from project root. Expected: 0 errors based on static analysis and prior session results. |

---

### MEDIUM — Fix in Next Sprint

| ID | Defect | Location | Impact | Fix |
|----|--------|---------|--------|-----|
| DEF-MED-001 | `payments.insert()` in `invoice.paid` uses anon supabase client | webhooksStripe.ts line 562 | If `payments` table has RLS requiring auth.uid(), payment recording will silently fail. | Switch to `supabaseAdmin ?? supabase` for payments insert. LOW RISK change. |
| DEF-MED-002 | `appointment_canceled` cancellation email uses `isEmailConfigured()` instead of `getEmailProvider()` | adminAppointments.ts line 202 | Inconsistent provider pattern. If email configured, uses raw Resend client (bypasses NullProvider abstraction). | Refactor to use `getEmailProvider()` for consistency with rest of codebase. |
| DEF-MED-003 | `service_completed` email uses `isEmailConfigured()` instead of `getEmailProvider()` | employeeAssignments.ts line 340 | Same inconsistency as DEF-MED-002. | Refactor to use `getEmailProvider()`. |
| DEF-MED-004 | `COMPANY_ADDRESS` not set | `.env` file | Email footers omit company address (CAN-SPAM requires a physical address for commercial emails). | Set `COMPANY_ADDRESS` in Netlify env before any commercial email campaigns. For transactional emails this is less critical. |
| DEF-MED-005 | Admin alert bell is `hidden md:block` | SiteHeader.tsx line 323 | Mobile admin users cannot see the alert bell. Must use sidebar Alerts link. | Add mobile bell to sidebar or sheet nav. Medium effort. |
| DEF-MED-006 | `payments.insert()` in `invoice.paid` has no duplicate guard | webhooksStripe.ts line 562-572 | If Stripe retries invoice.paid (e.g., network timeout), a duplicate payment record may be inserted. | Add `onConflict: "stripe_payment_intent_id"` upsert. |

---

### LOW — Nice to Have

| ID | Defect | Location | Impact | Fix |
|----|--------|---------|--------|-----|
| DEF-LOW-001 | `technician_enroute` (old spelling) orphaned in DB constraint | All migrations | Harmless — just an unused constraint value. | Remove from constraint in a future cleanup migration. |
| DEF-LOW-002 | `appointment_canceled_employee` and `appointment_canceled_customer` in constraint with no active code paths found | Various | Harmless — pre-existing from prior sprints. May be used in code not read in this session. | Verify usage or remove in future cleanup. |
| DEF-LOW-003 | `expire-annual-plans` creates tickets in `tickets` table, not `admin_alerts` | expire-annual-plans.ts | Inconsistent alerting — annual expiry tickets appear in tickets UI, not in admin_alerts bell. | Migrate to `notifyAdmin()` calls in a future sprint. |
| DEF-LOW-004 | `notifyEmployeeAssignmentChanged()` exists but no routes were found wiring it for assignment updates (beyond creation/cancellation) | employeeNotificationService.ts | Update notifications may not fire for schedule changes. | Verify if assignment update route exists and wire accordingly. |

---

## Fix Decisions

Per sprint rules, only CRITICAL and HIGH defects that are small, low-risk, and code-level should be fixed. Reviewing candidates:

- **DEF-CRIT-001, 002, 003, DEF-HIGH-001, 002, 003:** ALL are environment variable issues. Cannot fix in code — require operator action in Netlify Dashboard. No code changes needed or possible.
- **DEF-HIGH-004:** Cannot be fixed without terminal access. Operator must run commands.
- **DEF-MED-001:** Switch `supabase` to `supabaseAdmin ?? supabase` for payments insert in webhooksStripe.ts. This is a small, low-risk change. However, it touches billing code — per sprint rules, changes touching billing are higher risk. DEFERRED to operator review.
- **DEF-MED-002, 003:** Refactoring isEmailConfigured() to getEmailProvider() pattern. Small change but touches notification delivery path. DEFERRED — risk too high for sprint; functionally correct as-is.
- **DEF-MED-006:** Adding onConflict to payments insert. Very small and low-risk. DEFERRED — same billing concern as DEF-MED-001.

**Decision: No code fixes made in Phase 12.** All critical defects are operational (env vars). All medium defects involve billing or notification paths that require live testing before change. The code is correct for its current state; the issues are operational prerequisites.

---

## TypeScript Re-Check After Fixes

No code changes were made in Phase 12, so no re-check is needed. The TypeScript check status remains UNVERIFIED (terminal access denied) — operator must run `npx tsc --noEmit` to confirm.

---

## Action Items for Operator

### Before Production Deployment (BLOCKERS)
1. In Netlify Dashboard → Environment Variables, set:
   - `STRIPE_WEBHOOK_SECRET` = value from Stripe Dashboard → Webhooks → (production endpoint) → Signing secret
   - `STRIPE_SECRET_KEY` = `sk_live_...` (from Stripe Dashboard → API Keys)
   - `VITE_STRIPE_PUBLISHABLE_KEY` = `pk_live_...`
   - `RESEND_API_KEY` = value from Resend Dashboard → API Keys
   - `RESEND_FROM_EMAIL` = `No More Mosquitoes <hello@nomoremosquitoes.us>`

2. Run from project root:
   ```powershell
   npx tsc --noEmit
   pnpm build
   ```
   Confirm both exit with zero errors.

### Before Production Deployment (Recommended)
3. Set in Netlify:
   - `TWILIO_FROM_NUMBER` = production Twilio number (for SMS delivery)
   - `OWNER_EMAIL` = business owner email (for admin alert emails)
   - `COMPANY_ADDRESS` = physical mailing address (CAN-SPAM compliance)
   - `SUPPORT_EMAIL` = support@nomoremosquitoes.us

4. Verify Stripe webhook endpoint is registered at `https://nomoremosquitoes.us/api/webhooks/stripe` for all 9 required event types.

5. Run database integrity queries from Phase 4 report in Supabase SQL Editor.

### After Deployment
6. Create a test signup and confirm profile row created in Supabase.
7. Send a test Stripe webhook from Stripe Dashboard and confirm 200 response.
8. Manually trigger `expire-annual-plans` in Netlify Functions dashboard and confirm it runs without error.
