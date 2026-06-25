# Beta Launch Checklist
**Date:** 2026-06-03
**Project:** No More Mosquitoes

Complete each item and check it off before deploying to production.

---

## 🔴 Critical (Must Complete Before Any Real Transactions)

- [ ] **1. Stripe live key set in Netlify**
  - `STRIPE_SECRET_KEY=sk_live_51T8zGo...` (copy from .env `LIVE_STRIPE_SECRET_KEY`)
  - `VITE_STRIPE_PUBLISHABLE_KEY=pk_live_51T8zGo...` (copy from .env `LIVE_VITE_STRIPE_PUBLISHABLE_KEY`)

- [ ] **2. Stripe webhook configured**
  - Create endpoint in Stripe Dashboard → Developers → Webhooks
  - URL: `https://nomoremosquitoes.us/api/webhooks`
  - Events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`
  - Copy signing secret → set `STRIPE_WEBHOOK_SECRET` in Netlify

- [ ] **3. Stripe webhook tested**
  - Send a test event from Stripe Dashboard → confirm HTTP 200 response

- [ ] **4. Database migrations applied**
  - All 32 migration files applied in Supabase SQL Editor in order
  - Verification query returns 16 tables (see STAGING_DATABASE_VALIDATION_REPORT.md)

---

## 🟡 High (Required for Core Features)

- [ ] **5. Resend configured in Netlify**
  - `RESEND_API_KEY=re_...` (from resend.com → API Keys)
  - `RESEND_FROM_EMAIL=No More Mosquitoes <hello@nomoremosquitoes.us>`
  - Sender domain verified in Resend dashboard

- [ ] **6. Health endpoints verified**
  - `GET https://nomoremosquitoes.us/api/health` → `{ ok: true }`
  - `GET https://nomoremosquitoes.us/api/health/database` → `{ ok: true, latencyMs: <500 }`
  - `GET https://nomoremosquitoes.us/api/health/stripe` → `{ mode: "live", webhookConfigured: true }`
  - `GET https://nomoremosquitoes.us/api/health/email` → `{ configured: true }`

- [ ] **7. APP_BASE_URL verified in Netlify**
  - `APP_BASE_URL=https://nomoremosquitoes.us`

- [ ] **8. Full subscription payment test with live Stripe**
  - Create a real payment with a real card (small amount or use a team card)
  - Verify appointment created in admin
  - Verify subscription shows in Stripe Dashboard
  - Verify confirmation email received

---

## 🟢 Operational (Verify Before Launch)

- [ ] **9. Operational flags set correctly in Netlify**
  - `REMINDER_DRY_RUN=false` (or unset)
  - `ENABLE_REMINDER_EMAILS=true` (or unset)
  - `ENABLE_REGRID_FALLBACK=false` (or unset)
  - `ENABLE_WORKFORCE_VALIDATION=true` (or unset)
  - `ENABLE_ROUTE_PUBLISH_GATE=true` (or unset)
  - `ENABLE_ADMIN_DEBUG_PANEL=false` (or unset)
  - `ENABLE_VERBOSE_CHECKPOINTS=false` (or unset)

- [ ] **10. Admin alerts configured**
  - `OWNER_EMAIL=your@email.com` set in Netlify

- [ ] **11. Sentry configured (or intentionally skipped)**
  - Option A: `ENABLE_SENTRY=false` (no monitoring — acceptable for soft beta)
  - Option B: Create Sentry project → set `ENABLE_SENTRY=true` + `SENTRY_DSN=...`

- [ ] **12. Reminder dry-run confirmed off**
  - `GET /api/health/email` → `{ reminderDryRun: false }`

---

## 🔵 Safety Checks

- [ ] **13. Admin debug panel disabled in production**
  - `ENABLE_ADMIN_DEBUG_PANEL` not set, or `false`
  - Verify: `GET /api/admin/debug/system-status` with admin token → 403 (or 200 if enabled temporarily)

- [ ] **14. Rollback procedure confirmed**
  - Team knows: Netlify Dashboard → Deploys → click previous deploy → "Publish deploy"
  - Team knows feature flag kill switches (see PRODUCTION_RUNBOOK.md)

- [ ] **15. Support process ready**
  - Owner knows to monitor admin dashboard for new orders
  - Admin email set up for customer inquiries
  - Stripe dispute handling process understood

---

## Sign-Off

- [ ] All 🔴 Critical items complete
- [ ] All 🟡 High items complete
- [ ] All 🟢 Operational items verified
- [ ] Final go/no-go decision made (see FINAL_BETA_GO_NO_GO_REPORT.md)
