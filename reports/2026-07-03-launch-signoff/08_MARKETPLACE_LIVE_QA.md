# Phase 08 — Live Marketplace QA at 390px

**Date:** 2026-07-13  
**Sprint:** Production Launch Verification

---

## Status: BLOCKED — Requires Live Browser Session (Customer or Guest)

Browser automation is not available in this environment. The following checks require a real
browser (or Chrome DevTools device emulation) at `https://nomoremosquitoes.us/dashboard/marketplace`.

---

## Code-Level Verification (Completed)

| Check | Method | Status |
|---|---|---|
| 1-column grid at 320–414px (`grid-cols-1`) | Tailwind CSS class analysis | ✅ |
| 2-column grid at sm+ (`sm:grid-cols-2`) | Tailwind CSS class analysis | ✅ |
| 3-column grid at lg+ (`lg:grid-cols-3`) | Tailwind CSS class analysis | ✅ |
| Badge overlay: `absolute top-3 left-3` + `backdrop-blur-sm` | `ProductCard.tsx` | ✅ |
| Category chip: `absolute top-3 right-3 rounded-full bg-black/40` | `ProductCard.tsx` | ✅ |
| Best-for tags: `flex gap-1.5 flex-wrap` (no overflow at narrow widths) | `ProductCard.tsx` | ✅ |
| Learn More: `line-clamp-2` collapsed, `ChevronDown`/`ChevronUp` toggle | `ProductCard.tsx` | ✅ |
| Filter chips: `flex flex-wrap gap-1` (wraps at narrow widths) | `ProductGrid.tsx` | ✅ |
| Category section headers in "all" view | `ProductGrid.tsx` | ✅ |
| No horizontal overflow (all `max-w-full` or contained) | CSS analysis | ✅ |
| Consultation button: async → ticket created, toast fires | `Marketplace.tsx` handler | ✅ |
| Cart open/close button present | `Marketplace.tsx` | ✅ |

---

## Manual Browser QA Steps (to perform at 390px width)

1. **Open Chrome DevTools → Toggle Device Toolbar → 390px × 844px (iPhone 14)**
2. Navigate to `https://nomoremosquitoes.us/dashboard/marketplace`
   - Log in as a QA customer or guest

3. **Layout check**
   - Confirm 1-column card grid
   - Confirm no horizontal scrollbar on body

4. **Badge + chip positioning**
   - On a featured/recommended item: confirm colored badge in top-left of image
   - Confirm category chip in top-right of image
   - Confirm neither badge overlaps card title below the image

5. **Learn More expansion**
   - Tap "Learn More" → description expands
   - Tap "Show Less" → description collapses
   - Confirm no layout shift on adjacent cards

6. **Filter chips**
   - Tap a category chip filter → confirm cards filter
   - Confirm filter chips wrap (do not overflow horizontally)

7. **Consultation request**
   - Tap "Request Consultation" on any add-on item
   - Confirm button shows loading state briefly
   - Confirm toast: "Consultation request sent — Our team will follow up..."
   - Check Supabase → tickets table: confirm new ticket with subject "Marketplace Consultation Request: {item name}"

8. **Cart**
   - Add a product to cart → confirm cart panel slides open
   - Close cart → confirm panel closes
   - Confirm cart icon shows item count badge

---

## Pass Criteria

All 8 manual steps complete without errors at 390px. No console errors. Cart, filter, and
consultation all functional. No badges overlapping text content.

---

## Verdict

| Check | Status |
|---|---|
| Code-level: layout, badges, filter, consultation | ✅ All verified |
| Browser: 390px visual, interaction, cart, toast | ⏳ BLOCKED — requires live browser |

**Phase 08: BLOCKED — browser session required. All code-level checks PASS.**
