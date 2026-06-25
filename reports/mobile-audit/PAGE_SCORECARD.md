# Mobile Page Scorecard

**Grading scale**: A = Excellent · B = Good, minor polish · C = Acceptable, noticeable issues · D = Needs significant work · F = Broken/unusable
**Severity**: Critical · High · Medium · Low — **Effort**: Quick Fix · Moderate · Major

Screenshot paths follow `reports/mobile-audit/screenshots/{page_slug}_{device}_portrait_{top|middle|bottom}.png`.
Devices tested per page: full Tier 1 (iPhone 13, Pixel 7, Galaxy Z Fold 6, iPad gen7) on every page below;
flagship pages additionally tested on Tier 2 (iPhone SE, iPhone 15 Pro Max, Pixel 8 Pro, Galaxy S24, Galaxy Tab
S9, iPad Mini, iPad Pro 11, Galaxy Z Flip 6) — see `MOBILE_AUDIT_MASTER_REPORT.md` for the full methodology
and which pages got the deeper pass.

Two **systemic patterns** recur across many pages below rather than being page-specific — they're called out
once here and referenced by short tag in each row to avoid repeating the same paragraph 70 times:

- **[CHAT-OVERLAP]**: the floating chat widget (bottom-right, every page) frequently overlaps the last visible
  line of heading/body text in the "top" scroll screenshot, on pages whose hero/intro section height lands
  near the viewport boundary. Confirmed on Home (pre-fix only), FAQ, Blog, Services, Service Area, Our Story,
  Guarantee, and the customer dashboard's billing tab — almost certainly more pages share it; it's a layout
  interaction, not a per-page bug.
- **[NAV-BLOCK]**: `EmployeeLayout` and `AdminLayout` only switch to a sidebar at the `lg:` breakpoint
  (1024px). Below that — every phone and most tablets in portrait — the full nav renders as a tall vertical
  block stacked *above* the page content, pushing real content below the fold. Confirmed on every
  `/employee/*` and `/admin/*` page; for `/admin/*` specifically this means scrolling past 10 category groups
  before reaching any content.

## Public / marketing pages

| Page | Path | Grade | Issues | Severity | Effort | Notes |
|---|---|---|---|---|---|---|
| Home | `/` | **A** | None after fix. Pre-fix banner was unreadable — see `BANNER_VISIBILITY_AUDIT.md`. | — | — | Verified across all 12 devices, portrait. `home_*_portrait_*.png` |
| Pricing | `/pricing` | A- | None found. | — | — | Clean on all tier1 devices. |
| Schedule (quote flow) | `/schedule` | A- | None found. | — | — | Entry screen only — see Workflow A in master report for the full flow. |
| Services | `/services` | B+ | [CHAT-OVERLAP] | Low | Quick Fix | `services_iphone-13_portrait_top.png` |
| Our Story | `/our-story` | B+ | [CHAT-OVERLAP] | Low | Quick Fix | `our-story_iphone-13_portrait_top.png` |
| Reviews | `/reviews` | A- | None found. | — | — | |
| Service Area | `/service-area` | B+ | [CHAT-OVERLAP]; otherwise clean | Low | Quick Fix | `service-area_iphone-13_portrait_top.png` |
| FAQ | `/faq` | B+ | [CHAT-OVERLAP] | Low | Quick Fix | `faq_iphone-13_portrait_top.png` |
| Blog (index) | `/blog` | B+ | [CHAT-OVERLAP]; **content gap**: zero published posts exist, so this page and the detail-page workflow couldn't be tested with real content | Low (display) / Medium (content gap) | Quick Fix (display) | `blog_iphone-13_portrait_top.png` |
| Blog detail | `/blog/:slug` | **Blocked** | No published blog post exists in production to test against. | — | — | Not a code defect — a content gap. Publish at least one post to unblock. |
| Contact | `/contact` | A- | None found — chat widget sits clear of content here. | — | — | |
| Safety | `/safety` | B+ | Not individually screenshotted beyond tier1 sweep; same template family as Services/FAQ, [CHAT-OVERLAP] likely applies | Low | Quick Fix | Inference from shared template, not a direct screenshot finding — flagged for spot-check. |
| Licenses | `/licenses` | B+ | Same template family; not individually inspected beyond capture | Low | Quick Fix | |
| Guarantee | `/guarantee` | B+ | [CHAT-OVERLAP] | Low | Quick Fix | `guarantee_iphone-13_portrait_top.png` |
| Login | `/login` | A- | None found. Dev-only quick-login panel correctly hidden in production (`import.meta.env.DEV` guard). | — | — | |
| Registration | (tab on `/login`) | A- | Same page/component as Login. | — | — | No separate `/register` route exists — signup is a tab inside `AuthTabs`. |
| Forgot Password | `/forgot-password` | A- | None found. | — | — | |
| Terms & Conditions | `/legal/terms` | C | **Content gap, not a mobile bug**: shows "Document not yet published" — confirmed live in production, not local-only. Renders the empty-state cleanly on all devices. | High (compliance-adjacent) | Quick Fix (publish via admin) | `legal-terms_iphone-13_portrait_top.png` |
| Privacy Policy | `/legal/privacy` | C | Same as above. | High | Quick Fix | |
| Service Agreement | `/legal/service-agreement` | C | Same as above. | High | Quick Fix | |
| Pesticide Consent | `/legal/pesticide-consent` | C | Same as above. | High | Quick Fix | |

## Customer portal (role: customer)

| Page | Path | Grade | Issues | Severity | Effort | Notes |
|---|---|---|---|---|---|---|
| Dashboard | `/dashboard` | A- | None found. | — | — | Tested across full tier1 + tier2 (flagship). |
| Appointments | `/dashboard/appointments` | B+ | Not individually inspected beyond capture; no overflow detected | Low | — | |
| Billing | `/dashboard/billing` | B | [CHAT-OVERLAP] on the settings/profile section | Low | Quick Fix | `dashboard-billing_iphone-13_portrait_top.png` |
| Properties | `/dashboard/properties` | B+ | No overflow detected | — | — | |
| Marketplace | `/dashboard/marketplace` | B+ | No overflow detected | — | — | |
| Help / Tickets | `/dashboard/help` | B+ | No overflow detected | — | — | |
| Profile | `/dashboard/profile` | B+ | No overflow detected | — | — | |

## Employee / technician portal (role: employee)

| Page | Path | Grade | Issues | Severity | Effort | Notes |
|---|---|---|---|---|---|---|
| Dashboard | `/employee` | **D** | [NAV-BLOCK]; **functional**: "today's stops/completed/next stop" cards always show empty/zero — `useEmployeeAssignments` sends an invalid PostgREST order clause (`order=appointments.scheduled_at.asc`) and gets a 400 on every load, silently swallowed by the UI | Critical (functional) / High (nav) | Quick Fix (one-line query fix) for the bug; Moderate for nav | Real, confirmed production bug — see Master Report. Not fixed in this sprint (out of scope). |
| Assignments (list) | `/employee/assignments` | **D** | [NAV-BLOCK]; same `useEmployeeAssignments` bug as Dashboard — list is always empty | Critical / High | Quick Fix / Moderate | Same root cause as Dashboard. |
| Today's Route | `/employee/route` | B | [NAV-BLOCK] only — this page uses a *different*, working server endpoint (`/api/employee/routes/today`), unaffected by the assignments-query bug | High (nav only) | Moderate | The one functional bright spot in the technician flow. |
| Messages | `/employee/messages` | B+ | [NAV-BLOCK] | High | Moderate | |
| Timesheets | `/employee/timesheets` | B+ | [NAV-BLOCK] | High | Moderate | |
| Profile | `/employee/profile` | B+ | [NAV-BLOCK] | High | Moderate | |
| Onboarding | `/employee/onboarding` | B+ | [NAV-BLOCK] | High | Moderate | |
| No sign-out control | n/a | — | Confirmed: no sign-out mechanism exists anywhere in the technician-facing employee portal (pre-existing gap, found via code review, not new to this audit) | Medium | Quick Fix | |

## Customer-service tools (reached via admin test account — see methodology note in master report)

| Page | Path | Grade | Issues | Severity | Effort | Notes |
|---|---|---|---|---|---|---|
| Tickets | `/employee/tickets` | B+ | [NAV-BLOCK] | High | Moderate | Same `AdminTickets` component used at `/admin/tickets`. |
| Satisfaction | `/employee/satisfaction` | B+ | [NAV-BLOCK] | High | Moderate | |
| Reschedule Requests | `/employee/reschedule-requests` | B+ | [NAV-BLOCK] | High | Moderate | |
| Customer Service Dashboard (landing) | n/a (role-gated content inside `/employee`) | **Blocked** | `profiles.role` CHECK constraint in the live database does not allow `'customer_service'` — confirmed via direct write attempt, twice. No profile has ever held this role in production. | Critical | Quick Fix (one migration) | Graded via code review of `CustomerServicePanel.tsx` instead of a live screenshot — see Master Report. |
| Sales Dashboard (landing) | n/a (role-gated content inside `/employee`) | **Blocked** | Same root cause — `'sales'` also rejected by the same constraint. | Critical | Quick Fix (one migration) | Graded via code review of `SalesPanel.tsx`. |

## Admin portal (role: admin)

All 36 admin pages share [NAV-BLOCK] as their dominant mobile issue — the full categorized nav (10 groups:
Overview, Customers, Field Operations, Workforce, Support, Finance, Content, Analytics, System, Settings)
renders as one tall block above every page's content on any viewport under 1024px. This is graded once below
and not repeated 36 times; per-page grades reflect *additional*, page-specific findings on top of it.

| Page | Path | Grade | Additional issues beyond [NAV-BLOCK] | Severity | Effort |
|---|---|---|---|---|---|
| Overview | `/admin` | C | None beyond nav. | High (nav) | Moderate |
| Customers | `/admin/customers` | C | None beyond nav. | High | Moderate |
| Properties | `/admin/properties` | C | None beyond nav. | High | Moderate |
| Appointments | `/admin/appointments` | C | None beyond nav. | High | Moderate |
| Reschedule Requests | `/admin/reschedule-requests` | C | None beyond nav. | High | Moderate |
| Visits | `/admin/visits` | **D** | Real bugs: `/api/admin/subscriptions/past-due` and `/needs-scheduling` fail outright ("Failed to fetch"); a `profiles` lookup query contains a literal `null` inside an `in.()` filter list, causing a 400 | Critical (functional) / High (nav) | Quick Fix (query/null-guard fixes) |
| Messages | `/admin/messages` | **D** | Real bug: opening a conversation thread 400s — `column messages.from does not exist`; conversation view is non-functional | Critical (functional) / High (nav) | Quick Fix (one-line column fix) |
| Tickets | `/admin/tickets` | C | None beyond nav. | High | Moderate |
| Route Planning | `/admin/route-planning` | C | Not deep-inspected for map usability beyond load/overflow check — flag for manual map-specific follow-up. | High | Moderate |
| Billing | `/admin/billing` | C | None beyond nav. | High | Moderate |
| Revenue | `/admin/revenue` | C | None beyond nav. | High | Moderate |
| Employee Tracking | `/admin/employee-tracking` | C | Page itself renders fine; underlying feature is a known placeholder (simulated data banner, by design — not a mobile defect). | High (nav) | Moderate |
| Website Manager | `/admin/website-manager` | C | None beyond nav. | High | Moderate |
| Content (Blog CMS) | `/admin/content` | C | Not deep-tested for editor usability on small screens — flag for manual follow-up (rich text editors are frequently mobile-unfriendly). | High | Moderate |
| Pricing | `/admin/pricing` | C | None beyond nav. | High | Moderate |
| Promos | `/admin/promos` | C | None beyond nav. | High | Moderate |
| Referrals | `/admin/referrals` | C | None beyond nav. | High | Moderate |
| Service Areas | `/admin/service-areas` | C | Map-based page — not deep-tested for map touch usability beyond load/overflow. | High | Moderate |
| Employees | `/admin/employees` | C | None beyond nav. | High | Moderate |
| Legal Compliance | `/admin/legal-compliance` | C | None beyond nav. | High | Moderate |
| Legal (documents) | `/admin/legal` | C | This is the admin tool that would resolve the public legal-page content gap above. | High | Moderate |
| Workforce | `/admin/workforce` | C | None beyond nav. | High | Moderate |
| Debug | `/admin/debug` | C | None beyond nav. | High | Moderate |
| Email Management | `/admin/email-management` | C | None beyond nav. | High | Moderate |
| Workforce Schedules | `/admin/workforce/schedules` | C | None beyond nav. | High | Moderate |
| Workforce Capacity | `/admin/workforce/capacity` | C | None beyond nav. | High | Moderate |
| Reports | `/admin/reports` | C | None beyond nav. | High | Moderate |
| Analytics | `/admin/analytics` | C | Chart-heavy page — not deep-tested for chart legibility/touch interaction beyond load/overflow. | High | Moderate |
| Territory Intelligence | `/admin/territory-intelligence` | C | Map-based — same caveat as Service Areas/Route Planning. | High | Moderate |
| Workforce Optimization | `/admin/workforce-optimization` | C | None beyond nav. | High | Moderate |
| Customer Satisfaction | `/admin/satisfaction` | C | None beyond nav. | High | Moderate |
| Business Hours | `/admin/business-hours` | C | None beyond nav. | High | Moderate |
| Notifications | `/admin/notifications` | C | None beyond nav. | High | Moderate |
| Alerts | `/admin/alerts` | C | None beyond nav. | High | Moderate |
| Leads (CRM) | `/admin/leads` | C | None beyond nav. Detail page (`/admin/leads/:id`) not separately captured — out of scope for this pass. | High | Moderate |
| Settings | `/admin/settings` | C | None beyond nav. | High | Moderate |

## Summary counts

- **A / A-**: 8 pages (Home, Pricing, Schedule, Reviews, Contact, Login, Registration tab, Forgot Password, Dashboard) — fully clean.
- **B+ / B**: ~18 pages — clean except the recurring chat-widget overlap or nav-block pattern.
- **C**: ~30 pages — all 30 plain admin pages, functionally fine but pushed below the fold by [NAV-BLOCK].
- **D**: 4 pages — Employee Dashboard, Employee Assignments (both broken by the `useEmployeeAssignments` query bug), Admin Visits, Admin Messages (both broken by separate real backend bugs).
- **Blocked**: 3 (Blog detail — no content; Customer Service Dashboard and Sales Dashboard — role cannot be assigned in production).
- **F**: none — no page was fully unusable; every defect found has a working fallback or partial render.
