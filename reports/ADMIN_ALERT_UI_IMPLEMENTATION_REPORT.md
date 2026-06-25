# Admin Alert UI Implementation Report
**Date:** 2026-05-30
**Phase:** 3 — Admin Alert UI

## Summary
Full admin alert UI implemented: bell badge in SiteHeader, dropdown with recent alerts, dedicated alerts page, and data hooks.

## Files Created

| File | Purpose |
|------|---------|
| `client/hooks/admin/useAdminAlerts.ts` | Data hooks for alert polling and actions |
| `client/pages/admin/Alerts.tsx` | Full alert management page at `/admin/alerts` |

## Files Modified

| File | Change |
|------|--------|
| `client/components/layout/SiteHeader.tsx` | Added `AdminAlertBell` component + bell icon import |
| `client/App.tsx` | Added `/admin/alerts` route + `AdminAlerts` import |
| `client/data/navigation.ts` | Added "Alerts" to `ADMIN_NAV_LINKS` |
| `client/pages/admin/AdminLayout.tsx` | Added "System" nav group with Alerts, Notifications Log, Business Hours |

## 3a. Alert Bell in SiteHeader

`AdminAlertBell` component:
- Polls `/api/admin/alerts/counts` every 60s via `useAdminAlertCounts(isAdmin)`
- Badge shows total count, colored red (critical), amber (warning), blue (info)
- On click, shows dropdown with 5 most recent unresolved alerts
- Each row: severity badge, title, relative time, Acknowledge button
- "View all" link to `/admin/alerts`
- Backdrop overlay to close dropdown
- Only renders when `isAdmin === true`
- Positioned in header right section, hidden on mobile (md:block)

## 3b. Admin Alerts Page (`/admin/alerts`)

Features:
- Severity filter tabs: All / Critical / Warning / Info
- Unresolved alerts list with AlertRow components
- Each row: severity badge, title, body, entity info, relative time, Ack + Resolve buttons
- Empty state with green checkmark when all clear
- Collapsible "Show resolved alerts" section (fetches separately)
- Resolved alerts shown with strikethrough + timestamp

## 3c. Data Hooks (`client/hooks/admin/useAdminAlerts.ts`)

Exports:
- `useAdminAlertCounts(enabled)` — polls every 60s, returns `AdminAlertCounts`
- `useAdminAlerts(options)` — fetches with severity/limit/unresolvedOnly filters
- `acknowledgeAlert(id)` — POST /api/admin/alerts/:id/acknowledge
- `resolveAlert(id)` — POST /api/admin/alerts/:id/resolve

All use `supabase.auth.getSession()` for Bearer token injection. Fire-and-forget error handling — auth errors silently ignored (user may not be admin).

## Route Registration

`/admin/alerts` registered in `App.tsx` under the `RequireAdmin > AdminLayout` route tree.

Admin sidebar `AdminLayout.tsx` has a new "System" group with Alerts, Notifications Log, and Business Hours.
