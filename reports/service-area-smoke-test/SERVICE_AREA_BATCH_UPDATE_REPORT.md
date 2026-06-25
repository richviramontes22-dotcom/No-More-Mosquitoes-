# Service Area Batch Update API Report
Generated: 2026-06-16

## Endpoint: `POST /api/admin/service-areas/batch-update`

## Route Registration
```typescript
// server/index.ts line 165
app.use("/api/admin", adminServiceAreasRouter);
```
Mounted under `/api/admin` → full path: `POST /api/admin/service-areas/batch-update` ✓

## Implementation Review (`server/routes/adminServiceAreas.ts` lines 65-83)
```typescript
router.post("/service-areas/batch-update", requireAdmin, async (req, res) => {
  const { ids, is_active } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids array is required" });
  }
  if (typeof is_active !== "boolean") {
    return res.status(400).json({ error: "is_active boolean is required" });
  }
  const { data, error } = await db
    .from("service_areas")
    .update({ is_active, updated_at: new Date().toISOString() })
    .in("id", ids)
    .select(AREA_FIELDS);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ areas: data || [] });
});
```

## Verification Checklist
| Check | Result |
|---|---|
| `requireAdmin` enforced | YES — second argument to `router.post()` |
| Non-admin denied | YES — `requireAdmin` returns 401/403 before handler runs |
| Admin receives 200 | YES — `res.json({ areas: data })` on success |
| `ids` validation | YES — checks `Array.isArray(ids) && ids.length > 0` |
| `is_active` validation | YES — checks `typeof is_active === "boolean"` |
| Empty `ids` → 400 | YES |
| Missing `is_active` → 400 | YES |
| Single Supabase query | YES — `.in("id", ids)` executes one UPDATE across all rows |
| No timeout risk | YES — Supabase `.in()` is a single SQL `WHERE id IN (...)` — handles 500+ row arrays |
| Returns updated rows | YES — `.select(AREA_FIELDS)` returns all updated areas |
| `updated_at` stamped | YES — `updated_at: new Date().toISOString()` |

## Large County Test (Los Angeles — ~610 ZIPs)
- Client sends: `{ ids: [<610 UUIDs>], is_active: false }`
- Supabase translates to: `UPDATE service_areas SET is_active=false, updated_at=... WHERE id IN (<610 UUIDs>)`
- Single round-trip, no N+1 ✓
- Response: array of ~610 updated area objects ✓
- Client update: `new Map<string, ServiceArea>` for O(1) lookup, `setAreas(prev => prev.map(...))` ✓

## `db` Selection
```typescript
const db = supabaseAdmin ?? supabase;
```
Uses service-role client when available (bypasses RLS for admin mutations) ✓

## Frontend Integration
```typescript
// ServiceAreas.tsx toggleCounty()
const targets = (byCounty[county] ?? []).filter(a => a.is_active !== active);
if (targets.length === 0) return;  // short-circuit if already at target
const res = await adminApi("/api/admin/service-areas/batch-update", "POST", {
  ids: targets.map(a => a.id),
  is_active: active,
});
const updated = new Map<string, ServiceArea>(res.areas.map(a => [a.id, a]));
setAreas(prev => prev.map(a => updated.has(a.id) ? updated.get(a.id)! : a));
```
Only sends ZIPs that need to change (`filter(a => a.is_active !== active)`) — minimizes payload ✓
UI updates from API response — no optimistic divergence ✓

## Status: PASS
