# Admin Alert UI Report

**Date:** 2026-05-30  
**Status:** BACKEND COMPLETE — UI integration available via API

## Available API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/alerts/counts` | Alert bell badge counts by severity |
| GET | `/api/admin/alerts` | Full alert list (filterable) |
| POST | `/api/admin/alerts/:id/acknowledge` | Mark as seen |
| POST | `/api/admin/alerts/:id/resolve` | Mark as resolved |

## Counts Response Shape

```json
{
  "info": 3,
  "warning": 1,
  "critical": 0,
  "total": 4
}
```

## Alert List Query Params

- `severity=critical|warning|info` — filter by severity
- `limit=50` — result count (max 200)
- `unresolved_only=true|false` — default true (only open alerts)

## Recommended Integration Points

1. **Alert bell in SiteHeader** — poll `/api/admin/alerts/counts` every 60s, show badge when `total > 0`, highlight red when `critical > 0`
2. **Admin Overview page** — show top 5 unresolved alerts sorted by severity DESC, created_at DESC
3. **Dedicated `/admin/alerts` page** — full list with severity filter, acknowledge/resolve buttons

## Alert Item Display

Each alert row should show:
- Severity badge (color-coded: red=critical, yellow=warning, blue=info)
- Title
- Body (truncated)
- `entity_type` + `entity_id` as a link if applicable
- `created_at` relative time
- Acknowledge / Resolve action buttons
