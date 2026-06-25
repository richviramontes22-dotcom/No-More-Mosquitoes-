# Admin & Customer Dashboards — Requirements & Architecture (Pest Control SaaS)

Purpose: Provide a complete prompt/requirements doc that product, design, and engineering can use to implement A) an Admin panel and B) a Customer dashboard for an outdoor pest‑control business. The spec is tool‑agnostic but maps cleanly to React + Tailwind + shadcn UI, Express/Serverless API, Supabase (auth+DB+storage), and Stripe (billing). It includes IA, data models, RBAC, workflows, APIs, events, and acceptance criteria.

---

## 0) Scope & Objectives

- Centralize operations: customers, properties, plans, quotes, appointments/visits, messages, billing, marketing content, and reports
- Deliver a professional‑grade customer account experience: scheduling, plan changes, payments, support, and self‑service
- Support growth: multi‑location, role‑based access, observability, and auditability
- Out of scope (v1): field‑technician mobile app (can be added v2), complex inventory, payroll

## 1) Context & Assumptions

- Frontend framework: React + TypeScript, Tailwind + shadcn UI
- Routing: React Router v6, client‑side SPA
- Server: Express wrapped as serverless functions (Netlify/AWS Lambda)
- Data fetching: TanStack Query; to be replaced/augmented by SDK calls (Supabase)
- Current site already includes marketing pages, login modal, schedule request flow, and a basic customer dashboard stub
- These assumptions align with the uploaded site report (tech stack, routing, components, deployment). Use this doc to layer real auth, DB, and RBAC on top.

## 2) Roles & RBAC

Roles:
- Customer – owns one or more properties; can schedule, manage plan & billing, message support, view visits, download invoices
- Technician – read‑only on customers in their route; update visit status/notes/photos/video (v2 mobile)
- Support – handle schedule requests, triage tickets, reply to messages, create quotes
- Admin – full CRUD on all entities, pricing, service areas, posts, metrics
- SuperAdmin – platform config, user/role management, feature flags

RBAC Matrix (summary):
- Customers: Admin/SuperAdmin (CRUD), Support (R/partial C), Customer (R/own)
- Properties: Admin/SuperAdmin (CRUD), Support (CR/UD), Customer (CRUD own)
- Appointments/Visits: Admin/SuperAdmin (CRUD), Support (CRUD), Customer (CR/U own, cancel/reschedule per policy)
- Plans/Subscriptions: Admin/SuperAdmin (CRUD), Support (R/U), Customer (U own)
- Invoices/Payments: Admin/SuperAdmin (CRUD), Support (R), Customer (R own)
- Messages/Tickets: Admin/Support (CRUD), Customer (CR/U own)
- Blog/FAQ: Admin/SuperAdmin (CRUD), Support (R/C drafts)
- Settings (pricing, service areas, taxes, integrations): Admin/SuperAdmin only

## 3) Core Entities & Data Model (relational)

- users (id, email, password_hash*, name, phone, role, status, created_at)
- properties (id, user_id→users, label, address_line1, address_line2, city, state, zip, acreage, gate_code, notes, created_at)
- plans (id, code, name, description, tier, cadence_days, price_cents, currency, active)
- subscriptions (id, user_id, property_id, plan_id, status [trial|active|paused|canceled|past_due], start_date, cancel_at, stripe_customer_id, stripe_sub_id, auto_pay)
- appointments (id, property_id, user_id, window_start, window_end, status [requested|scheduled|en_route|in_progress|completed|no_show|canceled], technician_id, source [customer|admin|system], created_at)
- visits (id, appointment_id, technician_id, started_at, completed_at, chemicals_used_json, photos[], video_url, summary, issues_json)
- messages (id, thread_id, sender_id, body, attachments[], created_at)
- message_threads (id, subject, customer_id, status [open|pending|closed], last_activity_at, priority)
- tickets (id, customer_id, type [reservice|billing|general], description, status, sla_due_at, assignee_id, created_at)
- invoices (id, user_id, subscription_id, visit_id, stripe_invoice_id, amount_cents, currency, status, issued_at, due_at, paid_at)
- payments (id, invoice_id, stripe_payment_intent_id, amount_cents, status, method, created_at)
- schedule_requests (id, payload_json, preferred_date, preferred_window, status [new|triaged|converted|rejected], created_at)
- service_areas (id, name, zips[], active)
- pricing_rules (id, plan_id, acreage_min, acreage_max, zip, multiplier, active)
- blog_posts (id, slug, title, excerpt, body_richtext, hero_image, status [draft|published], author_id, published_at)
- notifications (id, user_id, channel [email|sms|push], type, payload_json, sent_at, delivery_status)
- audit_logs (id, actor_id, action, entity, entity_id, before_json, after_json, ip, user_agent, created_at)

Storage: large media (photos/video) in object storage (Supabase Storage/S3). Keep URLs in entities.

## 4) Information Architecture

### A) Admin Panel (/admin)

Top‑level nav:
1. Overview (KPIs & live queues)
2. Customers (list, search, detail)
3. Properties
4. Appointments (calendar + list)
5. Visits (history, media)
6. Messages (support inbox)
7. Tickets (CS requests / re‑service)
8. Billing (invoices, payments, dunning)
9. Content (blog, FAQ)
10. Pricing & Plans
11. Service Areas
12. Reports (exports)
13. Settings (integrations, team, roles)

Overview (dashboard):
- Today’s visits (count, on‑time %, completions)
- New schedule requests (triage queue)
- Open tickets by priority/SLA
- Revenue (MTD), A/R outstanding, churn
- CSAT/NPS summary, avg response time
- Quick actions: create appointment, new invoice, publish blog, broadcast message

Customers:
- Table: name, email, phone, plan, MRR, last visit, status
- Filters: plan tier, service area/zip, AR balance, churn risk
- Detail: profile, properties, subscriptions, appointments, tickets, invoices, messages (with reply), notes, timeline

Appointments:
- Calendar views (day/week/month) + list; drag‑drop reschedule; route/technician assignment
- Create from schedule request or customer detail; conflict detection; capacity constraints by zip/tech

Visits:
- Completion forms (chemicals used, photos, video URL, signature), printable report PDF
- Re‑service flow with cause coding

Messages:
- Omnichannel inbox (email/SMS/web) unified into threads; canned replies; internal notes; SLA timers

Tickets:
- Kanban/backlog; categories; SLA policies; escalation; merge/relate to visit

Billing:
- Stripe sync (customers, subs, invoices, payments); issue refunds/credits; dunning status

Content:
- Blog/FAQ editor (draft, schedule, publish); SEO fields; preview links

Pricing & Plans:
- CRUD plans & cadence; acreage/zip multipliers; promo codes (optional)

Service Areas:
- Zip management; blackout dates; capacity/tech constraints

Reports:
- CSV exports: customers, revenue, visits, chemicals usage, SLA metrics; scheduled email exports

Settings:
- Team & roles; integrations (Stripe, Supabase keys, email/SMS); feature flags; webhooks; brand assets

### B) Customer Dashboard (/dashboard)

Sidebar nav:
1. Overview (at‑a‑glance)
2. Appointments (upcoming & history)
3. Plan & Billing (change plan, payment methods, invoices)
4. Properties (addresses, acreage, notes)
5. Messages (support threads)
6. Support (re‑service request, knowledge base, contact)
7. Blog (community updates)
8. Profile & Preferences (account, notifications, security)

Overview:
- Next visit card (date/window, tech, reschedule button)
- Current plan & frequency; quick “Change plan” CTA
- Balance & last invoice; add payment method
- Latest message/ticket status; last technician report/video

Appointments:
- Request/schedule new appointment; reschedule/cancel with policy gating
- iCal/Google Calendar add; SMS opt‑in for reminders

Plan & Billing:
- Upgrade/downgrade plan; change cadence; add‑ons
- Payment methods (default card), billing address
- Invoice list (download PDF), receipts

Properties:
- Multiple properties; add/edit; notes (gate codes) stored securely

Messages:
- Threaded conversation with support; attachments; photos

Support:
- Re‑service request form linked to last visit; priority; SLA notice
- Knowledge base (FAQ), contact phone/email

Profile & Preferences:
- Name, email, phone; password; 2FA
- Notification settings (email/SMS)

## 5) Key Workflows

Lead → Schedule Request → Customer:
- Public form creates schedule_requests:new; Admin triages to create user/property + appointment; status becomes converted

Appointment Scheduling:
- Constraints: service area zip, technician capacity, blackout dates; notify customer; create Stripe invoice if needed

Visit Completion:
1. Technician logs chemicals/photos/video
2. System generates customer‑visible visit report
3. Triggers invoice if per‑visit

Re‑service Ticket:
- Customer submits from dashboard; SLA policy creates due date; scheduler creates new appointment if approved

Plan Change:
- Customer selects new plan/cadence; Stripe subscription update; effective at next billing cycle by default

Payment Failure (Dunning):
- Webhook updates status to past_due; email/SMS reminders; self‑serve payment update; auto‑cancel after policy threshold

## 6) API Surface (REST; GraphQL optional later)

Auth:
- POST /auth/login, /auth/logout, /auth/signup (or Supabase SDK)

Admin (require role=admin/superadmin):
- GET/POST /admin/customers, /admin/customers/:id
- GET/POST /admin/properties, /admin/appointments, /admin/visits
- POST /admin/appointments/:id/assign, /reschedule, /cancel
- GET/POST /admin/tickets, /admin/messages (threads & replies)
- GET/POST /admin/plans, /admin/pricing-rules, /admin/service-areas
- GET/POST /admin/invoices, /admin/payments
- GET/POST /admin/blog-posts (publish/draft)
- GET /admin/reports?type=… (CSV)

Customer (require session):
- GET /me (profile, subscriptions, properties)
- GET/POST /me/properties
- GET/POST /me/appointments (create/reschedule/cancel)
- GET/POST /me/messages (threads & replies)
- GET/POST /me/tickets (re‑service)
- GET/POST /me/billing (payment methods), /me/invoices
- POST /me/subscription/change

Public:
- POST /schedule-requests
- GET /blog, /blog/:slug

Webhooks:
- /webhooks/stripe (invoice.payment_succeeded|failed, customer.subscription.updated)
- /webhooks/email-sms (delivery callbacks)

## 7) Events & Notifications (matrix)

- Appointment Scheduled — Audience: Customer — Channel: Email/SMS — Timing: Immediately
- Appointment Reminder — Audience: Customer — Channel: SMS/Email — Timing: 24h & 2h before
- Tech En Route — Audience: Customer — Channel: SMS — Timing: When marked en_route
- Visit Completed — Audience: Customer — Channel: Email — Timing: After completion
- Payment Failed — Audience: Customer — Channel: Email/SMS — Timing: Immediately + dunning cadence
- Ticket Created/Updated — Audience: Customer — Channel: Email — Timing: On change
- New Schedule Request — Audience: Admin/Support — Channel: Email/Slack — Timing: Immediately
- Low CSAT Alert — Audience: Admin — Channel: Email/Slack — Timing: Threshold breach

## 8) Non‑Functional Requirements

- Security: JWT sessions; RLS (row‑level security) in DB; encrypt PII; audit logs on admin actions
- Privacy: GDPR/CCPA readiness; data erasure; consent for SMS/email
- Observability: Sentry for FE/BE; structured logs; uptime monitoring
- Performance: P95 TTFB < 300ms on API; dashboard FCP < 2s on 4G; image/video lazy‑load
- Accessibility: WCAG 2.1 AA; keyboard navigation; semantic landmarks
- Internationalization (optional): en-US default; currency formatted

## 9) UI Design System (atoms → templates)

- Atoms: Button, Input, Select, Textarea, Badge, Chip, Avatar, Tooltip, Toast
- Molecules: Card, DataTable (sorting/filter/pagination), StatTile, Timeline, EmptyState, ConfirmDialog, Drawer/Sheet
- Organisms: MessageThread, Calendar (day/week/month), PricingEditor, VisitReport, BillingPortal
- Templates: Admin list+detail, Admin calendar, Customer dashboard, Wizard (onboarding)

## 10) Acceptance Criteria (samples)

Admin:
- Can create a customer with at least one property and assign a plan
- Can view calendar and drag a pending appointment to a specific technician/time; conflicts are prevented
- Can respond to a customer message from the inbox and see SLA timers
- Can publish a blog post and see it live on /blog
- Can export a CSV of visits within a date range

Customer:
- Can add a new appointment in an available window and receive confirmation
- Can change from Core to Yard Defender, and Stripe updates subscription next cycle
- Can open a re‑service ticket linked to the last visit
- Can download any invoice as PDF
- Can update phone/email and notification preferences

## 11) Phased Implementation Plan

Phase 0 – Foundations (1–2 weeks):
- Supabase auth (email/password, magic link), Postgres schemas (DDL), Storage buckets (media)
- Stripe: customers, products/prices, subscriptions; webhooks wired
- RBAC enforcement on API routes; seed admin user

Phase 1 – Customer Dashboard (2–3 weeks):
- Overview, Appointments, Plan & Billing, Properties, Messages, Support, Profile
- Appointment creation/reschedule/cancel; Stripe customer portal; invoice list

Phase 2 – Admin Panel (3–4 weeks):
- Overview KPIs, Customers CRUD, Appointments Calendar + assignment, Messages inbox, Tickets
- Pricing/Plans, Service Areas, Blog/FAQ, Reports

Phase 3 – Quality & Growth (ongoing):
- SLA policies, exports, dunning flows, CSAT/NPS, analytics dashboards, performance & a11y audits

## 12) Prompt Snippets (for AI codegen / Builder)

Admin Calendar Screen Prompt:
> Create an admin calendar view with day/week/month tabs, technician lane coloring, drag‑drop to reschedule, conflict detection, and an appointment detail drawer with status, customer, property, and notes. Include filters by service area and technician.

Customer Appointments Screen Prompt:
> Build a customer appointments screen showing upcoming and past visits, with reschedule/cancel actions gated by policy. Show a sticky CTA button to "Schedule New Appointment" opening a wizard that collects property, preferred window, and notes.

Billing/Plans Prompt:
> Implement a plan & billing panel where the user can upgrade/downgrade plan, change cadence, and manage payment methods via Stripe. Include invoice history with downloadable PDFs.

## 13) Risks & Mitigations

- Auth migration complexity → start with Supabase; keep adapters to swap later
- Stripe webhooks on serverless → use idempotency keys; queue retries
- Media storage costs → transcode/compress, lifecycle rules, thumbnails
- Calendar capacity logic → begin simple constraints; iterate to routing optimization later

## 14) Glossary

- Appointment: a scheduled service window; results in a Visit record once started
- Visit: the performed service instance with materials, media, and outcomes
- Re‑service: follow‑up appointment triggered by a support ticket

End of document.
