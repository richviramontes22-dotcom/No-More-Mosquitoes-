# No More Mosquitoes — Site Architecture, Features, and Expansion Plan

This report documents the current state of the codebase and application, and provides comprehensive context to design and implement new pages — specifically an Admin Panel and an expanded Customer Account Panel.

---

## 1) Tech Stack Overview

- Frontend
  - React 18 + TypeScript, Vite build tooling
  - React Router v6 for client-side routing
  - Tailwind CSS with custom HSL design tokens (CSS variables)
  - shadcn-style UI patterns (Radix primitives + class-variance-authority + tailwind-merge)
  - Lucide icons
  - TanStack React Query (data fetching/cache)
  - SEO helpers + JSON-LD structured data
- State/Context
  - Local AuthContext (localStorage-backed demo auth)
  - Dialog context providers for authentication and scheduling
- Backend/API
  - Express server (server/index.ts) with routes in server/routes
  - Wrapped by serverless-http for Netlify Functions
  - Netlify proxy config in netlify.toml for /api/*
- Testing
  - Vitest with tests in client/lib/*.spec.ts
- Build/Deploy
  - Vite builds for client and server (see package.json scripts)
  - Netlify functions for API; publishing dist/spa

Key packages: react, react-router-dom, @tanstack/react-query, tailwindcss, @radix-ui/*, class-variance-authority, tailwind-merge, lucide-react, sonner, express, serverless-http.

---

## 2) File Structure (Relevant Paths)

- client/
  - App.tsx (router & providers)
  - global.css (theme tokens, typography, font schemes)
  - components/
    - layout/
      - MainLayout.tsx — header, outlet, footer wrapper
      - SiteHeader.tsx — top navigation, auth/schedule triggers, font preview selector
      - SiteFooter.tsx — footer with nav, contact, legal
    - auth/
      - AuthDialogProvider.tsx — context provider for auth dialog
      - AuthDialog.tsx — modal wrapper around AuthTabs
      - AuthTabs.tsx — login/signup UI
      - RequireAuth.tsx — protected route wrapper
    - schedule/
      - ScheduleDialogProvider.tsx — context provider for schedule dialog
      - ScheduleDialog.tsx — scheduling form + confirmation flow
    - page/ — page composition building blocks
      - PageHero.tsx, CtaBand.tsx, PricingTierTable.tsx, WaitlistForm.tsx, ValuesList.tsx, TeamGrid.tsx, index.ts
    - sections/ — reusable landing sections
      - HeroSection.tsx, AddressCheckerSection.tsx, QualityAssuranceSection.tsx, QuoteWidgetSection.tsx, PlanCardsSection.tsx, BenefitsSection.tsx, ServicesSection.tsx, PestGridSection.tsx, VideoProofSection.tsx, ReviewsSection.tsx, StorySection.tsx, FAQSection.tsx, ContactSection.tsx
    - seo/
      - Seo.tsx — title/meta/canonical + JSON-LD injection
    - branding/
      - LogoCutout.tsx
    - ui/ — shadcn-style components (button, card, dialog, input, label, select, tabs, textarea, sheet, dropdown, separator, tooltip, toaster, sonner, etc.)
  - contexts/
    - AuthContext.tsx — demo auth (localStorage)
  - data/
    - site.ts — pricing tiers, benefits, services, testimonials, FAQs, schedule steps, service ZIPs
    - blog.ts — blog post list
    - media.ts — images
    - team.ts — leadership team data
  - lib/
    - forms.ts — fetch helper + validators
    - pricing.ts — pricing engine; pricing.spec.ts
    - utils.ts — cn utility; utils.spec.ts
  - pages/
    - Index.tsx (home), Pricing.tsx, Services.tsx, OurStory.tsx, Reviews.tsx, ServiceArea.tsx, FAQ.tsx, Blog.tsx, Schedule.tsx, Login.tsx, Dashboard.tsx, NotFound.tsx, Placeholder.tsx
  - seo/
    - structuredData.ts — JSON-LD schemas
- server/
  - index.ts — creates Express app, wires routes
  - routes/demo.ts — sample API
  - routes/schedule.ts — validates schedule payload, returns ticketId
- netlify/
  - functions/api.ts — serverless-http adapter for Express
- netlify.toml — build, publish, functions, redirects
- tailwind.config.ts — theme configuration, font families
- reports/ — project reports

---

## 3) Routing & Layouts

Defined in client/App.tsx using BrowserRouter and Routes.

- Layout: client/components/layout/MainLayout.tsx wraps pages with SiteHeader and SiteFooter.
- Protected routing: client/components/auth/RequireAuth.tsx shields /dashboard.

Route map:

- / — Index (composite landing with multiple sections)
- /pricing — Pricing page
- /services — Services page
- /our-story — Story page
- /reviews — Reviews page
- /service-area — Service Area page
- /faq — FAQ page
- /blog — Blog index (post links stubbed)
- /schedule — Opens ScheduleDialog, page content
- /login — Customer login/signup page
- /dashboard — Customer dashboard (protected)
- Placeholders: /contact, /privacy, /terms, /guarantee, /licenses
- catch-all — NotFound

---

## 4) Current Pages and Features

- Index.tsx
  - SEO with LocalBusiness, Service, Product schemas
  - Sections: Hero, QualityAssurance, AddressChecker (acreage + ZIP -> tier), QuoteWidget, PlanCards, Benefits, Services, PestGrid, VideoProof, Reviews, Story, FAQ, Schedule, Contact
- Pricing.tsx
  - PageHero (centered) with flag imagery; QuoteWidgetSection; PlanCardsSection; searchable FAQ subset; CTA band
- Services.tsx
  - PageHero (split) with features aside; dynamic services from data/site.ts; add-on services; VideoProof; PestGrid; CTA
- OurStory.tsx
  - Organization schema; brand values; StorySection; TeamGrid with leadershipTeam
- Reviews.tsx
  - Product + AggregateRating schema; ReviewsSection; rating summary; CTA
- ServiceArea.tsx
  - Place schema; ZIP coverage grid; city cards; WaitlistForm (id=#waitlist)
- FAQ.tsx
  - FAQPage schema; FAQSection with optional search
- Blog.tsx
  - Blog schema; list from data/blog.ts; post links stubbed (“coming soon” pattern)
- Schedule.tsx
  - Opens ScheduleDialog on mount; guidance content; CTA; dialog collects schedule request and optionally creates auth account
- Login.tsx
  - AuthTabs (login/signup) powered by AuthContext; auto-redirects to /dashboard if authenticated
- Dashboard.tsx (Customer)
  - Protected via RequireAuth; hero with account info; upcoming visits stub; recent videos stub; billing/communication panel; logout action
- NotFound.tsx
  - Friendly 404 with actionable links

---

## 5) Layout & Navigation

- SiteHeader.tsx
  - Top utilities: font preview selector (sets .font-scheme-X class and CSS vars)
  - Mobile Sheet menu; primary navigation + dynamic login/dashboard item
  - Call/Text CTA; triggers AuthDialog and ScheduleDialog
- SiteFooter.tsx
  - Brand/mission; contact; navigation; legal links; service areas; compliance/tracking note

---

## 6) Components & Patterns

- Page components: PageHero, CtaBand, PricingTierTable, WaitlistForm, ValuesList, TeamGrid
- Sections: HeroSection, AddressCheckerSection, QualityAssuranceSection, QuoteWidgetSection, PlanCardsSection, BenefitsSection, ServicesSection, PestGridSection, VideoProofSection, ReviewsSection, StorySection, FAQSection, ContactSection
- UI: button, card, dialog, input, label, select, tabs, textarea, tooltip, sheet, dropdown-menu, separator, toasters (sonner & shadcn toast)
- Utilities: cn (clsx + tailwind-merge)

---

## 7) State, Auth, and Dialogs

- AuthContext (client/contexts/AuthContext.tsx)
  - Demo auth stored in localStorage with users map and currentUserEmail
  - login/signUp/logout; isHydrated tracks storage load
- RequireAuth
  - Protects dashboard; shows loading state until hydrated
- AuthDialogProvider + AuthDialog + AuthTabs
  - Modal login/signup, then navigate to /dashboard (or redirect)
- ScheduleDialogProvider + ScheduleDialog
  - Form for service request; validates inputs; can create account if not authenticated; posts to /api/schedule; shows confirmation with ticketId

---

## 8) Forms & Utilities

- forms.ts
  - postJson<T>() with robust error reporting
  - isValidEmail, isValidPhone, FormStatus types
- pricing.ts
  - calculatePricing with tiers, frequencies, custom threshold; formatCurrency helper
  - Tests: pricing.spec.ts validates computation paths
- utils.ts
  - cn(); tests in utils.spec.ts

---

## 9) Styling, Theme, and Typography

- Tailwind config (tailwind.config.ts)
  - darkMode: class
  - content scanning under ./client/**/*.{ts,tsx}
  - Theme uses CSS variables (HSL) for all color tokens; extended font families:
    - fontFamily.sans: ["Manrope", "Inter", "system-ui", "sans-serif"]
    - fontFamily.display: ["Playfair Display", "serif"]
- global.css
  - HSL design tokens in :root and .dark
  - Base: body uses var(--font-sans), headings use var(--font-display)
  - Font schemes: .font-scheme-1..10 set --font-sans/--font-display; selectors ensure font utilities follow dynamic vars
  - Google Fonts: Manrope, Inter, Playfair Display

Design guidance: For new pages, keep headings with font-display and body with font-sans via tokens for brand consistency.

---

## 10) Data Modules

- site.ts — pricingTiers, frequencyOptions, brand story, heroHighlights, pests, benefits, services, testimonials, FAQs, videoProofs, scheduleSteps, serviceAreaZipCodes
- blog.ts — blogPosts seed
- media.ts — hero and lifestyle/technician images
- team.ts — leadershipTeam

Use these to build features and demos prior to dynamic data integration.

---

## 11) Backend/API

- server/index.ts
  - Express app with CORS, JSON body parsing
  - /api/ping (returns env or default message)
  - /api/demo (hello response)
  - /api/schedule (see below)
- server/routes/schedule.ts
  - Validates required fields on request body
  - Returns success + ticketId (no persistence yet)
- netlify/functions/api.ts
  - serverless-http adapter for Netlify
- netlify.toml
  - Builds client, serves dist/spa, sets functions dir, redirects /api/* to function

Extension points: add authenticated CRUD endpoints, storage/DB integration, Stripe webhooks, etc.

---

## 12) Testing & Quality

- Vitest test suites:
  - client/lib/pricing.spec.ts — pricing computation
  - client/lib/utils.spec.ts — class merge utility

Recommendation: add tests for forms, reducers, and critical data mappers once DB/API is in place.

---

## 13) Known Gaps and Future Enhancements

- Auth is client-only; replace with real auth (Supabase recommended) and roles (user/admin)
- No persistence for schedule requests; store in DB and notify CRM/helpdesk
- Blog detail pages stubbed; wire to CMS or markdown/MDX
- Address checker references Mapbox/Places integrations; currently static acreage logic
- No server-side RBAC; add JWT/session verification and role checks on protected endpoints

---

## 14) Recommended Integrations (MCP Servers)

When connecting integrations, use the MCP popover in Builder:
- Builder CMS — content management, model schemas, assets
- Neon — Serverless Postgres database
- Netlify — hosting and deployments
- Zapier — automation/workflows
- Figma (Builder plugin) — design-to-code
- Linear — project management, issues
- Notion — docs/knowledge
- Sentry — error monitoring
- Context7 — up-to-date docs for libraries/frameworks
- Semgrep — security scanning
- Stripe — payments, invoices, subscriptions
- Prisma Postgres — ORM for Postgres
- Supabase — database + auth + storage + RLS (appears as MCP in this environment)

Notes:
- Prefer Supabase for auth + DB (RLS, policies, quick client SDK). If using Prisma, layer it over Supabase Postgres or Neon.
- Stripe for billing + invoices + customer portal.
- Sentry for error monitoring in both client and Netlify functions.
- Builder CMS for blog and editable marketing pages.

---

## 15) Blueprint — Customer Account Panel (Expanded /dashboard)

Information Architecture (nested routes under /dashboard):
- /dashboard — Overview (current)
- /dashboard/visits — Past/upcoming visits list; filters; details view; re-service button
- /dashboard/videos — Completion video gallery with metadata; deep-link to visit
- /dashboard/billing — Payment methods, invoices, auto-pay (Stripe)
- /dashboard/profile — Name/email/password; notification preferences; property addresses
- /dashboard/support — Contact options; re-service requests; knowledge base links

Data Model (recommended tables):
- users (id, email, name, role, created_at)
- properties (id, user_id, address, zip, acreage, created_at)
- subscriptions (id, user_id, plan_tier, cadence_days, status, created_at)
- visits (id, user_id, property_id, date, time_window, technician, status, notes, created_at)
- videos (id, visit_id, url, duration, summary, created_at)
- invoices (id, user_id, amount_cents, status, stripe_invoice_id, created_at)
- schedule_requests (id, payload_json, status, created_at)

UI/UX:
- Reuse Card, Table (data table), Tabs, Badge, Button, Dialog, Select
- Use React Query for fetching/mutations with optimistic updates where appropriate

Auth:
- Replace AuthContext with Supabase auth (email/password or magic link)
- Preserve RequireAuth wrapper but source session from Supabase

---

## 16) Blueprint — Admin Panel (/admin) with RBAC

Routes (protected by admin role):
- /admin — Overview (KPIs: new schedule requests, visits today, invoices due)
- /admin/customers — Paginated list; search/filter; customer detail page with properties and history
- /admin/visits — Calendar/list; assign technician; update status; upload video URL
- /admin/schedule-requests — Triage inbox; convert to customer + visit; status workflow
- /admin/invoices — Sync/list invoices; mark paid/refunded; link to Stripe
- /admin/content — Blog/posts (or delegate to Builder CMS); FAQs
- /admin/settings — Technicians, service areas, pricing tiers, feature flags

RBAC:
- users.role in DB ("user", "admin")
- Enforce role on server endpoints; surface claims in frontend via session

API & Data:
- CRUD endpoints for above; consider /api/admin/* namespace
- Add indexes for user_id, property_id, created_at for performance

---

## 17) Page-building Pattern for New Screens

- Add route in client/App.tsx inside the MainLayout outlet (protect with RequireAuth or AdminRequireAuth)
- Compose with PageHero, SectionHeading, Card/Table UI
- Add SEO via <Seo title/description/canonicalUrl jsonLd={...}/>
- Use React Query for data calls; colocate hooks for admin/customer features
- Follow Tailwind tokens (bg-background, text-foreground, border-border, etc.)

---

## 18) Deployment

- Netlify is configured; connect via MCP and deploy without extra setup
- API is serverless (Netlify Functions); /api/* is proxied automatically
- For temporary sharing, use the platform’s Open Preview (non-production)

---

## 19) Design System & Theming Guidance

- Colors: Use theme tokens instead of raw colors (e.g., text-foreground, bg-muted)
- Typography: Body text inherits var(--font-sans); headings use var(--font-display)
- Spacing and radius: tokens set in tailwind.config.ts (borderRadius lg/md/sm)
- Shadows: shadow-brand and shadow-soft for elevated elements

---

## 20) Implementation Notes & Risks

- Migrating to real auth requires replacing local AuthContext with Supabase (or equivalent) and updating RequireAuth
- Server endpoints must implement authorization checks (admin/user)
- Data model introduction requires form changes and React Query setup; add error handling and loading states
- Stripe integration requires secret keys (store via environment variables in the platform settings, not in code)

---

## 21) Immediate Next Steps (Suggested)

1) Connect to Supabase (auth + Postgres) and Stripe
2) Create DB schemas (users, properties, visits, videos, invoices, subscriptions, schedule_requests)
3) Replace AuthContext with Supabase auth; maintain RequireAuth but bind to session
4) Build /dashboard nested pages using real data
5) Scaffold /admin with RBAC; start with schedule-requests triage and visits management
6) Integrate Builder CMS for blog and editable site content
7) Add Sentry for error monitoring

With this context, new Admin and Customer panels can be designed and implemented consistently with the existing architecture, UI patterns, and deployment model.
