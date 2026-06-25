# Admin Alert Event Inventory

**Date:** 2026-05-30  
**Status:** COMPLETE

## Active Alert Events

### Billing Domain

| event_type | Severity | Trigger | Dedup Window |
|-----------|---------|---------|-------------|
| `billing.payment_failed` | critical | `invoice.payment_failed` Stripe webhook | 60 min per subscription |
| `billing.new_subscription` | info | `checkout.session.completed` (subscription mode) | 60 min per user |

### Subscription Domain

| event_type | Severity | Trigger | Dedup Window |
|-----------|---------|---------|-------------|
| `subscriptions.cancelled` | warning | `customer.subscription.deleted` Stripe webhook | 60 min per subscription |

### Leads Domain

| event_type | Severity | Trigger | Dedup Window |
|-----------|---------|---------|-------------|
| `leads.new_schedule_request` | info | POST /api/schedule (successful insert) | 60 min per lead entity |

### Field Ops Domain

| event_type | Severity | Trigger | Dedup Window |
|-----------|---------|---------|-------------|
| `field_ops.service_completed` | info | Employee marks assignment `completed` | 60 min per assignment |

## Notification Rules

- **critical**: Email + SMS (always)
- **warning**: Email + SMS (when phone configured)
- **info**: Email only (no SMS to avoid noise)
- All events deduplicate within their window using `admin_alerts` table query

## Entity Types

| entity_type | entity_id field |
|------------|----------------|
| subscription | Stripe subscription ID or local UUID |
| user | Supabase profile UUID |
| lead | schedule_request UUID |
| assignment | assignment UUID |
