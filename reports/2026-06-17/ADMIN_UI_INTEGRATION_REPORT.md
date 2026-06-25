# Admin UI Integration Report
**Date:** 2026-06-17

Summary of every admin-facing UI change made across the three Platform Growth Phase 1 workstreams. No existing admin page was redesigned — every change is either a new page or an additive section/control on an existing one.

## Routing Automation

| Where | What |
|---|---|
| Route Planning → Day Planner tab | New "Automation Settings" button opens a dialog: master enable toggle, mode selector (manual_only/review_window/fully_automatic), review-window minutes, optional cutoff time, four safety toggles, Save button |

No new page, no new nav entry — this lives entirely inside the existing Route Planning page (`client/pages/admin/RoutePlanning.tsx`).

## Referral Program

| Where | What |
|---|---|
| New page `/admin/referrals` | Two tabs: **Referrals** (list with status, conversion value, inline status-update dropdown) and **Codes** (list of customer + partner codes, active toggle, "New Partner Code" dialog) |
| Nav | New "Referrals" entry added to the existing Finance nav group, directly under "Promotions" (`client/pages/admin/AdminLayout.tsx`) |

## CRM Phase 3

| Where | What |
|---|---|
| Lead Inbox (`/admin/leads`) | New "Assigned" column showing the current owner's name |
| Lead Detail (`/admin/leads/:id`) | New "Assign Lead" card (staff dropdown); new "Follow-ups" section (list with complete/skip actions + a create form); a referral-attribution badge and an "assigned to" badge added to the existing summary header — no existing card was restructured |

## Consistency Notes

- All three new/extended pages use `adminApi()` (the shared fetch helper with `AdminApiError`), matching the convention already established for Route Planning, Workforce, and Promos.
- The Referrals admin page mirrors the Promos page's exact tab/table/dialog structure — anyone already familiar with `/admin/promos` will recognize `/admin/referrals` immediately.
- No new top-level nav section was created — Referrals slots into "Finance" (next to Promotions); routing automation and CRM assignment/follow-ups live inside their existing pages. The admin dashboard's overall structure is unchanged.
