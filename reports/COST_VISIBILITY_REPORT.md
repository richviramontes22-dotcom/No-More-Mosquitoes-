# Cost Visibility Report
**Date:** 2026-06-02

---

## Currently Tracked (via Structured Logs)

| Metric | Where Tracked | How to Aggregate |
|--------|---------------|-----------------|
| Parcel lookup volume | `parcel.lookup.started` log events | Count events per day in Netlify logs |
| Parcel cache hit rate | `parcel.lookup.cache_hit` vs total | `cache_hits / total * 100` |
| Parcel county lookup count | `parcel.county.lookup.start` checkpoints | Count per day |
| Parcel fallback usage | `parcel.fallback.used`, `parcel.regrid.fallback.used` | Count per day |
| Parcel manual review rate | `parcel.lookup.manual_review` events | Count per day |
| Reminder sends (7d) | `notification_log` table, `status=sent` | `GET /api/admin/metrics/operations` |
| Reminder failures (7d) | `notification_log` table, `status=failed` | `GET /api/admin/metrics/operations` |
| Route publish validation failures | `route_audit_log` table | `GET /api/admin/metrics/operations` |
| Active subscriptions | `subscriptions` table | `GET /api/admin/metrics/operations` |

---

## Not Yet Tracked (Missing)

| Metric | Why Missing | How to Add |
|--------|-------------|-----------|
| Google Places API calls | No client-side tracking | Add counter in `googleAddressService.ts` |
| Google Geocoding API calls | No counter | Add increment in geocodeAddress() |
| County GIS call count by county | Not persisted to DB | Add to parcel_lookup_cache or log aggregation |
| Regrid API call count | Not persisted | Add checkpoint + counter |
| Twilio SMS sends | Not aggregated | Query `notification_log` by channel=sms |
| Stripe payment volume (MTD) | Requires webhooks | Set `STRIPE_WEBHOOK_SECRET` + payments table |
| Failed Stripe payments | Requires webhooks | Same as above |

---

## Cost Estimates (Per Service)

| Service | Typical Cost | Control Lever |
|---------|-------------|--------------|
| Google Geocoding | $5/1000 requests | Cache hits eliminate calls |
| Google Places (Autocomplete) | $2.83/1000 requests | Client-side; no server control |
| County GIS (OC, Riverside, SD) | Free (public API) | No cost |
| Regrid API | $0.01–$0.10/call | `ENABLE_REGRID_FALLBACK=false` (default) |
| Resend email | $0.001/email | `REMINDER_DRY_RUN=true` in staging |
| Twilio SMS | ~$0.0079/SMS | NullSmsProvider when not configured |
| Supabase | $25/month (Pro) | Read counts; optimize indexes |
| Netlify functions | 125k invocations free | Monitor function count |

---

## Cost Control Mechanisms (Already In Place)

1. **Parcel cache** — prevents repeat GIS calls for the same address
2. **`ENABLE_REGRID_FALLBACK=false`** — Regrid never called unless explicitly enabled
3. **In-flight deduplication** — concurrent identical lookups share one GIS call
4. **`REMINDER_DRY_RUN=true`** — prevents reminder sends in staging
5. **`ENABLE_REMINDER_EMAILS=false`** — emergency kill switch for all reminder sends
6. **Rate limiting** — `server/services/parcel/rateLimit.ts` limits parcel requests per IP

---

## Recommended Next Steps

1. **Add a daily log digest** — Netlify log drain to Datadog/Logtail to aggregate event counts
2. **Parcel lookup counter in DB** — add `lookup_count` to `parcel_lookup_cache` table, increment on every lookup (cache or miss)
3. **Google API cost alerting** — set budget alerts in Google Cloud Console
4. **Stripe payment tracking** — configure `STRIPE_WEBHOOK_SECRET` so the `payments` table gets populated
