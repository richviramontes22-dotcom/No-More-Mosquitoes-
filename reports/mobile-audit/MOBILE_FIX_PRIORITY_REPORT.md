# Mobile Fix Priority Report

Nothing in this report was implemented as part of this sprint, except the homepage banner (Priority 0,
already shipped — included here for completeness). Per the sprint's scope, everything else is documented,
graded, and prioritized for a future pass.

## Priority 0 — Blocking issues

| Issue | Where | Status | Effort |
|---|---|---|---|
| Homepage banner unreadable | `client/components/sections/HeroSection.tsx` | **Fixed and shipped this sprint** — see `BANNER_VISIBILITY_AUDIT.md` | Done |
| Technician dashboard/assignments list always empty in production | `client/hooks/employee/useEmployeeAssignments.ts:45` — invalid PostgREST embedded-resource order syntax (`.order("appointments.scheduled_at", ...)` → needs `appointments(scheduled_at)` syntax) | **Not fixed** — confirmed live, blocks every technician's core workflow | Quick Fix (one line) |
| Admin Messages conversation view 400s on every open | `column messages.from does not exist` — a column-name mismatch in whatever client code selects `messages.from` | **Not fixed** — confirmed live | Quick Fix (rename the selected column to match the real schema) |
| `customer_service`/`sales` roles cannot be assigned in production | `profiles_role_check` CHECK constraint never widened to include these two roles, despite app code assuming they're assignable | **Not fixed** — confirmed live, zero accounts have ever held either role | Quick Fix (one migration) |
| `/admin/visits` has two dead server endpoints + a malformed query | `/api/admin/subscriptions/past-due`, `/needs-scheduling` fail outright; a `profiles` lookup contains a literal `null` in an `in.()` filter | **Not fixed** — confirmed live | Quick Fix to Moderate |

## Priority 1 — Revenue / customer conversion issues

| Issue | Where | Severity | Effort |
|---|---|---|---|
| All 4 public legal pages show "Document not yet published" | `/legal/terms`, `/legal/privacy`, `/legal/service-agreement`, `/legal/pesticide-consent` | High (compliance-adjacent — a visitor checking terms before booking sees nothing) | Quick Fix — publish via the existing `/admin/legal` tool, no code change |
| Slow perceived load on weak/rural mobile signal | Homepage, ~16s to first meaningful content / ~49s to full settle under simulated Slow 4G | Medium-High (this business's customers are checking from their yard — weak signal is plausible) | Moderate — likely the hero image carousel payload; investigate image sizing/format/lazy-load |
| Zero published blog content | `/blog`, `/blog/:slug` | Medium (SEO/content-marketing opportunity cost, not a broken-page issue — the empty state itself renders fine) | Moderate (content work, not code) |

## Priority 2 — Technician / customer-service operations issues

| Issue | Where | Severity | Effort |
|---|---|---|---|
| Admin + employee portal nav doesn't collapse below 1024px | `AdminLayout.tsx`, `EmployeeLayout.tsx` — `lg:grid-cols-[Npx_1fr]` with no mobile alternative | High — affects all 36 admin pages + all 10 employee-portal pages, every internal-staff mobile session | Moderate — needs a collapsible drawer/hamburger pattern for the portal nav, the single highest-reach fix in this whole audit |
| No sign-out control anywhere in the technician-facing employee portal | `client/pages/employee/*` | Medium | Quick Fix |
| Chat widget overlaps heading/body text on several pages | FAQ, Blog, Services, Service Area, Our Story, Guarantee, customer dashboard billing tab | Low-Medium | Quick Fix — add bottom padding/margin to the affected sections, or constrain the widget's safe-area |

## Priority 3 — Visual polish / accessibility

| Issue | Where | Severity | Effort |
|---|---|---|---|
| Map/chart/rich-editor touch usability not deep-tested | Service Areas, Route Planning, Territory Intelligence, Analytics, Content/Blog CMS editor | Low (unknown — flagged for follow-up, not a confirmed defect) | Moderate (needs a dedicated interactive-touch testing pass) |
| Landscape orientation not audited in this pass | All pages | Low | Moderate (re-run the same sweep with `orientation: landscape`) |

## Priority 4 — Nice-to-have improvements

| Issue | Where | Severity | Effort |
|---|---|---|---|
| `shifts.break_minutes` never actually aggregated from break events | `server/routes/employeeShifts.ts` | Low | Quick Fix |
| No geolocation captured at clock-in/clock-out | Same file | Low (separate from the assignment-status GPS pings, which do work) | Quick Fix |
| `employee_location_pings` is written but never read/visualized | Admin Employee Tracking page shows simulated data with an explicit "not built yet" banner | Low today (no one's relying on it); becomes higher priority if/when a technician app is built — see `TECHNICIAN_APP_ROADMAP.md` Phase 0 | Moderate |

## Suggested order of operations for a future sprint

1. Priority 0's three "Quick Fix" backend bugs (assignments order syntax, messages column, role constraint)
   — all are single-digit-line changes with outsized impact, and the role-constraint fix is a prerequisite
   for the customer_service/sales features to be usable by anyone at all.
2. Publish the four legal documents (zero code, just a content action).
3. Build the portal-nav mobile collapse (Priority 2's top item) — biggest reach of any *design* fix in this
   audit.
4. Investigate homepage Slow-4G payload weight.
5. Everything else, opportunistically.
