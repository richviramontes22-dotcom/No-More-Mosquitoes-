# Design Optimization & Consolidation Plan

This document outlines the identified redundancies, conflicting flows, and inconsistent UI elements in the current application, along with a concrete plan to optimize the user experience.

---

## 1. Authentication Flow Redundancy
**Issue**: Two distinct authentication experiences exist: a full-page `/login` and a global `AuthDialog` modal. Both use the same `AuthTabs` component but have slightly different redirect behaviors and entry points.

### Optimization Plan
- **Canonical Route**: Make the `/login` page the primary entry point for deep links and SEO.
- **Unify Behavior**: Standardize the redirect logic (using `redirectTo` or `from` state) into a shared utility or hook so that both the modal and page behave identically after a successful login.
- **Context-Aware Modal**: Use the modal primarily for "in-flow" actions (e.g., signing up during scheduling) and ensure it pushes a transient state to the URL so that page refreshes don't lose the user's progress.

---

## 2. Inconsistent CTA Strategy
**Issue**: The primary call-to-action is labeled differently across various sections, causing "action friction."
- **Labels found**: "Schedule Service", "Book Now", "Start Scheduling", "Reserve a Route Time", "Reserve Route".
- **Behavior**: Some open a modal directly; others redirect to `/login` or `/dashboard`.

### Optimization Plan
- **Standardize Verbiage**: Choose **"Schedule Service"** as the canonical primary CTA label.
- **Centralize Translation**: Use a single translation key (e.g., `cta.primary`) for all scheduling buttons to ensure 100% consistency.
- **Consistent Behavior**: All "Schedule Service" CTAs should follow the same logic:
  - If guest: Open `ScheduleDialog` (which handles account creation inline).
  - If authenticated: Open `ScheduleDialog` pre-filled with user data.

---

## 3. Disjointed Address Checker Flow
**Issue**: The `AddressCheckerSection` performs a property lookup but then sends the user to `/login` or `/dashboard`, losing the context of the address and acreage they just searched.

### Optimization Plan
- **State Persistence**: Pass the result of the address search (address, zip, acreage) directly into the `ScheduleDialog` as "preset" values.
- **Direct Transition**: Replace the "Reserve Route" link with a direct call to `openScheduleDialog({ preset: { ... } })`. This keeps the user in the "hot state" and increases conversion.

---

## 4. Component Duplication & Technical Debt
**Issue**: Multiple components implement the same logic (e.g., property lookup) or use raw HTML elements instead of the shared UI library.
- **Duplication**: `AddressCheckerSection` and `QuoteWidgetSection` both have identical fetch/error logic for property lookups.
- **Styling**: `SiteHeader` and other sections use raw `<button>` tags with long Tailwind classes instead of the `<Button>` component from `@/components/ui/`.

### Optimization Plan
- **Extract Logic**: Create a custom hook `usePropertyLookup` to encapsulate the Regrid API logic. Reuse this in both the checker and the quote widget.
- **Standardize UI**: Replace all raw `<button>` elements with the `@/components/ui/button` component. If specialized styles are needed (e.g., `rounded-full`), add them as variants to the base button component.
- **Cta Component**: Create a high-level `<CtaButton />` component that automatically handles the "Schedule Service" logic (checking auth state, resolving the path, opening the modal) so individual pages don't need to re-implement this logic.

---

## 5. Summary of Recommended Changes

| Component | Current State | Optimized State |
| :--- | :--- | :--- |
| **SiteHeader** | Raw buttons, custom logic | Shared `Button` component, central CTA logic |
| **AddressChecker** | Links to `/login` (loses data) | Opens `ScheduleDialog` with pre-filled data |
| **Login Page** | Custom page layout | Wrapper for standardized `AuthTabs` |
| **Property Lookup** | Duplicated in 2+ files | Unified `usePropertyLookup` hook |

---

*Prepared by Fusion (Builder.io Software Assistant)*
