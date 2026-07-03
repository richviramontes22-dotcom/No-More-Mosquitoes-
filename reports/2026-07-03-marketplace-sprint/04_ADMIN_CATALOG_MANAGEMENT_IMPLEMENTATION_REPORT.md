# 04 — Admin Catalog Management Implementation Report

**Date:** 2026-07-03

---

## Files Created/Modified

| File | Change |
|---|---|
| `client/pages/admin/CatalogManagement.tsx` | **New** — full admin CRUD page |
| `client/pages/admin/AdminLayout.tsx` | Added `Store` icon import + "Catalog" nav entry in Content group |
| `client/App.tsx` | Added `AdminCatalogManagement` import + `/admin/catalog` route |
| `server/routes/adminCms.ts` | PATCH allowed fields extended with `slug`, `requires_property`, `requires_schedule`, `requires_consultation` |

---

## Route

`/admin/catalog` — protected by `RequireAdmin` through `AdminLayout`

---

## Key Implementation Details

### Data Fetching

```tsx
const fetchItems = useCallback(async () => {
  const token = await getToken(); // supabase.auth.getSession()
  const res = await fetch("/api/admin/cms/catalog", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  setItems(data.items || []);
}, [getToken]);
```

Fetches all items (active + inactive) on mount and after any mutation.

### Form State Management

- `EMPTY_FORM` constant for create mode
- `rowToForm(row)` converts API row → form state for edit mode
- `formToPayload(form)` converts form state → API body (handles cents/null coercion)
- `handleNameChange()` auto-slugifies name to slug during create (not edit, to avoid breaking existing URLs)

### Slug Auto-generation

```ts
const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
```

### Validation

`validateForm(form)` returns `string[]` of error messages. All errors shown as a red banner before the save button can succeed.

### Save Flow

```tsx
const handleSave = async () => {
  const errors = validateForm(form);
  if (errors.length > 0) { setFormErrors(errors); return; }
  // POST for create, PATCH for edit
  // Toast success/error
  // Re-fetch on success
};
```

### Activate/Deactivate

```tsx
await fetch(`/api/admin/cms/catalog/${row.id}`, {
  method: "PATCH",
  body: JSON.stringify({ active: !row.active }),
});
```

Uses `PowerOff` icon for active items, `Power` icon for inactive items. Inline spinner during request. No hard delete available.

### Price Display

```ts
const formatPriceDisplay = (row: CatalogRow): string => {
  switch (row.price_type) {
    case "fixed": return formatCents(row.price_cents);
    case "free": return "Free";
    case "range": return `${formatCents(row.min_price_cents)} – ${formatCents(row.max_price_cents)}`;
    case "consultation": return "Custom quote";
  }
};
```

### Conditional Price Fields

The dialog only shows price input fields relevant to the selected price type:
- `fixed` → price in cents field
- `range` → min + max fields
- `free` / `consultation` → no price fields

---

## Stats Bar

```tsx
// Derived from items array (no additional API call)
const total = items.length;
const active = items.filter((i) => i.active).length;
const inactive = total - active;
const missingDesc = items.filter((i) => !i.description).length;
const missingImg = items.filter((i) => !i.image_url).length;
const consultationCount = items.filter((i) => i.price_type === "consultation").length;
```

---

## Auth Safety

- Page is inside `RequireAdmin > AdminLayout` — non-admin users never reach it
- All fetch calls include the admin session token
- Server-side `requireAdmin` provides independent enforcement (defense in depth)

---

## Business Logic Preserved

- Customer marketplace checkout: **unchanged**
- `useCatalogItems` hook (customer view): **unchanged** — only fetches `active=true` items
- Cart, CartPanel, CheckoutReview, PaymentDialog: **unchanged**
- Catalog `catalogMetadata.ts` fallback: **unchanged** — DB description takes precedence when set

---

## What's NOT Included (by design)

- Image upload (no Supabase Storage upload — URL-only; adding upload requires new sprint scope)
- Hard delete UI (no permanent deletion of items with possible order history)
- Bulk operations (out of scope)
- Full impersonation/preview (link to customer view in new tab is sufficient)

---

## Validation

- `pnpm typecheck`: 0 errors ✅
- `pnpm test`: 223/223 ✅
- `pnpm build`: clean ✅
- `pnpm bundle:functions`: 7/7 ✅
