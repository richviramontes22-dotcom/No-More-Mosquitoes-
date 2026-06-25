# Service Area CRM Integration Report
Generated: 2026-06-16

## CRM Phase 2 Touchpoints Verified

### 1. In-Area Quote — lead NOT marked out_of_area
Path: `/api/parcel` → `parcelQuote.ts` → `leadService.upsertLeadFromQuote()`

The `upsertLeadFromQuote()` path checks `is_active` on the service_areas row. If covered:
- Status set to `"new"` or previous non-out_of_area status
- `service_area_status = "covered"`
- `out_of_area_reason = null`
- No `service_area_demand_event` inserted

Batch update changes only `is_active` and `updated_at` — all other fields preserved ✓
The `GET /api/service-areas/check` public endpoint filters by `is_active = true`, so a
ZIP toggled off will correctly report `covered: false` on the next quote attempt ✓

### 2. Out-of-Area Quote — lead marked out_of_area + demand event created
```typescript
// leadService.ts lines 639-708
const updates = {
  out_of_area_reason: params.outOfAreaReason,
  service_zip: params.zip,
  service_area_status: "not_covered",
};
// ...
await db.from("service_area_demand_events").insert({
  zip: params.zip,
  event_type: "out_of_area_quote",
  ...
});
```
- Lead status → `"out_of_area"` ✓
- `service_area_demand_events` row inserted with `event_type: "out_of_area_quote"` ✓
- Dedup: existing lead updated, new lead inserted on first visit ✓

### 3. Waitlist Signup — demand event created
```typescript
// leadService.ts line 766
status: "out_of_area",
// + recordServiceAreaDemandEvent({ eventType: "waitlist_signup" })
```
- Lead status → `"out_of_area"` ✓
- `service_area_demand_events` row inserted with `event_type: "waitlist_signup"` ✓

### 4. Expansion Demand Section
```typescript
// ServiceAreas.tsx
const fetchDemand = async () => {
  const res = await adminApi("/api/admin/service-area-demand");
  setDemand(res.demand ?? []);
};
```
```typescript
// adminServiceAreaDemand.ts
router.get("/service-area-demand", requireAdmin, async (req, res) => {
  const { data } = await db.from("service_area_demand_events")
    .select("zip, event_type, email, name, lead_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limitVal);
  // aggregates by ZIP
  res.json({ demand, events: data });
});
```
- Route mounted at `app.use("/api/admin", adminServiceAreaDemandRouter)` ✓
- Aggregates by ZIP, sorts by total demand descending ✓
- Non-critical failure mode: `catch { /* non-critical */ }` in fetchDemand ✓

### 5. Service Area Check Public Endpoint
```typescript
// adminServiceAreas.ts line 127
router.get("/service-areas/check", async (req, res) => {
  // no requireAdmin — public ✓
  .eq("is_active", true)  // only active ZIPs count as covered ✓
});
```
Double-mounted:
- `app.use("/api/admin", adminServiceAreasRouter)` → admin full CRUD
- `app.use("/api", adminServiceAreasRouter)` → public `/api/service-areas/check` ✓

Batch updates to `is_active` are immediately reflected in this endpoint — no caching layer ✓

## CRM Phase 2 Features Unchanged
| Feature | Status |
|---|---|
| Lead notes (`POST /api/admin/leads/:id/notes`) | Not touched ✓ |
| Lead status mutation (`PATCH /api/admin/leads/:id/status`) | Not touched ✓ |
| Lead detail view (`/admin/leads/:id`) | Not touched ✓ |
| Lead inbox (`/admin/leads`) | Not touched ✓ |
| `lead_activities` logging | Not touched ✓ |

## Status: PASS
