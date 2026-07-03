# 03 — Admin Catalog Management Design Report

**Date:** 2026-07-03

---

## Route

`/admin/catalog`

**Navigation group:** Content — alongside "Website Manager" and "Blog & FAQs"

**Rationale:** The catalog is a content-management concern (what the store displays) managed through the CMS router (`adminCms.ts`). Finance manages pricing/billing/promotions. Content manages what appears to customers. "Catalog" fits Content because:
- Its backend is in `adminCmsRouter` (CMS = Content Management System)
- It controls what catalog items appear in the customer-facing store
- It's adjacent to Website Manager (which also controls customer-facing display content)

---

## Nav Entry

```ts
{ label: "Catalog", to: "/admin/catalog", icon: Store }
```

Added as first item in the `content` nav group so it's immediately visible when the group opens.

---

## UI Sections

### 1. Catalog Overview (Stats Bar)

6 stat chips in a grid:
- **Total** items (all)
- **Active** items (visible to customers)
- **Inactive** items (hidden)
- **No Description** (count — amber warning color if > 0)
- **No Image** (count — amber warning color if > 0)
- **Consultation** (count requiring custom quotes)

Plus a "Customer view →" external link to `/dashboard/marketplace`.

### 2. Catalog Table

**Columns:**
- Image preview (32×32 thumbnail or placeholder icon)
- Name + slug (stacked, slug in monospace)
- Category (badge)
- Price (formatted: $X.XX / Free / $X–$Y / Custom quote)
- Sort order
- Status badge (Active/Inactive)
- Actions: Edit (pencil) + Activate/Deactivate (power icon)

**Features:**
- Sort by `display_order` from API
- Search by name or slug
- Filter by category (All / Add-On / Product / Consultation / Service)
- Filter by status (All / Active only / Inactive only)
- Clear filters button

### 3. Item Editor Dialog

**Create** (opens with empty form, auto-generates slug from name)  
**Edit** (opens with pre-filled form from existing item)

**Fields:**
- Name (required)
- Slug (required, auto-slugified from name on create, URL-safe validation)
- Description (textarea)
- Category (select: Add-On / Product / Consultation / Service)
- Fulfillment Type (select: appointment / shipped / consultation / digital)
- Price Type (select: fixed / free / range / consultation)
- Conditional price fields:
  - Fixed: `price_cents` input (labeled in cents with $X.XX hint)
  - Range: `min_price_cents` + `max_price_cents`
  - Free/Consultation: no price fields
- Image URL (optional, validated https://)
- Display Order (number)
- Toggle group (Active, Featured, Requires Property, Requires Schedule, Requires Consultation)

### 4. Activate/Deactivate

- Inline icon button in table row (power-off = deactivate, power = activate)
- Fires PATCH `{active: false|true}`
- Toast confirmation
- No hard delete UI (uses `active=false` semantics per mission spec)
- Inline loading spinner during toggle

### 5. Preview

- "Customer view" link opens `/dashboard/marketplace` in a new tab
- No inline card duplication (avoids code maintenance overhead, marketplace already has live preview)

---

## Validation Rules

| Rule | Implementation |
|---|---|
| Name required | `!form.name.trim()` |
| Slug required | `!form.slug.trim()` |
| Slug URL-safe | `/^[a-z0-9-]+$/` test |
| Category valid | Check against `["add_on","product","consultation","service"]` |
| Fulfillment type valid | Check against known values |
| Price type valid | Check against known values |
| Fixed price requires priceCents | `isNaN(p) \|\| p < 0` |
| Range requires min+max, min ≤ max | Numeric validation + comparison |
| Image URL format | `/^https?:\/\/.+/` or empty |
| Display order numeric | `isNaN(Number(order))` |

All errors shown together in a red banner at the top of the dialog.

---

## Permission Safety

- Route lives under `/admin` path, wrapped by existing `RequireAdmin` + `AdminLayout`
- All API calls include `Authorization: Bearer <token>` from the active admin session
- `requireAdmin` on every backend endpoint provides independent server-side enforcement
- No direct Supabase client writes from the UI (all go through the admin REST API)
