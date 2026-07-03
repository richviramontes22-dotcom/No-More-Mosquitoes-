# 09 — Marketplace / Add-On Store Audit Report

**Date:** 2026-07-03

---

## Route and Components

| Item | Value |
|---|---|
| Customer route | `/dashboard/marketplace` |
| Main page | `client/pages/dashboard/Marketplace.tsx` |
| Product grid | `client/components/marketplace/ProductGrid.tsx` |
| Product card | `client/components/marketplace/ProductCard.tsx` |
| Cart panel | `client/components/marketplace/CartPanel.tsx` |
| Checkout review | `client/components/marketplace/CheckoutReview.tsx` |
| Payment dialog | `client/components/marketplace/PaymentDialog.tsx` |

---

## Data Source

- **Primary:** `catalog_items` Supabase table (RLS: public read, no auth needed)
- **Hook:** `useCatalogItems()` — React Query, 10-minute stale time
- **Fallback:** Static seed item (`SEED_CATALOG_ITEMS`) when DB is unavailable
- **Backend catalog management:** `server/routes/adminMarketplace.ts` (admin-only CRUD for catalog items)
- **Admin UI for catalog:** Not surfaced in AdminLayout nav — admins must use Supabase dashboard directly to add/edit items

---

## Product Model

```typescript
interface CatalogItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;   // ← NULL for all current items
  category: "add_on" | "product" | "consultation" | "service";
  fulfillmentType: "appointment_addon" | "physical" | "consultation" | "digital";
  priceType: "fixed" | "free" | "range" | "consultation";
  priceCents: number | null;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  imageUrl: string | null;
  requiresProperty: boolean;
  requiresSchedule: boolean;
  requiresConsultation: boolean;
  active: boolean;
  sortOrder: number;
}
```

---

## Current Catalog (14 items, 1 inactive)

| Name | Category | Price | Description |
|---|---|---|---|
| Yard Sign — Metal | product | $24.99 | NULL |
| Yard Sign — General | product | $12.99 | NULL |
| Garden Flag | product | $19.99 | NULL |
| Mosquito Dunks | product | Free | NULL |
| Fly Trap Service | add_on | $29.99 | NULL |
| Spider Web Service | add_on | $29.99 | NULL |
| Gutter Cleaning | add_on | $89.99 | NULL |
| Mosquito Fish — Gambusia | consultation | $75–$300 | NULL |
| Mosquito Fish — Koi | consultation | $75–$300 | NULL |
| Mosquito Fish — Guppy | consultation | $75–$300 | NULL |
| Mosquito Fish — Goldfish | consultation | $75–$300 | NULL |
| Mosquito Fish — Minnows | consultation | $75–$300 | NULL |
| Mosquito Fish — Betta Fish | consultation | $75–$300 | NULL |
| Mosquito Fish — Bluegill | consultation | $75–$300 | NULL |
| ~~Branded Hat~~ | ~~product~~ | ~~N/A~~ | Inactive |

---

## Pricing Model

- **Fixed:** Single price (e.g., $29.99 for Fly Trap Service)
- **Free:** $0 (Mosquito Dunks — included with service)
- **Range:** Min–max display (e.g., $75–$300 for fish consultations)
- **Consultation:** "Custom quote" (no price shown)

---

## Checkout / Add-to-Order Behavior

1. Customer adds item(s) to cart (CartContext, in-memory)
2. CartPanel opens with summary
3. "Checkout" → CheckoutReview panel
4. Customer sees: items, subtotal, tax, total, promo code input
5. Next appointment linked automatically (first upcoming Scheduled/Requested appointment)
6. "Confirm" → `POST /api/marketplace/create-payment-intent` (auth required)
7. PaymentDialog opens with Stripe Elements
8. Payment success → cart cleared, switch to My Orders tab

---

## Appointment Add-On Behavior

- Items with `requiresSchedule: true` (add-ons, services) are delivered at next service visit
- `appointmentId` is passed to payment intent creation
- No mechanism to select a different appointment — always links to next upcoming

---

## Admin Management

- Backend API exists (`adminMarketplace.ts`) for CRUD on catalog items
- **No admin UI in AdminLayout** — admins must edit catalog_items directly in Supabase dashboard
- Gap: Admin cannot manage the catalog from within the app

---

## Issues Found

### CRITICAL DATA: All descriptions are NULL
All 14 active items have `description = NULL`. ProductCard shows no description text.

**SQL to fix (pending user approval):**
```sql
UPDATE catalog_items SET description = CASE slug
  WHEN 'fly-trap-service'    THEN 'Add professional fly trap placement and monitoring to your next service visit. Targets house flies, fruit flies, and gnats in problem outdoor areas.'
  WHEN 'spider-web-service'  THEN 'Add spider web removal to your next visit. Technicians clear webs from eaves, entry doors, fences, and high-traffic outdoor areas.'
  WHEN 'gutter-cleaning'     THEN 'Clogged gutters are a top mosquito breeding site. Add a professional cleanout to eliminate standing water breeding zones at the source.'
  WHEN 'mosquito-dunks'      THEN 'EPA-registered Bacillus thuringiensis dunks for standing water. Kills mosquito larvae before they hatch — safe for pets, birds, and wildlife.'
  WHEN 'yard-sign-metal'     THEN 'Durable aluminum yard sign with metal stake. Lets your neighbors know you''re protecting your outdoor space from mosquitoes.'
  WHEN 'yard-sign-general'   THEN 'Corrugated plastic yard sign to show your neighbors you take mosquito control seriously. Lightweight and easy to place.'
  WHEN 'garden-flag'         THEN 'Decorative garden flag to proudly display your No More Mosquitoes commitment.'
  WHEN 'mosquito-fish-gambusia-affinis' THEN 'Gambusia affinis are aggressive mosquito larva eaters, ideal for ornamental ponds and slow-moving water. Includes expert consultation and stocking guidance.'
  WHEN 'mosquito-fish-koi'             THEN 'Koi are highly effective mosquito larvae consumers and add beauty to any water feature. Includes consultation on stocking density and pond compatibility.'
  WHEN 'mosquito-fish-guppy'           THEN 'Guppies thrive in warm, shallow water and consume large quantities of mosquito larvae. Ideal for small garden ponds and water containers.'
  WHEN 'mosquito-fish-goldfish'        THEN 'Goldfish readily consume mosquito larvae and are easy to maintain. A natural, chemical-free larvicide option for backyard ponds.'
  WHEN 'mosquito-fish-minnows'         THEN 'Native minnows are natural mosquito predators that thrive in local water conditions. Includes expert consultation on species selection.'
  WHEN 'mosquito-fish-betta-fish'      THEN 'Betta fish are excellent mosquito larvivores for smaller water features and containers. Includes consultation on habitat requirements.'
  WHEN 'mosquito-fish-bluegill'        THEN 'Bluegill and sunfish are powerful mosquito larvae consumers for larger ponds. Includes consultation on pond compatibility and stocking density.'
  ELSE description
END
WHERE description IS NULL;
```
**Frontend mitigation:** `catalogMetadata.ts` static fallback provides all descriptions in the UI immediately.

### No admin catalog UI
Admins cannot manage catalog items from within the app. Must use Supabase dashboard.
**Recommendation:** Future sprint — add `/admin/marketplace/catalog` with CRUD (backend already exists in `adminMarketplace.ts`).

### Consultation request is a toast only
`handleRequestConsultation` fires a toast but sends no notification.
**Recommendation:** Wire to `adminNotificationService` in future sprint.

---

## Visual Quality (Pre-Sprint)

- **Cards:** Basic — name, price, 2-line description (often empty), single CTA
- **Categories:** Flat list, no section headers
- **No badges:** No "Recommended", "Best for", etc.
- **Loading state:** Single spinner (adequate)
- **Empty state:** Minimal text placeholder
- **Mobile:** 1-column grid, functional but not premium

---

## Conversion Gaps

1. No descriptions → customer has no reason to add to cart
2. No "recommended" or "best for" signals → no differentiation
3. No expandable detail → customer cannot learn about a product before purchasing
4. No category navigation headers for "all" view
5. Consultation items (7 fish varieties) all look identical — no differentiation
6. Header copy ("Browse & Manage Orders") is transactional, not aspirational

All gaps addressed in Phase 11 implementation.
