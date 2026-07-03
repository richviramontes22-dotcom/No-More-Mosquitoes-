# 02 — Current App QA Audit Report

**Date:** 2026-07-03

---

## Route Inventory

### Public Routes (MainLayout, no auth guard)
- `/` Index/landing
- `/pricing`, `/services`, `/our-story`, `/reviews`, `/service-area`, `/faq`, `/safety`, `/licenses`, `/schedule`, `/guarantee`
- `/blog`, `/blog/:slug` — Blog listing + detail
- `/contact`
- `/login`, `/forgot-password`, `/reset-password` — Auth flows
- `/admin/login` — Admin login (separate form)
- `/privacy`, `/terms`, `/legal/terms`, `/legal/privacy`, `/legal/service-agreement`, `/legal/pesticide-consent`

### Checkout Routes (CheckoutLayout — stripped)
- `/quote-invite/:token` — QuoteInvitePage (public, auth-optional)
- `/onboarding` — RequireAuth guard
- `/legal-acceptance` — RequireAuth guard

### Customer Dashboard (RequireCustomer + DashboardLayout)
- `/dashboard` — Overview
- `/dashboard/appointments` — Appointment list + scheduling
- `/dashboard/billing` — Subscription + payment management
- `/dashboard/properties` — Property management
- `/dashboard/marketplace` — Add-on store (ProductGrid + cart + checkout)
- `/dashboard/help` — Support/help
- `/dashboard/profile` — Profile settings
- `/dashboard/orders`, `/dashboard/messages`, `/dashboard/support`, `/dashboard/videos` — Redirects to canonical routes

### Admin Routes (RequireAdmin + AdminLayout — 41 routes)
All pages verified implemented. Key categories:
- **Customers:** Leads, Quote Lookup, Customers, Properties
- **Field Ops:** Appointments, Reschedule Requests, Route Planning, Visits, Service Areas
- **Workforce:** Employees, Workforce, Live Tracking, Legal & Compliance, Legal Documents
- **Support:** Messages, Tickets, Satisfaction, Email Management
- **Finance:** Billing, Revenue, Pricing, Promos, Referrals
- **Content:** Website Manager, Blog & FAQs
- **Analytics:** Reports, Analytics, Territory Intelligence, Workforce Optimization
- **System:** Alerts, Notifications, Business Hours, Debug, Settings

### Employee Routes (RequireEmployee + EmployeeLayout)
- `/employee/login` — Public login
- `/employee` — Dashboard (role-aware: tech vs customer_service)
- `/employee/assignments` — Today's assignments
- `/employee/assignments/:id` — Assignment detail (checklist, media, GPS, status)
- `/employee/messages`, `/employee/timesheets`, `/employee/profile`, `/employee/onboarding`
- `/employee/route` — Route map for today

### Customer Service Sub-Routes (nested RequireCustomerService inside RequireEmployee)
- `/employee/tickets` → reuses AdminTickets
- `/employee/satisfaction` → reuses AdminSatisfaction
- `/employee/reschedule-requests` → reuses AdminRescheduleRequests
- Customer Service Dashboard panel rendered inside `/employee` via role-aware Dashboard.tsx

---

## Data Requirements by Route

| Route | Data Source | Auth Level |
|---|---|---|
| `/dashboard` | profiles, properties, appointments | customer |
| `/dashboard/billing` | subscriptions, payments, Stripe | customer |
| `/dashboard/appointments` | appointments + properties | customer |
| `/dashboard/marketplace` | catalog_items, appointments, marketplace_orders | customer |
| `/employee` | employees, assignments, shifts, messages | employee |
| `/employee/assignments/:id` | assignments, job_checklists, chemicals_logs, signatures, job_media | employee |
| `/admin/qa-center` (new) | health endpoints | admin |

---

## Screens Requiring Real Auth/Session

- All `/dashboard/*` — requires active customer JWT
- All `/employee/*` — requires active employee JWT
- All `/admin/*` — requires active admin JWT
- `/onboarding`, `/legal-acceptance` — requires any active JWT

## Screens Renderable with Mock Data

- All public marketing pages — no auth needed
- `/admin/debug` — pulls from real API but shows no customer data
- `/admin/qa-center` (planned) — health checks + static route cards, no customer data

## Screens Hard to Preview Without Real Account

- `/dashboard/billing` — requires Stripe subscription data
- `/employee/assignments/:id` — requires real assignment with checklists/media
- `/employee/route` — requires real assignment coordinates
- Customer Service Panel — requires tickets/satisfaction rows

---

## Test Data / Seed Script

**Script:** `scripts/seed-dev.ts`
- Creates 3 deterministic properties (seed-prop IDs) and 6 appointments (seed-appt IDs)
- **Safety guard:** Refuses to run against production project `qamfxqbtvwwlzlmqrqbh` unless `SEED_ALLOW_PROD=yes_i_know`
- **No `is_test` flag** in profiles, properties, or appointments tables
- **Dev auth route:** `POST /api/dev/create-test-account` — only accepts `@test.com` emails; disabled in production

**Existing test accounts implied by DB roles:**
- 3 admin accounts
- 52 customer accounts (mix of dev-created test accounts and possibly pre-launch signups)
- 1 customer_service account
- 2 employee accounts + 1 technician account

---

## Existing Dev/Health Infrastructure

- `/api/dev/create-test-account` — dev-only, `@test.com` only, creates customer profile
- `/api/health/database`, `/api/health/stripe`, `/api/health/email`, `/api/health/parcel`, `/api/health/workforce`
- `/admin/debug` — comprehensive system status + health checks, admin only
- `scripts/test-all-features.mjs`, `scripts/test-stripe-webhook*.mjs` — dev test utilities

---

## PWA / Offline

- **Scope:** Employee portal only (`/employee` service worker scope)
- **Registration:** Dynamic — mounted on EmployeeLayout load, removed on unmount/logout
- **Cache:** localStorage with 24h TTL, user-scoped (prevents cross-employee data bleed)
- **Cached:** role, employee record, today's route, assignments, assignment detail
- **OfflineIndicator:** Sticky banner when offline or pending sync
- **Customer/admin portal:** No PWA, no offline support (correct — not field-facing)

---

## Marketplace / Add-On Store Current State

**Architecture:**
- Data source: `catalog_items` Supabase table → `useCatalogItems` hook (anon client read, RLS-public)
- Cart: Context-based (`CartContext`), in-memory only
- Checkout: `POST /api/marketplace/create-payment-intent` (authenticated)
- Orders: `marketplace_orders` table via `useMarketplaceOrders`

**Current catalog in production (14 items, 1 inactive):**

| Category | Items | Price |
|---|---|---|
| Products | Yard Sign Metal, Yard Sign General, Garden Flag | $24.99, $12.99, $19.99 |
| Products | Mosquito Dunks | Free |
| Add-ons | Fly Trap Service, Spider Web Service, Gutter Cleaning | $29.99, $29.99, $89.99 |
| Consultation | 7 Mosquito Fish varieties | $75–$300 each |
| Inactive | Branded Hat | N/A |

**Critical issue: ALL descriptions are NULL in the database.** No item has a description text. The ProductCard falls back to showing nothing in the description area.

**Minor data quality issue:** "Yard Sign â Metal" and "Yard Sign â General" — em dash character corrupted in DB (stored as UTF-8 "â" instead of "—").

---

## Screens Needing QA Center Coverage

| Screen | Difficulty | Risk |
|---|---|---|
| Customer billing/Stripe | High (requires Stripe test account) | Medium |
| Employee assignment workflow | High (requires test employee + assignment) | Low |
| Marketplace checkout | High (requires Stripe + customer account) | Medium |
| Admin debug panel | Low (no customer data) | Low |
| Customer service panel | Medium (requires ticket data) | Low |
| Public quote flow | Low (no auth) | Low |

---

## Missing: /admin/qa-center

No QA Center exists. The admin Debug page provides health checks but no app preview, workflow testing, or responsive preview capability. This sprint will create `/admin/qa-center`.
