# Application Status Report (2025-11-10)

Owner: Elijah Noble
Scope: Full application (public site, customer dashboard, admin, server APIs)

---

## Executive Summary
The application is feature-rich at the UI layer, organized around public marketing pages, a customer dashboard, and a comprehensive admin panel. Authentication is local (browser storage). Most admin/dashboard operations are in-memory (seed data) without persistence. A production-ready schedule request flow is wired to a backend endpoint. Additional APIs, database, and billing are not yet integrated.

High-level status:
- Routing, layouts, theming, and SEO are complete and consistent.
- Auth is local-only with role-based gating (admin/customer).
- Admin suite is functional over in-memory data for demos.
- Schedule request posts to a real Express route under /api/schedule (Netlify wrapper present).
- No database or Stripe integration yet. Waitlist endpoint is missing.

---

## Routing Overview
Source: client/App.tsx

Public routes:
- / (Index)
- /pricing
- /services
- /our-story
- /reviews
- /service-area
- /faq
- /blog
- /schedule
- /login
- /contact, /privacy, /terms, /guarantee, /licenses (placeholder pages)
- 404 catch-all

Customer dashboard (RequireAuth):
- /dashboard (overview)
- /dashboard/appointments
- /dashboard/billing
- /dashboard/properties
- /dashboard/messages
- /dashboard/support
- /dashboard/videos
- /dashboard/profile

Admin (RequireAdmin):
- /admin (overview)
- /admin/customers
- /admin/properties
- /admin/appointments
- /admin/visits
- /admin/messages
- /admin/tickets
- /admin/billing
- /admin/content
- /admin/pricing
- /admin/service-areas
- /admin/reports
- /admin/settings

---

## Cross‑cutting Systems
- Layout: client/components/layout/MainLayout.tsx with SiteHeader/SiteFooter.
- UI Kit: shadcn-based components under client/components/ui/*, Tailwind CSS, consistent responsive patterns.
- SEO: client/components/seo/Seo + structured data in client/seo/structuredData.ts used across pages.
- Auth: client/contexts/AuthContext.tsx (localStorage). First signup becomes admin; subsequent signups are customers. Exposes useAuth with login, signUp, logout. Gating via components auth/RequireAuth and auth/RequireAdmin.
- Schedule dialog: client/components/schedule/* globally available via ScheduleDialogProvider; posts to /api/schedule.

---

## Public Site Pages

### / (Home) — client/pages/Index.tsx
- Sections: Hero, Address Checker, Quote Widget, Plan Cards, Benefits, Services, Pest Grid, Video Proof, Reviews, Story, FAQ, Schedule, Contact.
- SEO with LocalBusiness, Service, and Product schema.
- Status: UI complete; forms/widgets operate locally; no backend pricing engine.

### /pricing — client/pages/Pricing.tsx
- Hero with flags; QuoteWidgetSection; PlanCardsSection; FAQ subset.
- Status: UI complete; pricing widgets are client-only; no payment or plan sync.

### /services — client/pages/Services.tsx
- Core treatments and add-on services; VideoProof and PestGrid.
- Status: Content-driven UI; no dynamic data.

### /our-story — client/pages/OurStory.tsx
- Story, values, leadership team grid.
- Status: Static content; complete.

### /reviews — client/pages/Reviews.tsx
- Reviews section and aggregate rating display.
- Status: Static/testimonial data; no third-party reviews API.

### /service-area — client/pages/ServiceArea.tsx
- ZIP coverage list; Cities; WaitlistForm (endpoint "/api/waitlist").
- Status: UI complete. WaitlistForm posts to /api/waitlist, which is NOT implemented (server has no such route). Not wired.

### /faq — client/pages/FAQ.tsx
- SEO FAQ schema; searchable FAQSection.
- Status: Static content; complete.

### /blog — client/pages/Blog.tsx
- Lists blog posts from client/data/blog.ts; cards with disabled links.
- Status: UI complete; no CMS; full post routes are placeholders.

### /schedule — client/pages/Schedule.tsx
- Auto-opens ScheduleDialog; highlights features; CTA to open dialog.
- Status: Fully wired to /api/schedule. Also creates local account on submit if unauthenticated (AuthContext). No external CRM currently.

### /login — client/pages/Login.tsx
- AuthTabs for signup/login, then Navigate to /dashboard.
- Status: Fully wired to local AuthContext; no external identity provider.

### Placeholder pages (/contact, /privacy, /terms, /guarantee, /licenses)
- Reusable PlaceholderPage component; CTA links.
- Status: Presentational only.

### 404 — client/pages/NotFound.tsx
- Styled 404 with CTAs; logs pathname.
- Status: Complete.

---

## Customer Dashboard (RequireAuth)

### Layout — client/pages/DashboardLayout.tsx
- Sidebar nav; routed Outlet area.

### /dashboard — client/pages/Dashboard.tsx
- Greets user from AuthContext; Upcoming visits (static array), Recent videos (static array); helpful cards and CTAs.
- Status: UI complete; data static; not persisted.

### /dashboard/appointments — client/pages/dashboard/Appointments.tsx
- Header + CTAs; placeholder content area.
- Status: Not wired (awaiting data connection).

### /dashboard/billing — client/pages/dashboard/Billing.tsx
- Current plan card; payment methods card; invoices placeholder.
- Status: Not wired to Stripe; no portal integration.

### /dashboard/properties — client/pages/dashboard/Properties.tsx
- Add property CTA; placeholder list.
- Status: Not wired.

### /dashboard/messages — client/pages/dashboard/Messages.tsx
- New message CTA; placeholder list.
- Status: Not wired.

### /dashboard/support — client/pages/dashboard/Support.tsx
- Re‑service CTA; contact CTA; placeholder.
- Status: Not wired.

### /dashboard/videos — client/pages/dashboard/Videos.tsx
- Placeholder container for visit videos.
- Status: Not wired.

### /dashboard/profile — client/pages/dashboard/Profile.tsx
- Placeholder for profile & preferences.
- Status: Not wired.

---

## Admin (RequireAdmin)

### Layout — client/pages/admin/AdminLayout.tsx
- Sidebar nav with all admin sections; routed Outlet.

### Overview — client/pages/admin/Overview.tsx
- KPIs (active customers, today’s appts, MTD revenue, overdue invoices, unread messages); tables for upcoming appts, recent tickets, newest customers.
- Data: client/data/admin.ts.
- Status: Functional UI over in-memory data; no persistence.

### Customers — client/pages/admin/Customers.tsx
- Search by name/email/phone; status filter; Add customer dialog; details Sheet with tabs: profile, properties, invoices, messages.
- Status: Fully functional in-memory (add, filter, view). Not persisted to a DB.

### Properties — client/pages/admin/Properties.tsx
- Search; Add property dialog (attach to existing customer).
- Status: Functional in-memory. Not persisted.

### Appointments — client/pages/admin/Appointments.tsx
- Filters (query, plan, technician, city/ZIP, date range); bulk select/assign tech; reschedule dialog; stable calendar component (client/components/admin/FixedCalendar.tsx).
- Status: Functional in-memory (edit/assign/reschedule). Not persisted or capacity-validated.

### Visits — client/pages/admin/Visits.tsx
- Date range + technician filter; table includes chemicals and video link.
- Status: Read-only from seed; not persisted.

### Messages — client/pages/admin/Messages.tsx
- Search threads; thread list; conversation view; reply appends to local thread.
- Status: Functional in-memory; no email/SMS integration.

### Tickets — client/pages/admin/Tickets.tsx
- Kanban by status; change status; adjust priority.
- Status: Functional in-memory; no SLA timers or assignments persistence.

### Billing — client/pages/admin/Billing.tsx
- Totals by status; filter/search; mark paid; refund.
- Status: Functional in-memory; no Stripe sync or webhook handling.

### Content — client/pages/admin/Content.tsx
- Blog and FAQ tabs; search; add post/faq.
- Status: Functional in-memory; no CMS or publish pipeline.

### Pricing & Plans — client/pages/admin/Pricing.tsx
- Edit plan prices inline; reset; save (alerts only).
- Status: In-memory only; not connected to pricing engine.

### Service Areas — client/pages/admin/ServiceAreas.tsx
- Manage ZIPs and per-ZIP capacity; blackout dates via Calendar component.
- Status: In-memory only; blackout dates local; no route/capacity enforcement.

### Reports — client/pages/admin/Reports.tsx
- CSV export buttons for customers, properties, invoices, visits, tickets using client/lib/csv.
- Status: Fully working client-side exports (from seed); no server analytics.

### Settings — client/pages/admin/Settings.tsx
- Team management (invite/remove/update role); feature flags; integration toggles.
- Status: Fully functional in-memory; toggles do not affect runtime beyond UI state.

---

## Server & APIs
- Express app: server/index.ts with CORS and JSON parsing.
- Routes:
  - GET /api/ping — returns { message } (env overrideable).
  - GET /api/demo — sample JSON.
  - POST /api/schedule — validates ScheduleRequestPayload and responds with a ticketId.
- Netlify serverless wrapper: netlify/functions/api.ts exports handler = serverless(createServer()).
- Missing route: POST /api/waitlist — referenced by WaitlistForm but not implemented.

Status:
- Schedule flow is end‑to‑end wired (client dialog -> POST /api/schedule -> success UI).
- No persistence layer; no email/SMS/CRM integrations.

---

## What’s Wired vs Not

Wired (works now):
- Auth (local): signup/login/logout, role assignment, gating for dashboard/admin.
- Schedule request: validation, optional account creation, POST /api/schedule, success feedback.
- CSV exports (admin > Reports).
- UI/UX: responsive layouts, theming, SEO, dialog/tooltip/toasts.

Not wired (gaps):
- Database persistence for customers, properties, appointments, tickets, messages, invoices.
- Billing: Stripe products/prices, invoices, billing portal, refunds via API/webhooks.
- Messaging: email/SMS delivery, inbound sync, unread counts, SLA metrics.
- Calendar capacity logic: ZIP capacity/blackouts not enforced in scheduling.
- Waitlist API (/api/waitlist) endpoint missing.
- Blog/FAQ CMS and public article pages.
- Dashboard data binding for appointments, invoices, properties, messages, videos.
- Admin settings/flags don’t alter backend behavior.

---

## Recommended Next Steps (MVP -> Production)
1. Data & Auth
   - Connect Supabase (Postgres + Auth) or Prisma Postgres for persistence. Migrate seed models. Prefer Supabase for auth/storage and RLS.
2. Scheduling & Capacity
   - Store blackout dates and ZIP capacities; enforce during schedule creation. Add technician assignments and route windows.
3. Billing
   - Integrate Stripe: products/prices, checkout/payment methods, invoices, billing portal; webhook ingestion.
4. Messaging
   - Add provider (e.g., Twilio SendGrid + SMS). Store threads/messages; implement outbound/inbound flows.
5. Dashboard Binding
   - Query user’s appointments, visits, invoices, properties; surface visit videos and notes.
6. Content
   - Connect Builder CMS for blog/FAQ; generate public detail routes.
7. DevOps & Observability
   - Deploy via Netlify or Vercel; add Sentry for error/perf; add Semgrep CI for security.
8. API
   - Implement /api/waitlist to accept email+ZIP; store to DB and optionally notify.

---

## Integrations (MCP) — Available to Connect
You can connect these via the Builder.io MCP panel: [Open MCP popover](#open-mcp-popover)
- Supabase (preferred for DB+Auth), Neon (serverless Postgres alternative), Prisma Postgres (ORM), Netlify (hosting), Stripe (billing), Builder CMS (content), Sentry (errors), Linear (issues), Notion (docs), Zapier (automation), Figma (design to code), Context7 (docs), Semgrep (security).

Current status: none connected. All data changes are in-memory for demo.

---

## File Index (key)
- Routing: client/App.tsx
- Auth: client/contexts/AuthContext.tsx; components/auth/* (guards)
- Admin pages: client/pages/admin/*
- Dashboard pages: client/pages/dashboard/*
- Public pages: client/pages/*.tsx
- Seed data: client/data/*
- Schedule dialog: client/components/schedule/*
- UI kit: client/components/ui/*
- Server: server/index.ts, server/routes/*.ts; serverless wrapper netlify/functions/api.ts

---

## Appendix: Known Gaps & Open Questions
- /api/waitlist endpoint missing (breaks waitlist form). Implement server route and storage.
- Admin calendar is stable visually; no capacity logic/drag-and-drop; future enhancement.
- Role management is local; invite flow doesn’t email links; production will need transactional email.
