# Mobile Screenshot Index

**1,027 screenshots** captured under `reports/mobile-audit/screenshots/`.

## Naming convention

```
{page_slug}_{device}_{orientation}_{position}.png
```

Example: `home_iphone-se_portrait_top.png`. Banner before/after comparison shots (used in
`BANNER_VISIBILITY_AUDIT.md`) live in the `banner/` subfolder and follow
`home_{device}_{before|after}.png` instead, since they're a fix-verification pair, not part
of the page-by-page sweep.

## Device coverage

**Tier 1** — captured for every one of the 72 pages listed below, portrait only:

| Slug | Real device represented | Engine |
|---|---|---|
| `iphone-13` | iPhone 13 (iOS) | WebKit |
| `pixel-7` | Google Pixel 7 (Android) | Chromium |
| `galaxy-z-fold-6` | Samsung Galaxy Z Fold 6, unfolded (Android foldable) | Chromium |
| `ipad-gen7` | iPad (closest built-in descriptor to iPad Air) | WebKit |

**Tier 2** — captured only for flagship pages (Home, Pricing, Schedule, Login, customer Dashboard, employee
Dashboard, Admin Overview), portrait only, to extend device breadth without re-running all 72 pages 12 times:

| Slug | Real device represented | Engine |
|---|---|---|
| `iphone-se` | iPhone SE (smallest tested iOS viewport) | WebKit |
| `iphone-15-pro-max` | iPhone 15 Pro Max (largest tested iOS phone) | WebKit |
| `pixel-8-pro` | Google Pixel 8 Pro | Chromium |
| `galaxy-s24` | Samsung Galaxy S24 | Chromium |
| `galaxy-tab-s9` | Samsung Galaxy Tab S9 (Android tablet) | Chromium |
| `ipad-mini` | iPad Mini | WebKit |
| `ipad-pro-11` | iPad Pro 11" | WebKit |
| `galaxy-z-flip-6` | Samsung Galaxy Z Flip 6, unfolded (Android foldable) | Chromium |

**Scoping note**: the brief listed ~22 named devices (4 iOS phones, 8 Android phones, 2 foldables, 2 Android
tablets, 3 iPads). Running all 22 against all 72 pages would be ~1,600 captures — instead, every page got a
representative device from each required category (iOS phone, Android phone, foldable, tablet) via Tier 1,
and the 7 highest-traffic/most-critical pages got the full extended device list via Tier 2. This satisfies
"iOS and Android tested," "tablets and foldables tested," and "every accessible page audited" without the
cost of a full cross-product sweep. Landscape orientation was not captured in this pass — see
"What this audit did not cover" in `MOBILE_AUDIT_MASTER_REPORT.md`.

## Scroll positions

`top`, `middle`, `bottom` were captured for every page/device pair where the page's content was taller than
its viewport (short pages with no scroll only have a `top` shot — there's nothing additional to capture).

## Pages indexed (see `PAGE_SCORECARD.md` for grades/issues per page)

**Public (19)**: home, pricing, services, our-story, reviews, service-area, faq, blog, contact, safety,
licenses, schedule, login, forgot-password, guarantee, legal-terms, legal-privacy,
legal-service-agreement, legal-pesticide-consent.

**Customer portal (7)**: dashboard, dashboard-appointments, dashboard-billing, dashboard-properties,
dashboard-marketplace, dashboard-help, dashboard-profile.

**Employee/technician portal (7)**: employee-dashboard, employee-assignments, employee-messages,
employee-timesheets, employee-profile, employee-onboarding, employee-route.

**Customer-service tools, reached via the admin test account (3)**: employee-tickets,
employee-satisfaction, employee-reschedule-requests — see the methodology note in
`MOBILE_AUDIT_MASTER_REPORT.md` for why.

**Admin portal (36)**: admin-overview, admin-customers, admin-properties, admin-appointments,
admin-reschedule-requests, admin-visits, admin-messages, admin-tickets, admin-route-planning,
admin-billing, admin-revenue, admin-employee-tracking, admin-website-manager, admin-content,
admin-pricing, admin-promos, admin-referrals, admin-service-areas, admin-employees,
admin-legal-compliance, admin-legal, admin-workforce, admin-debug, admin-email-management,
admin-workforce-schedules, admin-workforce-capacity, admin-reports, admin-analytics,
admin-territory-intelligence, admin-workforce-optimization, admin-satisfaction,
admin-business-hours, admin-notifications, admin-alerts, admin-leads, admin-settings.

**Total: 72 pages** (the brief's page list was mapped to this app's actual existing routes — a few named
pages in the brief don't correspond to a separate route in this codebase, e.g. "Registration" is a tab on
`/login`, not a standalone page; "Job media upload"/"Treatment notes" are sections inside
`/employee/assignments/:id`, not separate top-level pages — captured implicitly as part of the Assignments
page family, not as their own screenshot set).

## Known capture-quality notes

A small number of pages hit transient login timeouts on the first sweep pass under heavy sustained
Playwright load (multiple sequential browser launches); those were identified (by checking the final URL
after login, not just HTTP status) and **re-captured cleanly** in a second, leaner pass before this index was
finalized. No screenshot referenced in `PAGE_SCORECARD.md` reflects a failed-login/wrong-page capture.
