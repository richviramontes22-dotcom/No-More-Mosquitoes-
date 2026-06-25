# Health Endpoints Report
**Date:** 2026-06-02
**File:** `server/routes/health.ts`

---

## Endpoint List

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/health` | Public | Lightweight uptime check — used by load balancers and monitors |
| `GET /api/health/database` | Public | Supabase connectivity + latency |
| `GET /api/health/stripe` | Public | Stripe config/mode (no API calls) |
| `GET /api/health/email` | Public | Resend config + reminder flag status |
| `GET /api/health/parcel` | Public | Parcel service config and supported counties |
| `GET /api/health/workforce` | Public | Workforce readiness summary |

All endpoints are **public** (no admin JWT required) because they expose only boolean presence/config status — never secrets.

---

## Response Shapes

### `GET /api/health`
```json
{
  "ok": true,
  "timestamp": "2026-06-02T10:00:00.000Z",
  "environment": "production",
  "requestId": "uuid",
  "version": "1.0.0"
}
```

### `GET /api/health/database`
```json
{ "ok": true, "latencyMs": 23, "requestId": "uuid" }
// On failure:
{ "ok": false, "latencyMs": 8001, "requestId": "uuid", "error": "Database unreachable" }
```

### `GET /api/health/stripe`
```json
{
  "ok": true,
  "configured": true,
  "mode": "live",
  "webhookConfigured": true,
  "publishableKeyConfigured": true,
  "requestId": "uuid"
}
```

### `GET /api/health/email`
```json
{
  "ok": true,
  "configured": true,
  "fromEmailConfigured": true,
  "reminderEmailsEnabled": true,
  "reminderDryRun": false,
  "requestId": "uuid"
}
```

### `GET /api/health/parcel`
```json
{
  "ok": true,
  "countyLookupEnabled": true,
  "regridFallbackEnabled": false,
  "googleServerKeyConfigured": true,
  "regridKeyConfigured": false,
  "testCountyDetection": "orange",
  "supportedCounties": ["orange", "riverside", "san_diego", "los_angeles"],
  "requestId": "uuid"
}
```

### `GET /api/health/workforce`
```json
{
  "ok": true,
  "workforceValidationEnabled": true,
  "routePublishGateEnabled": true,
  "activeTechnicians": 3,
  "missingSchedules": 0,
  "missingCapacityProfiles": 1,
  "setupComplete": false,
  "requestId": "uuid"
}
```

---

## Security Notes

- No API keys, tokens, or secrets are ever returned
- Keys are indicated by boolean presence only (`configured: true/false`)
- `/api/health` is safe for public uptime monitors (e.g., UptimeRobot, Netlify health checks)
- `/api/health/database` performs a single count query — not expensive
- `/api/health/workforce` makes 3 lightweight DB queries

---

## Usage for Uptime Monitoring

Configure your uptime monitor to check `GET /api/health` and alert on:
- Non-200 response
- `ok: false` in JSON body
- Response time > 5000ms

For deeper provider checks, monitor `/api/health/stripe` and `/api/health/email` separately.
