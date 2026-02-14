# Comprehensive Website Atlas: No More Mosquitoes

This document serves as a high-density, context-rich report of the entire "No More Mosquitoes" web ecosystem. It is optimized for AI analysis, detailing every page's code structure, text content, and hierarchical relationships.

---

## 1. System Hierarchy Map (`client/App.tsx`)
*This file defines the routing architecture and layout wrapping for the entire application.*

```tsx
// [Logic Summary]
// - Public Routes: MainLayout > { Index, Pricing, Services, Our Story, Reviews, Service Area, FAQ, Blog, Schedule, Login }
// - Protected Dashboard: RequireAuth > DashboardLayout > { Appointments, Billing, Properties, Messages, Support, Videos, Profile }
// - Protected Admin: RequireAdmin > AdminLayout > { Overview, Customers, Properties, Visits, Billing, Content, Pricing, Reports, Settings }
// - Protected Employee: RequireEmployee > EmployeeLayout > { Dashboard, Assignments, Messages, Timesheets, Profile }
// - Dynamic Placeholders: Terms, Privacy, Guarantee, Licenses
```

---

## 2. Content Data Lake (Shared Constants & Business Data)

### 2.1 Pricing & Service Area (`client/data/site.ts`)
```tsx
// Pricing Brackets (Updated per IMG_6055 Chart)
export const pricingTiers = [
  { min: 0.01, max: 0.13, subscription: 95, annual: 999 },
  { min: 0.14, max: 0.2, subscription: 110, annual: 1200 },
  { min: 0.21, max: 0.3, subscription: 125, annual: 1350 },
  { min: 0.31, max: 0.4, subscription: 135, annual: 1450 },
  { min: 0.41, max: 0.5, subscription: 145, annual: 1600 },
  { min: 0.51, max: 0.6, subscription: 165, annual: 1800 },
  { min: 0.61, max: 0.7, subscription: 175, annual: 1900 },
  { min: 0.71, max: 0.8, subscription: 195, annual: 2100 },
  { min: 0.81, max: 1.15, subscription: 215, annual: 2300 },
  { min: 1.16, max: 1.29, subscription: 230, annual: 2500 },
  { min: 1.3, max: 1.5, subscription: 250, annual: 2700 },
  { min: 1.51, max: 2, subscription: 270, annual: 2900 },
  { min: 2.01, max: Infinity, subscription: "custom", annual: "custom" },
];

// Service Area (Orange County ZIP Codes)
export const serviceAreaZipCodes = ["92602", "92603", "92618", "92620", "92625", "92626", "92627", "92657", "92660", "92661", "92663", "92694", "92708"];
```

### 2.2 Leadership & Team (`client/data/team.ts`)
- **Richard Noble:** Founder & Lead Technician (Licensed operator).
- **Elijah Noble:** Operations & Customer Care (Scheduling & route optimization).
- **Maya Velasquez:** Field Quality Supervisor (Calibration & safety).

### 2.3 Media Assets (`client/data/media.ts`)
- High-resolution hero and lifestyle images optimized for WebP.
- Focus: Families in backyards, technicians in gear, lush Orange County pool decks.

---

## 3. Public Marketing Pages (Code & Content)

### 3.1 Home Page (`Index.tsx`)
**Structural Code:**
- `HeroSection`: Full-screen carousel, text shadow optimization for legibility.
- `QualityAssuranceSection`: Badges for Safety, Transparency, Accountability.
- `AddressCheckerSection`: Integrated with **Regrid API** for acreage lookups.
- `QuoteWidgetSection`: Live price calculator with acreage slider.
- `PlanCardsSection`: Subscription vs Annual vs One-time cards.
- `PestGridSection`: Grid of pests treated (Mosquitoes, Ticks, Ants, etc.).
- `VideoProofSection`: Sample HD completion videos.

### 3.2 Pricing & Plans (`Pricing.tsx`)
**Structural Code:**
- `PageHero`: Eyebrow "Transparent Pricing", Flag of US & CA imagery.
- `QuoteWidgetSection`: Primary interactive tool.
- `FAQSection`: Filtered for Pricing/Safety questions.
- `CtaBand`: Custom acreage walkthrough link.

### 3.3 Services (`Services.tsx`)
**Structural Code:**
- `PageHero`: Split layout highlighting employee-based techs.
- `Core Treatments Grid`: Mosquito perimeter, Larvicide, Tick defense.
- `Add-on Defense`: Ants, Spiders, Ticks precision treatments.

---

## 4. Secure Customer Dashboard (`/dashboard`)
*Logic: All dashboard sub-routes are wrapped in `MainLayout` and `DashboardLayout`.*

### 4.1 Overview (`Dashboard.tsx`)
- **Interactive Items:**
  - `Schedule Visit` (Button) → `/schedule`
  - `Update Contact` (Button) → `/contact`
  - `Watch Video` (External) → Secure portal link.
  - `Sign Out` (Action) → Destroys session, redirects to `/login`.

### 4.2 Billing (`dashboard/Billing.tsx`)
- **Integration Points:**
  - `Change Plan` (Button)
  - `Update Cadence` (Button)
  - `Open Billing Portal` (External) → Stripe/Provider integration.

---

## 5. Language & Copy Repository (`translations.ts`)
*This contains the definitive "Text Form" of the website in English and Spanish.*

### [English Key Excerpts]
- **Hero Title:** "Enjoy the comfort of your yard all season"
- **Mission:** "Safe, fast, reliable mosquito and pest control in Orange County—backed by our 100% satisfaction guarantee."
- **Guarantee:** "If mosquitoes return between visits, we treat again at no charge."
- **Safety:** "California-approved formulations applied in precise zones. Surfaces are dry within 30 minutes."

### [Spanish Key Excerpts]
- **Hero Title:** "Los Insectos No Pertenecen a Tu Hogar."
- **Servicios:** "Control de mosquitos primero—más defensa contra hormigas, arañas y garrapatas."

---

## 6. Functional Integration Registry

| Feature | Code Path | Integration Logic |
| :--- | :--- | :--- |
| **Acreage Lookup** | `server/routes/regrid.ts` | Proxies Regrid API to fetch Parcel data securely. |
| **Pricing Calculation** | `client/lib/pricing.ts` | Implements proportional scaling: `visitPrice * (30 / frequency)`. |
| **Auth Flow** | `client/contexts/AuthContext.tsx` | Manages JWT/Session state for Dashboard access. |
| **Scheduling** | `client/schedule/ScheduleDialog.tsx` | multi-step wizard: Address > Cadence > Lock-in. |

---

*End of Atlas. This document is a living record and should be updated whenever pricing data, operational zip codes, or site architecture changes.*
