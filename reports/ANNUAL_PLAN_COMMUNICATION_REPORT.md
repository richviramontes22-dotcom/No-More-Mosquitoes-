# Annual Plan Communication Report

**Date:** 2026-05-30

## New Netlify Function
**File:** `netlify/functions/send-annual-warnings.ts`
**Schedule:** `0 10 * * *` (daily 10:00 AM UTC — after expire-annual-plans at 9:00 AM)

## Communications Implemented

### 30-Day Warning (annual_expiring_30d)
- Queries subscriptions WHERE program='annual' AND status='active' AND current_period_end BETWEEN now+30d AND now+31d
- Dedup: checks notification_log for existing 'annual_expiring_30d' within 36 hours
- Template: `buildAnnualPlanExpiringEmail` with daysRemaining=30
- CTA: Renew button to dashboard/billing

### 7-Day Warning (annual_expiring_7d)
- Queries subscriptions WHERE program='annual' AND status='active' AND current_period_end BETWEEN now+7d AND now+8d
- Dedup: checks notification_log for existing 'annual_expiring_7d' within 36 hours
- Template: `buildAnnualPlanExpiringEmail` with daysRemaining=7

### Expiration Notification (annual_expired)
- Queries subscriptions WHERE program='annual' AND status='expired' AND current_period_end BETWEEN yesterday AND now
- Only sends after `expire-annual-plans` function has transitioned status to 'expired'
- Dedup: checks notification_log for existing 'annual_expired' within 36 hours
- Template: `buildAnnualPlanExpiredEmail`

## Implementation Notes
- Function uses direct Supabase createClient (no server imports) for Netlify compatibility
- Uses direct Resend API fetch (no npm dependency beyond what's already installed)
- Non-fatal: failures logged but function continues to next subscription
- All three new types added to `notification_log` CHECK constraint in 2026-05-30 migration
