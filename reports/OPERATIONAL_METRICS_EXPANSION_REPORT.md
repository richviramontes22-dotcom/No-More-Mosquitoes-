# Operational Metrics Expansion Report
**Date:** 2026-06-02

---

## Current Metrics (`GET /api/admin/metrics/operations`)

| Metric | Source | Status |
|--------|--------|--------|
| Appointments today | `appointments` table | ✓ Live |
| Appointments next 7 days | `appointments` table | ✓ Live |
| Active subscriptions | `subscriptions` table | ✓ Live |
| Active employees | `employees` table | ✓ Live |
| Reminder sends (7d) | `notification_log` | ✓ Live |
| Reminder failures (7d) | `notification_log` | ✓ Live |
| Route publish validation failures (7d) | `route_audit_log` | ✓ Live |
| Workforce missing schedules | `technician_schedule_templates` | ✓ Live |
| Workforce missing capacity | `technician_capacity_profiles` | ✓ Live |
| Parcel manual reviews | Not tracked in DB | null + `trackingMissing: true` |

---

## Metrics Missing / Not Yet Trackable

| Metric | Blocker | How to Add |
|--------|---------|-----------|
| Reminder success % | Need total sent | `sent / checked * 100` — add to batch result |
| Parcel cache hit % | Not in DB | Add `lookup_count` + `cache_hit_count` to cache table |
| County failure % | Not tracked | Add county failure counter |
| Workforce utilization % | No shift hours tracked | Add from `shifts` table when shift tracking is complete |
| Route publish success count | Not tracked | Add `route_published` action count to `route_audit_log` query |
| Revenue/day and Revenue/week | Requires Stripe webhook | Set `STRIPE_WEBHOOK_SECRET` → `payments` table gets populated |
| Google API call count | Not tracked | Add counter to `googleAddressService.ts` |

---

## Derived Metrics (Calculable from Existing Data)

```
reminder_success_rate = sent_last_7d / max(sent_last_7d + failed_last_7d, 1) * 100
workforce_setup_pct = (active_employees - missing_schedules) / max(active_employees, 1) * 100
```

These are not yet computed server-side — the client can derive them from the raw counts.

---

## Recommended Next Step

Add a derived metrics layer to the metrics endpoint:
```typescript
reminder_success_rate: sent7d && failed7d != null 
  ? Math.round(sent7d / (sent7d + failed7d) * 100) 
  : null
```
