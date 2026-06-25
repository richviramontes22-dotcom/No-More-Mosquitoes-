# Deployment Readiness Checklist
**Sprint:** Final Operational Verification Sprint  
**Date:** 2026-05-29

---

## Pre-Deployment Checklist

### Build Verification (Already Completed)

- [x] Run `pnpm typecheck` — PASS: zero errors, zero warnings (confirmed)
- [x] Run `pnpm build:client` — PASS: 3,449 modules, 2,160 kB bundle (confirmed)
- [x] Run `pnpm build:server` — PASS: 297.20 kB SSR bundle (confirmed)

### Database Migrations

- [ ] Run pre-check query for duplicate assignments (Migration 3 pre-requisite):
  ```sql
  SELECT appointment_id, COUNT(*) AS active_count
  FROM public.assignments
  WHERE status NOT IN ('completed','skipped','canceled','cancelled','no_show')
  GROUP BY appointment_id HAVING COUNT(*) > 1;
  ```
  If rows returned: review and resolve before proceeding with Migration 3.

- [ ] Apply `db/migrations/2026-05-29_ensure_profile_trigger.sql` in Supabase SQL Editor
- [ ] Apply `db/migrations/2026-05-29_notification_type_service_completed.sql` in Supabase SQL Editor
- [ ] Apply `db/migrations/2026-05-29_assignment_appointment_uniqueness.sql` in Supabase SQL Editor

### Post-Migration Verification

- [ ] Verify profile trigger exists (see Supabase Deployment Verification Checklist Step 1)
- [ ] Verify `service_completed` in notification constraint (Checklist Step 2)
- [ ] Verify assignment uniqueness index exists (Checklist Step 3)
- [ ] Run profile backfill query for existing users (Checklist Step 4)
- [ ] Confirm no orphaned auth users remain (Checklist Step 5)
- [ ] Run IS-1 integrity query — expect zero rows
- [ ] Run IS-12 integrity query — expect zero rows

### Environment Variables

- [ ] Set all Required env vars in Netlify Dashboard → Site Configuration → Environment Variables
- [ ] Confirm `STRIPE_SECRET_KEY` begins with `sk_live_` (not `sk_test_`)
- [ ] Confirm `VITE_STRIPE_PUBLISHABLE_KEY` begins with `pk_live_`
- [ ] Confirm `REMINDER_DRY_RUN=false`
- [ ] Confirm `APP_BASE_URL=https://nomoremosquitoes.us` (no trailing slash)
- [ ] Confirm `RESEND_API_KEY` is set and domain is verified in Resend

### Stripe Configuration

- [ ] Register/verify webhook endpoint in Stripe Dashboard → Developers → Webhooks
  - Endpoint URL: `https://nomoremosquitoes.us/api/webhooks/stripe`
- [ ] Verify all required webhook events are registered (see list below)
- [ ] Copy new `STRIPE_WEBHOOK_SECRET` from Stripe Dashboard if webhook endpoint was changed

### Deployment

- [ ] Push main branch to GitHub (triggers Netlify auto-deploy)
- [ ] Monitor Netlify deploy log for build errors
- [ ] Confirm Netlify scheduled functions appear in Functions dashboard after deploy

---

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `SUPABASE_URL` | Required | Server-side DB connection URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | Server admin DB access (bypasses RLS) |
| `SUPABASE_ANON_KEY` | Required | Server anon key fallback |
| `VITE_SUPABASE_URL` | Required | Frontend DB URL (baked into client bundle) |
| `VITE_SUPABASE_ANON_KEY` | Required | Frontend auth (public key, safe to expose) |
| `STRIPE_SECRET_KEY` | Required (`sk_live_` in prod) | All server-side Stripe API calls |
| `STRIPE_WEBHOOK_SECRET` | Required | Stripe webhook signature verification |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Required (`pk_live_` in prod) | Frontend Stripe Elements |
| `RESEND_API_KEY` | Required | Transactional email delivery |
| `RESEND_FROM_EMAIL` | Required | Sender address on all outbound emails |
| `APP_BASE_URL` | Required | Stripe redirect URLs, email links |
| `REMINDER_DRY_RUN` | Required (`false` in prod) | If `true`, reminders are logged but not sent |
| `STRIPE_AUTO_TAX` | Required (`false` until configured) | Stripe Tax on all charges |
| `TWILIO_ACCOUNT_SID` | Optional | SMS en-route notifications |
| `TWILIO_AUTH_TOKEN` | Optional | Twilio auth |
| `TWILIO_FROM_NUMBER` | Optional | Outbound SMS number |
| `GOOGLE_MAPS_SERVER_KEY` | Optional | Backend geocoding for parcel lookup |
| `VITE_GOOGLE_MAPS_BROWSER_KEY` | Optional | Frontend Places Autocomplete |
| `PARCEL_CACHE_ENABLED` | Optional (`true` recommended) | Enables DB cache for parcel lookups |
| `REDIS_URL` | Optional | Redis hot cache for parcel lookups |
| `VITE_CRISP_WEBSITE_ID` | Optional | Crisp live chat widget |
| `REGRID_API_KEY` | Optional | Legacy Regrid fallback (disabled by default) |

---

## Netlify Scheduled Functions

Verified from `netlify.toml`:

| Function Name | Cron Schedule | UTC Time | Purpose |
|--------------|--------------|----------|---------|
| `send-reminders` | `0 7 * * *` | 7:00 AM daily | Sends 24h and same-day appointment reminder emails to customers |
| `generate-appointments` | `0 8 * * *` | 8:00 AM daily | Generates recurring appointments for active subscriptions |
| `expire-annual-plans` | `0 9 * * *` | 9:00 AM daily | Expires annual plans past `current_period_end`, creates admin alert tickets |

All three are registered in `netlify.toml` and will be activated automatically on the next Netlify deploy from the main branch.

---

## Stripe Webhook Events to Register

In Stripe Dashboard → Developers → Webhooks, the production endpoint must be registered for:

| Event | Handler Location | Purpose |
|-------|-----------------|---------|
| `invoice.paid` | `webhooksStripe.ts` case | Activates subscription, creates service_order, syncs card |
| `invoice.payment_failed` | `webhooksStripe.ts` case | Marks subscription `past_due` |
| `payment_intent.succeeded` | `webhooksStripe.ts` case | Annual plan upsert, marketplace order completion |
| `customer.subscription.deleted` | `webhooksStripe.ts` case | Cancels subscription + cascade to appointments + assignments |
| `customer.subscription.updated` | `webhooksStripe.ts` case | Syncs non-active subscription states |
| `checkout.session.completed` | `webhooksStripe.ts` case | Marketplace order, one-time service order, first appointment |
| `checkout.session.expired` | `webhooksStripe.ts` case | Marks pending marketplace orders expired |
| `payment_intent.payment_failed` | `webhooksStripe.ts` case | Marks marketplace orders failed |
| `charge.refunded` | `webhooksStripe.ts` case | Marks orders and payments refunded |

---

## Post-Deployment Smoke Tests

After deployment, perform these manual checks in a staging or production environment:

1. **Profile trigger:** Create a test user signup — verify a `profiles` row is created immediately in Supabase Table Editor
2. **Past-due portal:** Set a test subscription to `past_due` in the DB — verify the customer can access the billing portal URL
3. **Assignment uniqueness:** Assign an employee to an appointment twice — verify the second assignment does not create a new row (upsert behavior)
4. **Service completion notification:** Mark a test assignment as `completed` — verify `notification_log` row has `notification_type = 'service_completed'`
5. **Annual expiration:** Manually trigger `expire-annual-plans` function in Netlify Functions dashboard — verify it runs without error and the summary shows correct counts
6. **Webhook:** Use Stripe Dashboard → Webhooks → Send test event to verify signature verification passes and events are processed
