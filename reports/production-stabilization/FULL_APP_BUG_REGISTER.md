# Full-App Bug Register

| ID | Feature | Page/Endpoint | Role | Severity | Repro | Expected | Actual | Evidence | Fix | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| BUG-01 | Checkout display | `ScheduleFlow.tsx` "Due Today" + pay button | Customer | High (revenue/trust) | Apply a 100%-off one-time-service promo code | "$0.50" displayed | "$1" displayed (`(0.5).toFixed(0)` rounds up) | Verified directly in Node: `fmtCents(50)` -> `"$1"` | `STRIPE_DISPLAY_FORMAT_FIX_REPORT.md` | **Fixed** |
| BUG-02 | Checkout display | `CheckoutReview.tsx` (marketplace) | Customer | Medium | Apply a 100%-off marketplace promo | Displayed total matches what Stripe charges | Displayed `$0.00`, Stripe charges $0.50 (floor mismatch, not a rounding bug) | Code review — `Math.max(0,...)` vs. backend's `Math.max(50,...)` | `STRIPE_DISPLAY_FORMAT_FIX_REPORT.md` | **Fixed** |
| BUG-03 | Contact info update | `Profile.tsx` -> `profiles` table | Customer | Critical (100% repro) | Update name/email/phone in account settings | Save succeeds | `400 PGRST204` — entire update rejected, every time, for every customer | Reproduced live via real account JWT | `CONTACT_UPDATE_FAILURE_REPORT.md` | **Fixed** |
| BUG-04 | Quote flow | `QuoteWidgetSection.tsx` / `/api/parcel/quote` | Public | High (service-area integrity) | Get a quote for an address outside the active service area | Friendly "not in your area" message, no pricing, no checkout path | Full real quote + manual-acreage fallback + path to checkout, regardless of coverage | Code review + live confirmation of the underlying (previously fire-and-forget-only) service-area check | `OUT_OF_SERVICE_AREA_QUOTE_FIX_REPORT.md` | **Fixed** |
| BUG-05 | Waitlist signup | `AddressCheckerSection.tsx` | Public | Medium | Submit email on the "not in your area" panel | Lead/demand event recorded | Silently did nothing — no API call existed | Code review (`handleWaitlistSubmit` had no `fetch`) | `OUT_OF_SERVICE_AREA_QUOTE_FIX_REPORT.md` | **Fixed** |
| BUG-06 | Technician assignments | `useEmployeeAssignments.ts` | Technician | Critical (100% repro) | Load Assignments page or Dashboard as a technician | Real assignment list | Empty — query throws `PGRST100` | Reproduced directly against live REST API | `MOBILE_AUDIT_PRIORITY_FIXES_REPORT.md` item A | **Fixed** |
| BUG-07 | Admin messages | `admin/Messages.tsx` | Admin | Critical (100% repro) | Open a message thread in the admin panel | Thread loads | `400 42703 column messages.from does not exist` | Reproduced directly against live REST API | `MOBILE_AUDIT_PRIORITY_FIXES_REPORT.md` item B | **Fixed** |
| BUG-08 | Customer messages | `dashboard/Messages.tsx` | Customer | Critical (100% repro) | Open a message thread in the customer dashboard | Thread loads | Same `42703` failure — identical bug, different file, not in the original report | Reproduced directly | `MOBILE_AUDIT_PRIORITY_FIXES_REPORT.md` item B | **Fixed** |
| BUG-09 | Customer help/messages | `dashboard/Help.tsx` | Customer | Critical (100% repro) | Open a message thread from the Help page | Thread loads | Same `42703` failure — a third occurrence | Reproduced directly | `MOBILE_AUDIT_PRIORITY_FIXES_REPORT.md` item B | **Fixed** |
| BUG-10 | Role assignment | `profiles.role` CHECK constraint | Admin (assigning roles) | Critical (blocks 4 of 6 staff roles) | Set a profile's role to `technician`, `dispatcher`, `sales`, or `customer_service` | Role saves | `23514` constraint violation — all four rejected | Empirically tested every role value live | `MOBILE_AUDIT_PRIORITY_FIXES_REPORT.md` item C; migration `2026-06-22_widen_profiles_role_check.sql` | **Fixed in code/migration — requires manual SQL Editor application before live** |
| BUG-11 | Employee portal access | `RequireEmployee.tsx` | Dispatcher | High | Log in as a `dispatcher`-role account | Lands in employee portal | Bounced to `/dashboard` — `dispatcher` missing from `EMPLOYEE_ROLES` | Code review | Same migration's PR, `RequireEmployee.tsx` | **Fixed** |
| BUG-12 | Staff login redirect | `AdminLogin.tsx` | customer_service / sales | High | Log in at `/admin/login` as customer_service or sales | Redirect to `/employee` | Redirect to `/admin/customer-service` or `/admin/sales` — both routes deleted in an earlier session | Code review | Same item | **Fixed** |
| BUG-13 | Staff login redirect | `Login.tsx` | technician / dispatcher / customer_service / sales | High | Log in at the regular `/login` page as any of these roles | Redirect to `/employee` | Fell through to customer onboarding/dashboard logic | Code review, caught by TS narrowing once fixed | Same item | **Fixed** |
| BUG-14 | Admin visits | `Visits.tsx` | Admin | Low today / Critical if triggered | Load Visits with any completed appointment missing `user_id` or `property_id` | Page loads, row shown without customer/property info | Entire profiles/properties lookup throws `22P02 invalid input syntax for type uuid: "null"`, breaking the whole page | Reproduced the exact query against live REST API; no row currently triggers it | `MOBILE_AUDIT_PRIORITY_FIXES_REPORT.md` item D | **Fixed (defensive — not currently active)** |
| BUG-15 | Mobile nav | `AdminLayout.tsx` / `EmployeeLayout.tsx` | Admin, Employee (all sub-roles) | High (mobile usability) | View any admin/employee page below 1024px width | Collapsed hamburger nav | Full sidebar (up to 30+ links) renders as a block above page content on every page | Original mobile audit finding; visually reproduced | `MOBILE_AUDIT_PRIORITY_FIXES_REPORT.md` item E | **Fixed**, verified via real Playwright screenshots |
| BUG-16 | Mobile nav (regression found while fixing BUG-15) | Same files | Same | Medium | Open the new hamburger drawer at 390px width | Drawer opens on tap | First attempt: tap intercepted by the site's fixed global header. Second attempt (after a top-offset guess): button rendered ~28px under the header | Measured directly via Playwright `boundingBox()` | Moved trigger inside the page's existing padded container instead of guessing an offset | **Fixed**, verified |
| BUG-17 | Chat widget | `ChatWidget.tsx` | All (mobile) | Medium | Open any `Dialog`/`Sheet` (schedule dialog, nav drawers, etc.) on mobile | Modal content fully usable | Chat widget (`z-9999`) rendered on top of and intercepted clicks on modal content (`z-50`), most concretely the schedule dialog's own bottom-right CTA button | Confirmed via direct source comparison of all relevant z-index values | `MOBILE_AUDIT_PRIORITY_FIXES_REPORT.md` item F | **Fixed** |

## Workflows tested this pass with no bugs found

- Full customer-service ticket lifecycle (create, customer reply, staff reply, internal note, escalate,
  resolve) — every step returned the correct status code with correct data.
- Satisfaction survey submission, both promoter and detractor paths, including the detractor-to-ticket
  auto-creation pipeline.
- `/api/admin/subscriptions/past-due` and `/api/admin/subscriptions/needs-scheduling` — both already
  correctly guard against the null-in-`.in()` pattern that broke `Visits.tsx` (BUG-14); no fix needed.

## Severity/effort summary

| Severity | Count |
|---|---|
| Critical | 6 (BUG-03, 06, 07, 08, 09, 10) |
| High | 6 (BUG-04, 11, 12, 13, 15, 16) |
| Medium | 3 (BUG-02, 05, 17) |
| Low | 1 (BUG-14) |

All 17 are **Fixed** in this sprint except BUG-10, which is fixed in code/migration but **requires the user
to apply `db/migrations/2026-06-22_widen_profiles_role_check.sql` via the Supabase SQL Editor** before
technician/dispatcher/sales/customer_service roles can actually be assigned in production.
