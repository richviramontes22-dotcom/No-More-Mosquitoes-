# Admin Billing Alerts Report

**Date:** 2026-05-30  
**File:** `server/routes/webhooksStripe.ts`  
**Status:** IMPLEMENTED

## Implemented Billing Alerts

### 1. Payment Failed (`billing.payment_failed`)
- **Severity:** critical
- **Trigger:** `invoice.payment_failed` Stripe webhook
- **Email:** Yes (also sends customer-facing payment_failed email)
- **SMS:** Yes (critical)
- **Body:** Customer email, amount, invoice ID
- **Action required:** Contact customer to update payment method

### 2. New Subscription (`billing.new_subscription`)
- **Severity:** info
- **Trigger:** `checkout.session.completed` with `mode=subscription`
- **Email:** Yes
- **SMS:** No (info)
- **Body:** Customer email, plan name, Stripe session ID
- **Action required:** Verify scheduling preferences, schedule first visit

### 3. Subscription Cancelled (`subscriptions.cancelled`)
- **Severity:** warning
- **Trigger:** `customer.subscription.deleted` Stripe webhook
- **Email:** Yes (also sends customer-facing cancellation email)
- **SMS:** Yes (warning)
- **Body:** Customer email, plan name, end date
- **Action required:** Optionally reach out for win-back

## Alert Email Format

All admin billing alerts use the internal `buildAdminAlertEmail()` template:
- No customer branding (internal use)
- Severity badge (red/yellow/blue)
- "Open Admin Dashboard" CTA button
- Metadata table with relevant event details
