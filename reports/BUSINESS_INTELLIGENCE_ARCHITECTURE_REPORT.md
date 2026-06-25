# Business Intelligence Architecture Report
**Date:** 2026-06-02
**Status:** Architecture plan — not yet implemented

---

## Conversion Funnel Architecture

### Funnel Steps to Track
```
Homepage visitor
  → Quote widget initiated (address entered)
  → Quote completed (acreage + price shown)
  → Schedule initiated (CTA clicked)
  → Account created (signup complete)
  → Payment initiated (Stripe element loaded)
  → Payment confirmed (confirm-booking success)
  → Customer (active subscription)
```

### Tracking Strategy
Each step corresponds to an existing structured log event or can be added:

| Step | Event to Log | Where |
|------|-------------|-------|
| Quote initiated | `parcel.lookup.started` | Already logged |
| Quote completed | `parcel.lookup.county_success` | Already logged |
| Schedule initiated | Client-side `schedule.flow.started` | Add to ScheduleFlow |
| Account created | `auth.signup.completed` | Add to AuthContext |
| Payment initiated | `billing.start` checkpoint | Already logged |
| Payment confirmed | `billing.complete` checkpoint | Already logged |

---

## Operational Dashboard Architecture

### Future `/admin/analytics` page

Sections:
1. **Revenue** — MTD, WTD, subscription ARR estimate
2. **Appointments** — Today, this week, this month, completion rate
3. **Customer acquisition** — New customers, churn, active count
4. **Operational efficiency** — Route utilization, reminder success rate, parcel cache hit rate
5. **Parcel costs** — Lookup volume, cache hit %, fallback usage

### Data Sources (Already Available)
- `subscriptions` table — active count, created_at
- `appointments` table — scheduled/completed counts
- `payments` table — revenue (once webhooks configured)
- `notification_log` — reminder success rate
- `route_audit_log` — route publish activity
- Structured logs — parcel performance metrics

---

## Phase 1 Recommendation (Low Effort)

Extend the existing `/api/admin/metrics/operations` endpoint with:
- Appointments this week (already queryable)
- New customers this week (`subscriptions.created_at`)
- Reminder success rate (computed from existing counts)

This gives a basic BI view without new infrastructure.

## Phase 2 Recommendation (Medium Effort)

Create `/admin/analytics` page with:
- Date range selector
- Time-series chart for appointments (use recharts — already in dependencies)
- Subscription growth chart
- No external BI tool required

## Phase 3 Recommendation (Future)

When scale demands it:
- Supabase → PostHog, Mixpanel, or Metabase for deeper BI
- Google Analytics 4 for funnel tracking (client-side events)
- No paid BI tool needed until 500+ customers
