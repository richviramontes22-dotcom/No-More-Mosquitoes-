# Production Runbook
**Project:** No More Mosquitoes
**Date:** 2026-06-02

---

> This runbook covers environment verification, migration checklist, provider setup, debugging procedures, and emergency rollback steps.

---

## 1. Environment Variable Checklist

Run `GET /api/admin/debug/system-status` (admin-only) or `GET /api/health` to verify. Set these in **Netlify Dashboard → Site Configuration → Environment Variables**.

### Critical (site fails without these)
| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `STRIPE_SECRET_KEY` | `sk_live_...` in production, `sk_test_...` in dev |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` in production |
| `STRIPE_WEBHOOK_SECRET` | From Stripe Dashboard → Webhooks → signing secret |
| `APP_BASE_URL` | e.g., `https://nomoremosquitoes.us` |

### High Priority (features break without these)
| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | From resend.com → API Keys |
| `RESEND_FROM_EMAIL` | Verified sender email |
| `OWNER_EMAIL` | Admin alert recipient |

### Operational (defaults to safe values)
| Variable | Default | Description |
|----------|---------|-------------|
| `REMINDER_DRY_RUN` | `false` | `true` = log but don't send |
| `ENABLE_REMINDER_EMAILS` | `true` | `false` = kill switch |
| `ENABLE_REGRID_FALLBACK` | `false` | `true` = allow Regrid calls |
| `ENABLE_WORKFORCE_VALIDATION` | `true` | Validation gate on publish |
| `ENABLE_ROUTE_PUBLISH_GATE` | `true` | Blocks publish on warnings |
| `ENABLE_ADMIN_DEBUG_PANEL` | `false` | `true` = show /admin/debug |
| `ENABLE_VERBOSE_CHECKPOINTS` | `false` | `true` = log all checkpoints |

---

## 2. Database Migration Checklist

Run all migrations **in order** in Supabase SQL Editor before deploying.

| # | File | Status |
|---|------|--------|
| 1 | `2026-05-31_worker_type_test_employee.sql` | Must be applied |
| 2 | `2026-05-31_employee_location_pings.sql` | Must be applied |
| 3 | `2026-05-31_onboarding_tables.sql` | Must be applied |
| 4 | `2026-05-31_extend_routes.sql` | Must be applied |
| 5 | `2026-05-31_route_stops_en_route.sql` | Must be applied |
| 6 | `2026-06-01_workforce_sprint_a.sql` | Must be applied |

**Verification query:**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'technician_schedule_templates',
  'technician_date_overrides',
  'technician_capacity_profiles',
  'onboarding_forms',
  'employee_location_pings',
  'route_audit_log'
)
ORDER BY table_name;
-- Expected: 6 rows
```

---

## 3. Stripe Webhook Verification

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://nomoremosquitoes.us/api/webhooks`
3. Events to listen for:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
   - `payment_intent.succeeded`
4. Copy signing secret → set as `STRIPE_WEBHOOK_SECRET` in Netlify
5. Send a test event from Stripe Dashboard — should return HTTP 200
6. Verify `GET /api/health/stripe` shows `webhookConfigured: true`

---

## 4. Reminder Automation Verification

1. Check `GET /api/health/email` → `configured: true`, `fromEmailConfigured: true`
2. Set `REMINDER_DRY_RUN=true` in Netlify
3. In Netlify Dashboard → Functions → Trigger `send-reminders` manually
4. Check function logs for `reminder.batch.complete` with `dryRun: true`
5. Set `REMINDER_DRY_RUN=false` when ready for real sends
6. Monitor `GET /api/admin/metrics/operations` → `reminders.sent_last_7d`

---

## 5. Parcel System Verification

1. Check `GET /api/health/parcel` → `countyLookupEnabled: true`
2. Test lookup with a known Orange County address
3. Expected: 200 with `acreage` field
4. Check response includes `acreageSource` (not "cache" on first run)
5. Run same address again → `cached: true` in response
6. Verify `ENABLE_REGRID_FALLBACK=false` (default) — Regrid should NOT be called

---

## 6. Workforce System Verification

1. Check `GET /api/health/workforce` → `activeTechnicians > 0`
2. If `missingSchedules > 0`: navigate to `/admin/workforce/schedules` and configure
3. If `missingCapacityProfiles > 0`: navigate to `/admin/workforce/capacity` and configure
4. Test day planner: `POST /api/admin/routes/day/generate` with a date
5. Verify routes are created for available technicians only

---

## 7. Debugging a Production Issue

### Step 1: Find the requestId
Every API error response includes `requestId`. Every log entry includes it.

From the client error toast or browser console:
```json
{ "requestId": "a1b2c3d4-1234-5678-abcd-ef1234567890" }
```

### Step 2: Search Netlify function logs
In Netlify Dashboard → Functions → select function → search for `requestId`:
```
a1b2c3d4-1234-5678-abcd-ef1234567890
```

### Step 3: Trace the checkpoint sequence
Checkpoints appear as:
```json
{ "level": "debug", "event": "checkpoint:billing.payment.verified", "requestId": "..." }
```
The last checkpoint before the error shows where the flow failed.

### Step 4: Enable verbose checkpoints temporarily
In Netlify env vars: `ENABLE_VERBOSE_CHECKPOINTS=true` → redeploy → reproduce → check logs → disable.

### Step 5: Enable admin debug panel
Set `ENABLE_ADMIN_DEBUG_PANEL=true` → check `/admin/debug` → diagnose → disable.

---

## 8. Emergency Feature Flag Controls

| Problem | Flag to Set | Value |
|---------|-------------|-------|
| Reminders sending unexpectedly | `REMINDER_DRY_RUN` | `true` |
| Reminder emails need to stop immediately | `ENABLE_REMINDER_EMAILS` | `false` |
| Regrid API causing errors or cost | `ENABLE_REGRID_FALLBACK` | `false` |
| Parcel lookups all failing | `ENABLE_PARCEL_COUNTY_LOOKUP` | `false` |
| Route publish blocking too aggressively | `ENABLE_ROUTE_PUBLISH_GATE` | `false` |
| Workforce validation blocking incorrectly | `ENABLE_WORKFORCE_VALIDATION` | `false` |

All flags take effect on next request — no redeploy required for Netlify env var changes.

---

## 9. Rollback Procedure

**Application rollback:**
1. Netlify Dashboard → Deploys → Click previous successful deploy → "Publish deploy"
2. Takes ~30 seconds

**Database rollback:**
- Migrations are additive (no DROP TABLE, no destructive changes)
- Rollback = redeploy old code, which ignores new columns
- For data issues: restore from Supabase automatic backups (Pro plan: point-in-time recovery)

**Stripe rollback:**
- Test keys: switch `STRIPE_SECRET_KEY` back to `sk_test_...`
- Live keys: do not switch — contact Stripe support for payment disputes

---

## 10. Health Check URLs (bookmark these)

| Check | URL |
|-------|-----|
| App uptime | `GET /api/health` |
| Database | `GET /api/health/database` |
| Stripe mode | `GET /api/health/stripe` |
| Email config | `GET /api/health/email` |
| Parcel config | `GET /api/health/parcel` |
| Workforce readiness | `GET /api/health/workforce` |
| System status | `GET /api/admin/debug/system-status` (admin JWT required) |
| Operational metrics | `GET /api/admin/metrics/operations` (admin JWT required) |
