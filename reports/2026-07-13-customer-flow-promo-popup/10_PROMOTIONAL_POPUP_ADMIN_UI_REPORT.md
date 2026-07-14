# Report 10 — Promotional Popup Admin UI

**Sprint:** Customer-Facing Flow Cleanup + Promo Popup System  
**Phase:** 10  
**Date:** 2026-07-13  
**Status:** COMPLETE

---

## Files Created / Modified

### New: `client/pages/admin/PromotionsManagement.tsx`

Full CRUD management page at `/admin/promotions`.

**Structure:**

```
PromotionsManagement
├── Stats bar (Total / Active / Scheduled / Inactive)
├── Popups table
│   ├── Status badge (Active / Scheduled / Inactive)
│   ├── Title + subtitle preview
│   ├── Audience + frequency tags
│   ├── Date range
│   └── Actions: Edit | Preview | Activate/Deactivate
└── Create/Edit Dialog
    ├── Title, Subtitle (optional)
    ├── Body (optional)
    ├── Image URL (optional) — at least one of body/image required
    ├── CTA Label + CTA URL
    ├── Secondary Label + Secondary URL
    ├── Audience selector
    ├── Page Target selector (shows Custom Path input if "custom")
    ├── Start At / End At datetime-local inputs
    ├── Active toggle
    ├── Frequency selector
    └── Priority integer input
```

**Status badge logic:**
- `active: false` → "Inactive" (grey)
- `active: true` + `start_at > now()` → "Scheduled" (yellow)
- `active: true` + within date range → "Active" (green)

**Client-side validation (before POST/PATCH):**
- Title required
- Body or image_url required (at least one)
- If cta_url set → cta_label required
- If secondary_url set → secondary_label required
- URL format check (must start with `http://`, `https://`, or `/`)
- If both start_at and end_at set → end_at must be after start_at
- Priority must be a valid integer

**Preview Dialog:**  
Opens a visual mockup of the popup (title, subtitle, body, image, CTAs) using the same layout
as `PromotionalPopup.tsx`, letting admins verify appearance before activating.

**Activate/Deactivate toggle:**  
PATCH `{ active: !popup.active }` — instant toggle without opening the edit dialog.

**Soft delete on table delete:** Uses `DELETE /api/admin/promotional-popups/:id` (default
deactivates; hard delete not exposed from UI — available via `?hard=true` API only).

### Modified: `client/pages/admin/AdminLayout.tsx`

`Megaphone` already imported; "Promotions" entry already added to the Content nav group in a
prior session. Verified present at nav position Content → Promotions → `/admin/promotions`.

### Modified: `client/App.tsx`

Route `<Route path="promotions" element={<AdminPromotionsManagement />} />` already added
inside the `/admin` route tree. Import `AdminPromotionsManagement` already present.

---

## Heading Fix (TypeScript)

`SectionHeading` does not accept an `icon` prop. Replaced:

```tsx
// Before (TypeScript error)
<SectionHeading icon={<Megaphone ... />} title="..." description="..." />

// After (inline heading)
<div>
  <div className="flex items-center gap-2 mb-1">
    <Megaphone className="h-5 w-5 text-primary" />
    <h1 className="text-2xl font-bold font-display">Promotional Popups</h1>
  </div>
  <p className="text-sm text-muted-foreground">Create and manage customer-facing promotional popups.</p>
</div>
```

`SectionHeading` import also removed (was the only usage).

---

## Data Flow

```
Admin opens /admin/promotions
  → useQuery GET /api/admin/promotional-popups
  → renders table

Admin clicks "New Popup"
  → opens Dialog, form state initialized to defaults
  → on Save: useMutation POST /api/admin/promotional-popups
  → on success: invalidateQueries ["promotional-popups-admin"]

Admin clicks Edit row
  → opens Dialog pre-filled with popup data
  → on Save: useMutation PATCH /api/admin/promotional-popups/:id

Admin clicks Activate/Deactivate
  → useMutation PATCH { active: !current }
```

All mutations use `@tanstack/react-query` mutations with toast on success/error and cache
invalidation on settle.
