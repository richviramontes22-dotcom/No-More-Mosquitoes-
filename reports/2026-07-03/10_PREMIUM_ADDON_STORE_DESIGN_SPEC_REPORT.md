# 10 — Premium Add-On Store Design Spec Report

**Date:** 2026-07-03

---

## Design Goals

1. **Premium visual hierarchy** — more whitespace, stronger type scale, elevated cards
2. **Benefit-driven copy** — every card shows what it does FOR the customer, not just what it is
3. **Trust and context** — badge signals (Recommended, Popular, Eco-Friendly), Best-for tags
4. **Scannable structure** — category section headers with icons when viewing "all"
5. **Progressive disclosure** — 2-line preview with "Learn more" expansion
6. **Mobile-first** — 1 column on mobile, 2 on tablet, 3 on desktop
7. **No cheap e-commerce look** — no star ratings, no fake review counts, no discount badges
8. **Brand-consistent** — NMM green primary color, rounded corners, soft shadows

---

## Card Design

### Before (pre-sprint)
- No category badge
- Name + price only visible
- Description: usually empty (NULL), clamped to 2 lines
- No "best for" context
- No expandable detail
- Single CTA button

### After (this sprint)
- **Badge overlay** (top-left): Recommended (primary/green), Popular (amber), Eco-Friendly (green), Value (emerald), New (blue)
- **Category chip** (top-right): dark translucent "Add-On" / "Product" / "Consultation"
- **Name** — larger font, bold
- **Price** — same line as name, larger, tabular numbers
- **Best for** — small uppercase label below name
- **Description** — up to 2 lines, "Learn more" / "Less" toggle for longer descriptions
- **Notice** — "Delivered at next visit" or "Consultation required" info box
- **Compatibility pills** — "One-time" / "Subscription add-on"
- **CTA** — "Add to Cart" or "Request Consultation" (unchanged behavior)

---

## Category Section Headers (All View)

When viewing all items, items are grouped by category with section headers:

| Category | Icon | Descriptor |
|---|---|---|
| Add-On Services | Wrench | "Enhancements delivered at your next visit" |
| Products | Package | "Yard signs, treatments, and branded items" |
| Consultations | MessageCircle | "Expert guidance and custom solutions" |
| Services | Layers | "Standalone professional services" |

Each header shows: icon, category label, descriptor, item count.

---

## Category Filter Chips

- Condensed labels: "All Items", "Add-Ons", "Products", "Consultations", "Services"
- Shows item count badge on each chip
- Active chip: primary background
- Only shows categories with items

---

## Static Metadata Map

`client/lib/marketplace/catalogMetadata.ts` provides per-item enrichment keyed by `slug`:

| Field | Type | Usage |
|---|---|---|
| `description` | string | Fallback when DB description is null |
| `bestFor` | string | "Best for: X" display |
| `badge` | "recommended" \| "popular" \| "eco" \| "value" \| "new" | Badge type |
| `oneTimeCompatible` | boolean | Shows "One-time" pill |
| `recurringCompatible` | boolean | Shows "Subscription add-on" pill |

DB description always takes precedence over static fallback.

---

## Badge Assignments

| Item | Badge |
|---|---|
| Fly Trap Service | Popular |
| Gutter Cleaning | Recommended |
| Mosquito Fish — Gambusia | Recommended |
| Mosquito Fish — Minnows | Eco-Friendly |
| Mosquito Dunks | Eco-Friendly |
| Yard Sign Metal | Popular |
| Yard Sign General | Value |

---

## Empty/Loading States

- **Loading:** Spinner + "Loading catalog…" text (centered)
- **Empty (no items):** Package icon + "No items available yet" + subtext
- **Empty (filtered category):** "No [category] available" message
- **Error:** Red error card with icon and message

---

## What Was NOT Changed

- Cart/checkout flow (CartContext, CartPanel, CheckoutReview, PaymentDialog)
- Backend payment logic
- Catalog data source (Supabase `catalog_items` table)
- Pricing calculation
- Promo code handling
- Order history (My Orders tab)
- Consultation request behavior (still toast-only, documented as future work)

---

## Responsive Breakpoints

| Viewport | Grid Columns |
|---|---|
| < 640px (sm) | 1 column |
| 640px–1024px | 2 columns |
| > 1024px (lg) | 3 columns |
