# Cost Monitoring Strategy Report
**Date:** 2026-06-02

---

## Current Cost Controls (In Place)

| Control | Mechanism | Default |
|---------|-----------|---------|
| Parcel cache | Avoids repeat GIS calls | Enabled |
| Regrid disabled | `ENABLE_REGRID_FALLBACK=false` | Off |
| In-flight dedup | `inFlight` map in parcelLookupService | Always on |
| Rate limiting | `rateLimit.ts` per IP | Always on |
| Reminder dry-run | `REMINDER_DRY_RUN=true` | Staging only |
| Reminder kill switch | `ENABLE_REMINDER_EMAILS=false` | Always accessible |

---

## Threshold Alerts (Recommended)

### Google Cloud Console
Set budget alerts in Google Cloud → Billing → Budgets:
- Geocoding API: Alert at $50/month
- Places API: Alert at $100/month

### Resend Dashboard
- Monitor email volume in Resend dashboard
- Set usage alerts if plan limits approach

### Twilio Console
- Monitor SMS sends in Twilio Console
- Enable usage alerts at 80% of monthly budget

### Stripe
- No direct cost per transaction for NMM (Stripe charges customers)
- Monitor failed payment rate in Stripe Dashboard → Radar

---

## Usage Aggregation Strategy

### Phase 1 (Now — Log-Based)
All parcel lookups log structured events. Netlify log drain can aggregate:
```
# Daily parcel lookups:
count events where event = "parcel.lookup.started"

# Cache hit rate:
count "parcel.lookup.cache_hit" / count "parcel.lookup.started"

# County failure rate:
count "parcel.lookup.county_failed" / count "parcel.county.lookup.start"
```

### Phase 2 (DB Counters — Future)
Add to `parcel_lookup_cache` table:
```sql
ALTER TABLE parcel_lookup_cache ADD COLUMN lookup_count int DEFAULT 0;
ALTER TABLE parcel_lookup_cache ADD COLUMN last_hit_at timestamptz;
```
Increment on every cache hit. Gives accurate cache hit rate without log parsing.

### Phase 3 (Admin Dashboard — Future)
Surface in `/api/admin/metrics/operations`:
- `parcel_cache_hit_rate`
- `google_geocoding_calls_7d`
- `reminder_cost_estimate_7d` (count × $0.001)

---

## Cost Estimate (Current Scale)

| Service | Volume | Estimate |
|---------|--------|---------|
| Google Geocoding | ~50 lookups/day | ~$0.25/day |
| County GIS | ~30 calls/day (after cache) | Free |
| Resend | ~10 reminder emails/day | $0.01/day |
| Supabase | Pro plan | $25/month fixed |
| Netlify | Starter or Pro | $19–$99/month |

**Total estimated operational cost: <$50/month at current scale**
