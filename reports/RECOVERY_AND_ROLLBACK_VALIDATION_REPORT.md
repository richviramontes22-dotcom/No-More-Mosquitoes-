# Recovery & Rollback Validation Report
**Date:** 2026-06-02

---

## Feature Flag Kill Switches — Verified

| System | Flag | Effect When Disabled | Verified |
|--------|------|---------------------|---------|
| Reminder sends | `ENABLE_REMINDER_EMAILS=false` | All reminder sends skipped; batch still runs + logs | ✓ Code verified |
| Reminder dry-run | `REMINDER_DRY_RUN=true` | Logs intent only; no sends | ✓ Code verified |
| Parcel county lookup | `ENABLE_PARCEL_COUNTY_LOOKUP=false` | Cache hits still work; fresh lookups return manual review | ✓ Code verified |
| Regrid fallback | `ENABLE_REGRID_FALLBACK=false` | Regrid adapter returns null immediately | ✓ Code verified |
| Workforce validation | `ENABLE_WORKFORCE_VALIDATION=false` | Publish proceeds without validation checks | ✓ Code verified |
| Route publish gate | `ENABLE_ROUTE_PUBLISH_GATE=false` | Publish gate skipped | ✓ Code verified |
| Admin debug panel | `ENABLE_ADMIN_DEBUG_PANEL=false` | API returns 403; page shows error state | ✓ Code verified |

**All flags are functions (re-read on every request) — effective immediately without redeploy.**

---

## Onboarding Recovery — Verified

| Scenario | Recovery | Status |
|----------|----------|--------|
| Skip onboarding loops back | Fixed — `queryClient.invalidateQueries` before navigate | ✓ FIXED |
| Stale progress in localStorage | Cleared on `clearPendingOnboarding()` after booking | ✓ Verified |
| Annual plan routing | Redirects to /contact | ✓ Verified |
| Cross-device sync | Supabase `onboarding_progress` column synced | ✓ Verified |

---

## Application Rollback — Verified

Netlify one-click rollback:
- Deploys tab → select prior deploy → "Publish deploy"
- ~30 seconds

Database migrations are additive-only (no DROP, no TRUNCATE):
- Rollback = deploy old code that ignores new columns
- Data is preserved

---

## Production Runbook Accuracy — Validated

The `PRODUCTION_RUNBOOK.md` was reviewed against the current codebase:

| Section | Accuracy |
|---------|---------|
| Environment variable checklist | ✓ Accurate (all vars verified in code) |
| Migration checklist | ✓ Accurate (6 migration files verified to exist) |
| Stripe webhook verification | ✓ Accurate (endpoint registered in server/index.ts) |
| Reminder automation verification | ✓ Accurate (dry-run + flag verified in code) |
| Parcel system verification | ✓ Accurate (health endpoint + feature flags verified) |
| Workforce system verification | ✓ Accurate (health endpoint + admin UI verified) |
| RequestId debugging procedure | ✓ Accurate (requestId on all responses) |
| Feature flag controls | ✓ Accurate (all flags verified) |
| Rollback procedure | ✓ Accurate (Netlify + DB strategy) |

**The production runbook is accurate and usable.**

---

## Remaining Recovery Gaps

| Gap | Risk | Mitigation |
|-----|------|-----------|
| Stripe webhook not configured | HIGH — payments record incomplete | Set `STRIPE_WEBHOOK_SECRET` in Netlify before go-live |
| `RESEND_API_KEY` missing | MEDIUM — no email sends | Set in Netlify |
| Supabase backup not verified | MEDIUM | Check Supabase → Settings → Backups (Pro plan) |
| No automated DB backup verification | LOW | Manual check monthly |
