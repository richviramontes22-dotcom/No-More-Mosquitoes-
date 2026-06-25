# Full-App Functional QA Plan

## Purpose and how to use this document

A repeatable checklist for testing every major feature/button/form/workflow across all seven role areas of
this app. Intended to be run (in full or in part) before any major release, and incrementally whenever a
feature area changes. Pair with `FULL_APP_FUNCTIONAL_QA_RESULTS.md` (this run's actual findings) and
`FULL_APP_BUG_REGISTER.md` (tracked issues).

**This run executed a real, targeted pass** against the local dev server using a disposable `@test.com`
account (created via the dev-only `/api/dev/create-test-account` endpoint, role promoted/reset between
sections via direct Supabase REST calls — never against real customer data) — not a simulated/theoretical
checklist. See the Results doc for exactly what ran live vs. what's documented here as the standing plan for
future passes.

## Methodology, per feature

For every item below:
1. Open the page/feature in the target role's session.
2. Exercise the golden path (the expected, successful flow).
3. Exercise at least one error/validation path (bad input, missing required field, etc).
4. Check for console errors and failed network requests.
5. Check the mobile viewport (390px) in addition to desktop, where the feature has a distinct mobile layout.
6. Record pass/fail, with enough detail to reproduce a failure, in the Results doc.

## Scope

### Public (no auth)
- Homepage: hero banner legibility, CTAs, instant quote widget (in-area and out-of-area address), pricing
  cards, service-area checker (in-area and out-of-area + waitlist signup).
- Pricing, Services, Our Story, Reviews, Service Area, FAQ pages render and link correctly.
- Blog index + a blog detail page render.
- Legal pages (`/legal/terms`, `/legal/privacy`, `/legal/service-agreement`, `/legal/pesticide-consent`).
- Contact page / Guarantee / Licenses / Safety pages render.
- Login / Registration: valid login, invalid password, password reset request, new signup.

### Customer (`/dashboard/*`)
- Dashboard home loads with real data (next appointment, account status).
- Profile: view + update name/email/phone (the bug fixed in this sprint), notification preferences.
- Properties: list, add (in-area and out-of-area), edit.
- Appointments: list, view detail, request reschedule.
- Marketplace: browse catalog, add to cart, checkout with and without a promo code.
- Help/Tickets: create a ticket, view ticket status, send a message in an existing thread (the bug fixed in
  this sprint).
- Messages: thread list, open a thread, send a reply (the bug fixed in this sprint).
- Satisfaction survey: submit a rating + comment after a completed visit.
- Billing/Subscriptions: view current plan, view billing history.

### Employee / Technician (`/employee/*`)
- Login at `/employee/login`, redirect to `/employee` on success.
- Dashboard: today's stops, clock in/out widget.
- Assignments: list loads with real data (the bug fixed in this sprint), assignment detail page.
- Route: today's route view, navigation link handoff.
- Status changes on an assignment: mark en route / arrived / completed / unable-to-service / blocked.
- Treatment notes + media upload on a job.
- Timesheets: clock in/out history.
- Messages: thread list + reply.
- Onboarding: required-forms flow for a new hire.

### Customer Service (`/employee/*`, customer_service role)
- Dashboard: open/escalated ticket counts, detractor count, pending reschedule count, customer search.
- Tickets: open a ticket, reply, add internal note, escalate, resolve, reopen.
- Satisfaction: view detractor queue, resolve a flagged response.
- Reschedule Requests: approve, deny.

### Sales (`/employee/*`, sales role)
- Dashboard: recent leads, overdue follow-ups, referral codes, recent referrals.

### Admin (`/admin/*`)
- CRM/Leads: list, lead detail, status/assignment.
- Customers: list, customer detail.
- Appointments: list, dispatch, cancel, reschedule-request approval.
- Route Planning / Route Automation: route list, automation policy settings.
- Service Areas: list, add/edit a ZIP, batch update.
- Territory Intelligence / Workforce Optimization: dashboards load with real data.
- Analytics / Reports / Revenue: dashboards load with real data.
- Referrals: list, codes.
- Promo Codes: create a code, validate it (the bug fixed in an earlier sprint), edit, deactivate.
- Tickets / Satisfaction: same actions as the Customer Service role, with admin's additional authority
  (e.g., Customer Database link, which customer_service does not see).
- Employees: list, add/edit an employee, role assignment (including the four roles unblocked by this
  sprint's migration, once applied).
- Blog CMS / Content: create a draft, preview, publish, confirm the public blog detail page renders it.
- Legal Documents: versioned document workflow (draft -> review -> approved -> deployed).
- Notifications: alert log, notification settings.
- Visits: completed-visit list (the bug fixed in this sprint).
- Mobile nav: hamburger drawer opens/closes correctly below 1024px (the bug fixed in this sprint).

### Cross-cutting
- Chat widget never overlaps an open dialog/sheet's content on mobile (the bug fixed in this sprint).
- Every role's login correctly lands on that role's portal, including technician/dispatcher/customer_service/
  sales once the role-constraint migration is applied (fixed this sprint, but blocked until the migration
  runs — see `MOBILE_AUDIT_PRIORITY_FIXES_REPORT.md` item C).
