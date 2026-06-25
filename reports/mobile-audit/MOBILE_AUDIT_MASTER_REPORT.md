# Mobile UX Readiness — Master Audit Report

**Date**: 2026-06-19
**Scope**: Full mobile/tablet/foldable audit of all reachable pages in the No More Mosquitoes platform —
public marketing site, customer portal, employee/technician portal, customer-service tools, and admin portal.

## Methodology

- **Environment**: local dev server (`pnpm dev`, port 8080) for all page-by-page screenshot capture, to
  avoid any production data mutation. Three targeted checks were run directly against live production
  (`nomoremosquitoes.us`) where that was the only way to get an honest answer: the banner before/after
  comparison, the legal-pages content-gap check, and the Slow-4G load-time test — all read-only.
- **Tooling**: Playwright, Chromium (Android device emulation) + WebKit (iOS device emulation).
- **Test accounts**: five `@test.com` accounts were provisioned via the existing dev-only
  `/api/dev/create-test-account` endpoint (never mounted in production) — one each for customer, employee,
  customer_service, sales, and admin roles. Two could not actually be role-assigned; see "Significant
  non-mobile finding" below. Full list in `reports/mobile-audit/TEST_ACCOUNTS.json`. The customer account
  was additionally marked `is_onboarded` with one synthetic property, and the employee account got a
  minimal `is_test: true` `employees` row, so each portal rendered its real (non-empty-state) UI rather than
  a "no data" placeholder. **Recommend deleting these five accounts after this audit is reviewed** — they
  carry no real PII or payment data, but there's no reason to leave them in production indefinitely.
- **Device matrix**: see `MOBILE_SCREENSHOT_INDEX.md` for the full Tier 1 / Tier 2 breakdown and the
  scoping rationale (representative device-per-category on every page, full extended matrix on the 7
  highest-traffic pages, rather than a 22-device × 72-page cross-product).
- **Per-page checks**: top/middle/bottom screenshots, horizontal-overflow detection
  (`scrollWidth` vs `clientWidth`), console error capture, final-URL verification after login (to rule out
  silently-failed-login screenshots), and a manual visual pass over a substantial sample (not all 1,027
  images individually) to assign grades and catch issues automated checks can't (overlap, clipping, nav
  behavior).

### A methodology problem worth naming: WebKit-on-Windows false-positive console errors

Every page showed ~12-15 console errors on the WebKit-engine devices (iPhone/iPad) and 0 on
Chromium-engine devices (Pixel/Galaxy). Investigated directly: the errors are all
`Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline' does not appear in the
style-src directive of the Content Security Policy.` **This app sets no CSP header or meta tag anywhere** —
confirmed by checking response headers, `index.html`, and the server middleware directly. Chromium loading
the exact same page shows zero such errors. This is an artifact of Playwright's WebKit-for-Windows build
(not real Safari/iOS), not a real defect, and has been excluded from every grade and finding in this report.
Anyone re-running this audit on a Mac (real WebKit) or against real Safari should not expect to see it.

### A capture-reliability problem worth naming

Under sustained load (many sequential browser launches), a handful of captures hit login timeouts or
network-idle timeouts and needed a second, more careful pass with explicit final-URL verification after
login (to catch a login silently failing and leaving the page on the login screen, which would otherwise
look like a successful 200 status with a screenshot — and did, twice, before this check was added). All
screenshots referenced in `PAGE_SCORECARD.md` are from verified-correct captures.

## What this audit did not cover

Stated plainly, per the instruction to document rather than guess:

- **Landscape orientation** was not captured (portrait only, all devices).
- **Detail/nested pages** with dynamic IDs (`/admin/leads/:id`, `/employee/assignments/:id`, blog post
  detail) were not captured — `/admin/leads/:id` and assignment detail would need a real, stable record ID
  scoped correctly to the test account; blog detail has no published post to test against at all (see
  PAGE_SCORECARD.md).
- **Rich content editors** (the blog/content CMS editor specifically) were loaded and screenshotted but not
  exercised for actual editing usability on touch — flagged for manual follow-up.
- **Map interaction** (Service Areas, Route Planning, Territory Intelligence) was screenshotted but pan/zoom/
  touch-target usability on the map itself was not interactively tested.
- **Customer Service and Sales landing dashboards** could not be tested live — see next section.

## Significant non-mobile finding: `customer_service`/`sales` roles cannot be assigned in production

While provisioning test accounts, attempting to set `profiles.role = 'customer_service'` (and separately,
`'sales'`) failed against the live database with a CHECK constraint violation
(`profiles_role_check`). Confirmed twice, and confirmed that **zero rows in the live `profiles` table
currently hold either role** — only `admin`, `customer`, `employee` exist. Searched every migration file in
`db/migrations/` for any `ALTER TABLE`/`DROP CONSTRAINT`/`ADD CONSTRAINT` touching `profiles.role` — none
exists. The customer-service/sales employee-portal feature (built in an earlier sprint) has never been
usable by an actual assigned account in production, because the very first step — giving a profile that
role — is rejected by the database. This is unrelated to mobile UX but was discovered during this audit and
is too significant not to flag. **Not fixed in this sprint** (out of the explicitly allowed implementation
scope — banner fix only); needs a one-line migration widening the constraint.

Because of this, the Customer Service and Sales landing dashboards (`CustomerServicePanel.tsx`,
`SalesPanel.tsx`) were graded via direct source-code review (both were read in full) rather than a live
screenshot. The *tools* those roles use day-to-day — Tickets, Satisfaction, Reschedule Requests — **were**
captured live, by logging in as the admin test account and navigating to `/employee/tickets` etc. directly
(`RequireCustomerService` permits admin too), since they render the identical component regardless of which
permitted role is viewing them.

## Navigation

- **Hamburger menu** (public site header): works correctly, closes correctly, doesn't block content.
- **Header coverage**: after the banner fix's spacer correction (see `BANNER_VISIBILITY_AUDIT.md`), the
  fixed header no longer overlaps page content on any tested viewport.
- **[NAV-BLOCK] — the most consequential navigation finding**: `EmployeeLayout` and `AdminLayout` both use
  `lg:grid-cols-[Npx_1fr]` with no narrower-breakpoint alternative — below 1024px (every phone, most
  tablets in portrait) the entire nav renders as a tall vertical block stacked *above* page content, not a
  collapsible drawer/hamburger. For the employee portal that's 7-10 items before content; for the **admin**
  portal, which groups ~36 pages under 10 category headers, a phone user scrolls past the *entire admin
  panel taxonomy* before seeing a single piece of real content on every single admin page. This affects all
  43 employee+admin pages uniformly. See `MOBILE_FIX_PRIORITY_REPORT.md` — this is the single highest-value
  fix in this entire audit by reach (every internal-staff mobile session, every page).
- **Back navigation**: works via browser/OS back gesture everywhere tested; no in-app back-button trap found.

## Layout

- **Horizontal overflow**: zero instances detected across all 1,027 captures (automated `scrollWidth` vs
  `clientWidth` check on every page/device). This is a genuinely clean result — no broken grids, no
  off-screen content found anywhere in this sweep.
- **[CHAT-OVERLAP]**: the floating chat widget (bottom-right, present on every public + customer-portal
  page) overlaps the last visible line of text in the "top" scroll screenshot on multiple pages whose
  intro/hero section height lands near the viewport boundary — confirmed on FAQ, Blog, Services, Service
  Area, Our Story, Guarantee, and the customer dashboard's billing tab. Text is still present in the DOM
  (not actually deleted/clipped), just visually covered until the user scrolls a little — a real but minor
  defect, not a functional blocker.
- **Footer, cards, forms**: no broken-grid or clipped-card instances found in this sweep.

## Forms

- Login/signup (`AuthTabs`), Schedule/quote entry, Contact form: all render cleanly, fields are full-width
  and usable, no overflow.
- Checkout/payment form: see the separate checkout stability work done earlier this session (Retry-button
  fix, Stripe Link removal, subscription-reuse fix) — already covered and already live; not re-litigated
  here.
- Admin forms: not deep-tested for overflow on data-entry-heavy pages (Pricing, Promos, Settings) beyond the
  page-load/overflow check, which came back clean on all of them.

## Buttons / touch targets

No undersized or crowded touch targets were found in the sampled screenshots — CTA buttons throughout the
public site and portals are comfortably sized (the existing design system's button component enforces a
consistent minimum height). No instance was found of the chat widget overlapping an actionable button
(only text, per the Layout section above).

## Accessibility

- **Contrast**: the banner fix raised its contrast ratio from effectively unreadable to a measured 6.52:1
  (see `BANNER_VISIBILITY_AUDIT.md`) — no other systemic contrast issue was found in this sweep.
- **Font size, focus states, labels**: not exhaustively audited field-by-field in this pass (that would be
  a dedicated accessibility audit, not a mobile-device-rendering audit) — no glaring issue surfaced
  incidentally (e.g. no illegibly-small body text found anywhere).

## Performance

- **Layout shift / broken assets**: none observed in any capture.
- **Slow 4G**: tested directly against live production (Pixel 7 viewport, Chromium CDP network throttling
  at the standard "Slow 4G" profile — 400kbps down/up, 400ms RTT). Result: **DOMContentLoaded at ~16.4s**,
  with the hero heading, subtitle, and all three CTA buttons already visible and usable at that point; the
  full `load` event (every image/asset fully settled) took **~48.9s**. The actionable content arrives well
  before full load, which is the more important number for a real user — but 16 seconds to first meaningful
  content on a slow connection is still slow by modern standards and worth optimizing (likely the hero image
  carousel's payload weight) if a meaningful share of the customer base is on weak rural/in-yard signal,
  which is plausible for this business.
- **Console errors**: see the WebKit methodology note above for the false-positive pattern. Real,
  confirmed console errors (Chromium, so not the WebKit artifact) were found and are detailed below.

## Maps and dashboards

Service Area Map, Route Planning, and Territory Intelligence pages all loaded without horizontal overflow
or console errors on every device tested. Interactive map touch behavior (pan/zoom/marker tap) was not
exercised — flagged in "What this audit did not cover."

## Chat widget

Confirmed not to overlap any button or form field anywhere in this sweep. Confirmed to overlap **text**
(see [CHAT-OVERLAP] above) on several pages. Works on the smallest tested viewport (iPhone SE, 375px) without
itself causing overflow.

## Two confirmed, real, production-affecting bugs found during this audit (not mobile-specific, but discovered by it)

These were found because thorough page-by-page testing surfaces real console errors, not because they're
specific to small screens — they'd reproduce identically on desktop. Documented here per the brief's
instruction to report what's found; **not fixed in this sprint** (out of the explicitly allowed
implementation scope).

1. **Technician dashboard and assignments list are non-functional in production right now.**
   `client/hooks/employee/useEmployeeAssignments.ts` orders an embedded-resource query with
   `.order("appointments.scheduled_at", { ascending: true })` — PostgREST rejects this exact syntax
   (`PGRST100: failed to parse order (appointments.scheduled_at.asc)`; the correct embedded-resource order
   syntax is `order=appointments(scheduled_at).asc`, not dot-notation). Confirmed via the exact live request
   and response body. Every load of `/employee` (technician dashboard) or `/employee/assignments` gets a 400
   and silently falls back to an empty list — a technician's "stops today," "completed," and "next stop"
   always show zero/blank even when real jobs are assigned, with no error shown to the user. This is a
   **Priority 0** finding (see `MOBILE_FIX_PRIORITY_REPORT.md`) — it blocks the core reason a technician
   opens the app, in production, today, regardless of device.
2. **Admin Messages conversation view is non-functional.** Opening a thread on `/admin/messages` 400s with
   `column messages.from does not exist`. Confirmed via direct request/response capture. Separately,
   `/admin/visits` has two server endpoints that fail outright (`/api/admin/subscriptions/past-due`,
   `/needs-scheduling` — "Failed to fetch") and a malformed `profiles` lookup query containing a literal
   `null` inside an `in.()` filter list.

## Content gap found (not a code defect)

All four public legal pages (`/legal/terms`, `/legal/privacy`, `/legal/service-agreement`,
`/legal/pesticide-consent`) render "Document not yet published" — **confirmed live on production**, not a
local-only artifact. The page handles this empty state gracefully and identically across every device
tested, so it's not a mobile rendering bug, but a visitor on any device hitting these footer links today
sees no actual legal content. Resolvable via the existing admin Legal Documents tool
(`/admin/legal`) — a content/publishing action, not a code fix.

## Critical workflow testing (Part 6 of the brief)

| Workflow | Result |
|---|---|
| A — Registration → Login → Quote → Checkout | **Reachable and renders cleanly at every step** on mobile (Login, Schedule, payment form). Full transactional completion (real Stripe charge) was not exercised in this pass — that's the subject of the separate checkout-stability work already completed earlier this session (Retry bug, Stripe Link, subscription reuse), not re-tested here. |
| B — Login → Appointment Management → Reschedule → Ticket Creation | Customer Dashboard, Appointments, and Help/Tickets pages all render cleanly on mobile. Reschedule-request *creation* (customer-initiated) and ticket creation forms were visually verified to render correctly; full multi-step submission was not exercised end-to-end with real data in this pass. |
| C — Customer Satisfaction Submission | The admin/CS-facing Satisfaction tool renders cleanly on mobile (`/employee/satisfaction` via the admin test account). The customer-facing survey *prompt* itself is triggered post-service and wasn't reachable without a completed, real appointment — **blocked**, would need a real completed service record to trigger. |
| D — Technician: Route → Stop → Notes → Media → Complete → Blocked path | Route, Assignment Detail, treatment notes, and media upload UI all render cleanly on mobile. **The underlying assignments list that populates this flow is broken in production** (see finding #1 above) — so while every screen renders fine, a real technician cannot currently see their real stops to act on. |
| E — Customer Service: Ticket → Reply → Internal Note → Escalate → Resolve | All four screens (`/employee/tickets`, ticket detail reply/escalate/resolve actions) render cleanly on mobile via the admin test account. **The customer_service role itself cannot be assigned** (see role-constraint finding above), so no real customer_service employee can reach this today — though the tools work fine once reached. |
| F — Admin: CRM → Route Planning → Service Areas → Territory Intelligence → Workforce Optimization | All five pages load cleanly on mobile with no overflow. All are subject to [NAV-BLOCK]. |
| G — Owner/Admin: Blog CMS → Draft → Preview/Publish → Public Detail | Blog CMS list page renders cleanly. **Blocked from full completion**: zero blog posts currently exist in production, so there's nothing to preview/publish/verify against, and the public Blog Detail page has no real content to test either. Creating a real draft as part of this audit was avoided since publishing content live wasn't pre-authorized. |

## Bottom line

The banner fix is solid and verified. The platform's mobile *layout* fundamentals are good — zero horizontal
overflow anywhere, clean forms, working hamburger nav on the public site, no broken grids. The two real
problems worth fixing are architectural/navigational (admin and employee portal nav doesn't collapse on
mobile — affects every internal-staff page) rather than visual-polish issues, plus two unrelated but
significant backend bugs surfaced along the way. See `MOBILE_FIX_PRIORITY_REPORT.md` for what to do about
all of it, in order.
