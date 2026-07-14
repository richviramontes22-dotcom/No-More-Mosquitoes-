# Report 09 — Promotional Popup Backend Implementation

**Sprint:** Customer-Facing Flow Cleanup + Promo Popup System  
**Phase:** 9  
**Date:** 2026-07-13  
**Status:** COMPLETE

---

## Files Created / Modified

### New: `db/migrations/2026-07-13_create_promotional_popups.sql`

Creates the `promotional_popups` table with all columns, check constraints on `audience` and
`page_target`, `frequency`, and an RLS policy limiting public reads to active/current rows.
Apply via Supabase SQL Editor in filename order.

### New: `server/routes/adminPromotionalPopups.ts`

Express Router implementing all admin CRUD + public active endpoint.

**Key implementation details:**

```ts
// Admin list — newest first
router.get("/promotional-popups", requireAdmin, async (req, res) => {
  const db = supabaseAdmin ?? supabase;
  const { data, error } = await db
    .from("promotional_popups")
    .select("*")
    .order("created_at", { ascending: false });
  ...
});

// Create
router.post("/promotional-popups", requireAdmin, async (req, res) => {
  // Validates: title required, body or image_url required,
  //            cta_label required if cta_url set, cta_url safe scheme check,
  //            end_at > start_at if both set
  ...
});

// Soft-delete (deactivate); ?hard=true for permanent delete
router.delete("/promotional-popups/:id", requireAdmin, async (req, res) => {
  if (req.query.hard === "true") {
    await db.from("promotional_popups").delete().eq("id", id);
  } else {
    await db.from("promotional_popups").update({ active: false }).eq("id", id);
  }
});

// Public active endpoint — uses anon supabase (RLS applies)
router.get("/promotional-popups/active", async (req, res) => {
  const path = (req.query.path as string) || "/";
  // Fetches active rows via supabase (anon), filters by page_target server-side,
  // returns highest-priority match or { popup: null }
});
```

**`isValidCtaUrl(url: string): boolean`** — rejects `javascript:`, `data:`, `vbscript:` schemes.

### Modified: `server/index.ts`

Added router import and double-mount after the `adminLeadsRouter` block:

```ts
import adminPromotionalPopupsRouter from "./routes/adminPromotionalPopups";

// Admin-protected CRUD
app.use("/api/admin", adminPromotionalPopupsRouter);
// Public active endpoint: GET /api/promotional-popups/active
app.use("/api", adminPromotionalPopupsRouter);
```

The double-mount follows the established pattern used by `adminPromosRouter` and
`adminServiceAreasRouter`.

---

## Validation

Input validation on create/update:
- `title` — required, non-empty string
- `body` or `image_url` — at least one required
- `cta_url` — if provided, must pass `isValidCtaUrl()` and `cta_label` must be set
- `secondary_url` — same scheme check
- `end_at` — if both `start_at` and `end_at` provided, `end_at` must be after `start_at`
- `priority` — must be a finite integer if provided

All validation errors return HTTP 400 with a descriptive message.

---

## Server Mount Verification

After adding to `server/index.ts`:
- `GET /api/admin/promotional-popups` → `requireAdmin` guard → list handler ✓
- `POST /api/admin/promotional-popups` → `requireAdmin` guard → create handler ✓
- `PATCH /api/admin/promotional-popups/:id` → `requireAdmin` guard → update handler ✓
- `DELETE /api/admin/promotional-popups/:id` → `requireAdmin` guard → delete handler ✓
- `GET /api/promotional-popups/active` → no auth → public handler ✓

Build check: `pnpm build` clean; `pnpm bundle:functions` 7/7 (api.cjs includes new route).
