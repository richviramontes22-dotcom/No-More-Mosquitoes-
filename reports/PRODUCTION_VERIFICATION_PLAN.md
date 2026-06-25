# Phase 0 — Production Verification Plan
**Date:** 2026-05-30
**Sprint:** Production Verification & Operational Readiness Sprint

---

## Purpose

This plan defines the test environment, required preconditions, and success criteria for the 14-phase Production Verification Sprint. It synthesizes findings from five prior sprint reports as the baseline.

---

## Prior Sprint Baseline

| Report | Date | Conclusion |
|--------|------|-----------|
| COMMUNICATION_IMPLEMENTATION_REPORT | 2026-05-30 | GO — 79/100, 14 email templates, SMS compliance done |
| NOTIFICATION_PHASE2_FINAL_REPORT | 2026-05-30 | GO — 85/100, employee notify, admin alerts, unsubscribe |
| FINAL_VERIFICATION_GO_NO_GO_REPORT | 2026-05-29 | CONDITIONAL GO — code correct, migrations pending |
| DEPLOYMENT_READINESS_CHECKLIST | 2026-05-29 | Checklist prepared, 3 migrations required |
| END_TO_END_OPERATIONAL_TEST_REPORT | 2026-05-29 | 12/13 PASS via static code-trace |

**Net prior status:** CONDITIONAL GO — all code verified; 6 migrations needed before deployment.

---

## Test Environment

| Item | Value |
|------|-------|
| Platform | Netlify (serverless) |
| Database | Supabase (PostgreSQL + RLS) |
| Client bundle | Vite + React + TypeScript |
| Server bundle | Express + TypeScript (Netlify Function) |
| Email | Resend (`RESEND_API_KEY`) |
| SMS | Twilio fetch-based (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`) |
| Payments | Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) |
| Deployment domain | https://nomoremosquitoes.us |

---

## Required Environment Variables

| Variable | Required | Status at Verification Time |
|----------|----------|----------------------------|
| `VITE_SUPABASE_URL` | Required | SET (confirmed in .env) |
| `VITE_SUPABASE_ANON_KEY` | Required | SET (confirmed in .env) |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | SET (confirmed in .env) |
| `STRIPE_SECRET_KEY` | Required | SET — TEST key currently (`sk_test_`) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Required | SET — TEST key currently (`pk_test_`) |
| `STRIPE_WEBHOOK_SECRET` | Required | NOT SET in .env |
| `APP_BASE_URL` | Required | SET (`https://nomoremosquitoes.us`) |
| `RESEND_API_KEY` | Required | NOT SET in .env |
| `RESEND_FROM_EMAIL` | Required | NOT SET in .env |
| `REMINDER_DRY_RUN` | Required (false in prod) | NOT SET in .env |
| `TWILIO_ACCOUNT_SID` | Optional (SMS) | SET (test SID) |
| `TWILIO_AUTH_TOKEN` | Optional (SMS) | SET (test token) |
| `TWILIO_FROM_NUMBER` | Optional (SMS) | NOT SET (blank) |
| `OWNER_EMAIL` | Optional (admin alerts) | NOT SET in .env |
| `OWNER_PHONE` | Optional (admin SMS) | NOT SET in .env |
| `COMPANY_ADDRESS` | Optional (email footer) | NOT SET in .env |
| `SUPPORT_EMAIL` | Optional | NOT SET in .env |

**CRITICAL GAP:** `STRIPE_SECRET_KEY` is a TEST key. For production, must be `sk_live_`. Also `RESEND_API_KEY` not set — all emails will use NullProvider (log-only). `STRIPE_WEBHOOK_SECRET` not set — ALL webhooks will return 500.

---

## Required Migrations

Per user confirmation, all migrations have been run. The following were required:

| Migration File | Purpose | Status |
|---------------|---------|--------|
| `2026-05-29_ensure_profile_trigger.sql` | Auto-create profiles on signup | CONFIRMED APPLIED |
| `2026-05-29_notification_type_service_completed.sql` | Add service_completed to CHECK | CONFIRMED APPLIED |
| `2026-05-29_assignment_appointment_uniqueness.sql` | Partial UNIQUE index for assignments | CONFIRMED APPLIED |
| `2026-05-30_notification_types_communication_sprint.sql` | 13 new notification types | CONFIRMED APPLIED |
| `2026-05-30_admin_alerts.sql` | admin_alerts table + indexes + RLS | CONFIRMED APPLIED |
| `2026-05-30_notification_phase2_types.sql` | 4 new Phase 2 types (employee + email_opted_out) | CONFIRMED APPLIED |

---

## Required Test Accounts

| Account | Purpose |
|---------|---------|
| Admin account (role=admin) | Admin dashboard, alert bell, dispatch |
| Customer account (active subscription) | Customer flow, billing portal |
| Employee account (status=active) | Assignment acceptance, status updates |
| Stripe test card `4242 4242 4242 4242` | Checkout flow verification |

---

## Stripe Configuration Requirements

| Item | Required |
|------|---------|
| Webhook endpoint registered | `https://nomoremosquitoes.us/api/webhooks/stripe` |
| `STRIPE_WEBHOOK_SECRET` set | Must match live endpoint secret |
| Events registered | 9 event types (see DEPLOYMENT_READINESS_CHECKLIST) |
| Live keys for production | `sk_live_` and `pk_live_` |

---

## Twilio Configuration Requirements

| Item | Required |
|------|---------|
| Inbound SMS webhook | `https://nomoremosquitoes.us/api/webhooks/sms` |
| `TWILIO_FROM_NUMBER` set | Required for any SMS to send |
| Test vs live | Currently test SID/token — must use live for production |

---

## Resend Configuration Requirements

| Item | Required |
|------|---------|
| `RESEND_API_KEY` set | Required for emails to send |
| `RESEND_FROM_EMAIL` set | Must be verified domain in Resend |
| Domain verified | `nomoremosquitoes.us` must pass DNS verification |

---

## Rollback Plan

### Code Rollback
- Netlify Dashboard → Deploys → select previous deploy → Publish deploy

### Migration Rollback (if needed)

**Profile trigger:**
```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
```

**Notification constraint:**
```sql
ALTER TABLE public.notification_log DROP CONSTRAINT IF EXISTS notification_log_notification_type_check;
```

**Assignment uniqueness:**
```sql
DROP INDEX IF EXISTS public.assignments_appointment_id_active_unique;
```

**Admin alerts table:**
```sql
DROP TABLE IF EXISTS public.admin_alerts;
```

Note: Data deleted by migration cleanup steps cannot be restored without backup.

---

## Success Criteria

| Phase | Pass Criteria |
|-------|--------------|
| Build | `npx tsc --noEmit` exits 0; `pnpm build` completes without errors |
| Migrations | All 6 migration files are syntactically valid SQL with idempotent guards |
| Env vars | All Required vars SET; Missing Optional vars handled by NullProviders |
| DB Integrity | All integrity queries return 0 rows |
| Customer flow | All 6 steps VERIFIED by code-trace |
| Customer notifications | All 12 types have code path + opt-out check + logNotification |
| Admin alerts | All 9+ events wired; bell UI exists; counts endpoint works |
| Employee flow | notifyEmployeeAssigned() and notifyEmployeeAssignmentCancelled() wired |
| Stripe webhooks | All 9 event types handle without throwing; signature verified |
| Scheduled functions | All 4 functions exist with netlify.toml schedules |
| Notification log | TypeScript union matches DB constraint exactly |

---

## Decision Rules

- **GO:** Build passes, all migrations applied, no critical flow defects, Stripe keys and webhook configured for production
- **CONDITIONAL GO:** Build passes, migrations applied, but live providers not configured (NullProvider mode), or live Stripe webhook not tested
- **NO-GO:** Build fails, critical migration missing, billing flow broken, DB constraint mismatch that would cause silent failures
