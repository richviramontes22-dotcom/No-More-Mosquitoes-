# Admin Workforce Hub UI Report
**Date:** 2026-06-01
**File:** `client/pages/admin/Workforce.tsx`
**Route:** `/admin/workforce`
**Nav:** Admin sidebar → Workforce → Workforce

---

## Overview

Dashboard-style hub page for the entire workforce management system. Shows real-time status and provides quick navigation to sub-sections.

---

## Status Banner

Green when `setup_complete = true` (all active techs have schedules + capacity profiles):
> "Workforce ready — 3 active technicians configured"

Amber when incomplete:
> "Workforce setup incomplete — 2 technician profile(s) need attention"
> "Route planner will use defaults for unconfigured technicians."

---

## Upcoming Blackouts Card

Shown when `upcoming_blackouts.length > 0`. Amber card listing dates and reasons. Admin can see upcoming company-wide closed days at a glance.

---

## Navigation Cards (4-card grid)

| Card | Route | Badge When |
|------|-------|-----------|
| Technician Schedules | `/admin/workforce/schedules` | "N missing" (amber) if technicians lack templates |
| Capacity Settings | `/admin/workforce/capacity` | "N missing" (amber) if technicians lack profiles |
| Time Off | `/admin/workforce/time-off` | "Coming Sprint B" (gray) |
| Availability Calendar | `/admin/workforce/calendar` | "Coming Sprint D" (gray) |

Cards link to sub-pages. Chevron icon indicates navigable.

---

## Data Source

`GET /api/admin/workforce/overview` — loaded on mount. Shows live counts for missing schedules and capacity profiles.
