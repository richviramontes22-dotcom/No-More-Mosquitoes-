# Phase 02 — Customer-Facing Route & CTA Inventory

**Date:** 2026-07-13  
**Sprint:** Customer-Facing Flow Cleanup + Promo Popup System

---

## Method

Live code audit of all public and customer-facing page/component files. Every `<Button>`, `<Link>`, `<a>`, `<NavLink>`, `onClick → navigate()`, and `tel:` was traced.

---

## Phone Number Source

`(949) 297-6225` is defined once in `client/data/site.ts` as `siteConfig.phone.display` / `.link`. Nearly all `tel:` links use this. Two exceptions:
- `client/seo/structuredData.ts` lines 7 and 118: `telephone: "+1-949-297-6225"` — hardcoded in JSON-LD structured data (acceptable; JSON-LD is static)
- `client/lib/translations.ts` `hero.callOrText: "Call or Text (949) 297-6225"` — number embedded in translation string (fixed in Phase 12)

---

## Persistent UI (all public pages)

### SiteHeader

| CTA | Label | Destination | Notes |
|---|---|---|---|
| Logo | (image) | `/` | |
| Phone icon (mobile only) | sr-only | `siteConfig.phone.link` | |
| Language selector (desktop + mobile) | Flag icon / dropdown | Sets LanguageContext | ⚠️ Removed in Phase 7 |
| Log in / Sign up (guest) | "Log in / Sign up" | `/login` | |
| Sign out (auth) | "Sign out" | `logout()` | |
| Mobile drawer — Schedule Service | "Schedule Service" | Guest → `/schedule`; customer → `/dashboard/appointments` | Smart-routes |
| Mobile drawer — all public nav links | (8 links) | Standard routes | |

### SiteFooter

| CTA | Destination | Notes |
|---|---|---|
| Phone | `siteConfig.phone.link` | |
| Email | `mailto:siteConfig.email` | |
| 10 Explore links | Standard routes | |
| 6 Legal links | `/privacy`, `/terms`, `/guarantee`, `/licenses`, `/legal/service-agreement`, `/legal/pesticide-consent` | |
| 5 Social icons | External URLs | |

### ChatWidget (floating, all public pages)

| CTA | Destination |
|---|---|
| "Talk to an Agent" | Crisp live chat; fallback → `/contact` |
| "Call or Text" | `siteConfig.phone.link` |
| "Email Us" | `mailto:siteConfig.email` |
| "Send a Message" | `/contact` |

---

## Public Pages

### Homepage (`/`)

| CTA | Destination | Notes |
|---|---|---|
| Hero primary: "Get My Free Quote" | `/#quote` | Scrolls to QuoteWidgetSection ✅ |
| Hero secondary: "See Pricing" | `/pricing` | |
| Hero phone: "Call or Text (949) 297-6225" | `siteConfig.phone.link` | |
| ScheduleSection: "Launch schedule" | Guest → `/login`; customer → `/dashboard/appointments` | |
| PlanCardsSection CTAs (×3) | Guest → signup; customer → `/dashboard/appointments`; annual → `/contact` | |
| ContactSection: "Call or Text" | `siteConfig.phone.link` | |
| ContactSection: "Book Online" | Guest → `/login`; customer → `/dashboard/appointments` | |

### `/pricing`

| CTA | Destination |
|---|---|
| "Get My Quote" | `href="#quote"` |
| QuoteWidgetSection (full) | (see below) |
| PlanCardsSection (full) | (see above) |
| CtaBand: "Schedule a walkthrough" | `/schedule` → smart-routes |

### `/services`

| CTA | Destination |
|---|---|
| PageHero: "Schedule Service" | `/schedule` |
| CtaBand: "Check Pricing" | `/pricing` |

### `/schedule`

| CTA | Destination |
|---|---|
| "Start scheduling" | scrolls to `#schedule-form` |
| "Call our team" | `siteConfig.phone.link` |
| QuoteWidgetSection (full) | (see below) |
| CtaBand: "Call or text (949) 297-6225" | `siteConfig.phone.link` |

### `/contact`

| CTA | Destination | Notes |
|---|---|---|
| "Send Message" form | `supabase.from("contact_inquiries")` | |
| Phone | `siteConfig.phone.link` | |
| Email | `mailto:info@nomoremosquitoes.us` | ⚠️ Hardcoded — not from siteConfig |
| "View service areas →" | `/service-area` | |
| Quick links (×4) | `/pricing`, `/schedule`, `/faq`, `/login` | |
| CtaBand: "Schedule Service" | `/schedule` → smart-routes | |

### `/login`

| CTA | Destination |
|---|---|
| "Back to site" | `/` |
| "Contact support" | `/contact` |
| AuthTabs (form) | Auth → admin/employee/onboarding/dashboard |

### Legal / Info pages (`/privacy`, `/terms`, `/guarantee`, `/licenses`, etc.)

- No conversion CTAs. Back/footer links only.

---

## QuoteWidgetSection (used on `/`, `/pricing`, `/schedule`)

This is the primary conversion funnel. It contains two phases:

**Phase 1 — Address entry:**
- `GoogleAddressAutocomplete` input → parcel lookup → returns pricing
- "Get My Price" submit button
- "Notify Me" (out-of-area waitlist)
- "Use 0.25 ac" / "See Pricing" (manual acreage fallback)

**Phase 2 — Plan selection:**
- Plan tiles (Recurring / One-Time / Annual)
- Frequency buttons
- **"Schedule Service" CTA** → customer → `ScheduleDialog`; staff → toast error; guest → `/login` with plan preset

This is the correct conversion path: address → acreage → pricing → plan selection → schedule.

---

## Customer Dashboard

### `/dashboard` (overview)

Standard dashboard with navigation cards to sub-routes.

### `/dashboard/appointments`

| CTA | Action |
|---|---|
| "New Appointment" | Opens ScheduleDialog |
| "Reschedule" (per visit) | Opens RescheduleDialog |
| "Complete Checkout" | → `/dashboard/marketplace` |
| "Schedule Service" (empty state) | Opens ScheduleDialog |

### `/dashboard/billing`, `/dashboard/properties`, `/dashboard/profile`, `/dashboard/help`

Standard dashboard sub-pages with contextual CTAs.

### `/dashboard/marketplace`

| CTA | Action |
|---|---|
| "Add to Cart" / checkout | → Stripe checkout |
| "Request Consultation" | POST `/api/marketplace/consultation-request` → ticket + admin alert |

---

## Findings Summary

| Issue | Severity | Location | Fix |
|---|---|---|---|
| Language selector in header | Medium — clutter | SiteHeader.tsx | Remove (Phase 7) |
| Phone number in translation string | Low | `translations.ts` `hero.callOrText` | Use `siteConfig` directly (Phase 12) |
| Email hardcoded in Contact.tsx | Low | `Contact.tsx` line 188 | Cosmetic — not a blocker |
| Available slot counts shown | High | `Appointments.tsx`, `ScheduleFlow.tsx` | Remove count (Phase 5) |
| Unavailable slots shown greyed | Medium | `Appointments.tsx`, `ScheduleFlow.tsx` | Hide entirely (Phase 5) |

### No Broken Routes Found

All audited links resolve to existing routes. No dead routes or 404 risks in the public navigation.

### No Redundant Primary CTAs

The hero correctly funnels users into the quote widget. `CtaBand` standardizes the "Schedule" path across pages. `PlanCardsSection` smartly branches on auth state. No truly conflicting duplicate CTAs were found.
