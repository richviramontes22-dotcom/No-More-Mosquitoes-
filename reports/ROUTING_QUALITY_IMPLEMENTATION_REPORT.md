# Routing Quality Implementation Report
**Date:** 2026-06-01
**Sprint:** Routing Quality + Multi-Technician Dispatch

---

## Implemented Items

### Phase 1 — Real Coordinate Routing
| Item | Status |
|------|--------|
| `resolveCoordinates()` helper: property.lat/lng first, mock fallback second | DONE |
| `coordinate_source` tracked per stop | DONE |
| Properties query updated to include `lat, lng` in generate endpoints | DONE |
| Conflict notes generated for mock-fallback stops | DONE |
| API returns `coordinate_warnings` per route | DONE |

### Phase 2 — Route Confidence Scoring
| Item | Status |
|------|--------|
| `calculateConfidence(totalStops, mockCount, conflictNotes)` | DONE |
| Confidence stored in `routes.confidence` | DONE |
| Conflict notes stored in `routes.conflict_notes` | DONE |
| High / Medium / Low badges in Day Planner UI | DONE |
| Amber warning box showing coordinate warning count | DONE |

### Phase 3 + 4 — Multi-Technician Day Planner API
| Item | Status |
|------|--------|
| `POST /api/admin/routes/day/generate` | DONE |
| `GET /api/admin/routes/day?date=` | DONE |
| `POST /api/admin/routes/day/approve` | DONE |
| `POST /api/admin/routes/day/publish` | DONE |
| `POST /api/admin/routes/day/rebuild` | DONE |
| `GET /api/admin/routes/day/unassigned?date=` | DONE |
| ZIP-cluster based assignment distribution | DONE |
| Capacity enforcement (`max_stops_per_tech`, default 8) | DONE |
| Duplicate route prevention per technician/date | DONE |
| Auto-create assignments when needed | DONE |

### Phase 5 — Admin Day Planner UI
| Item | Status |
|------|--------|
| Day Planner tab (default) | DONE |
| Single Technician tab (preserved) | DONE |
| Shared date picker | DONE |
| Generate Day Plan button | DONE |
| Approve All button | DONE |
| Publish All button | DONE |
| Discard Drafts button with confirm | DONE |
| Route card grid per technician | DONE |
| Confidence badges per card | DONE |
| Individual Approve/Publish per card | DONE |
| Unassigned appointments section | DONE |
| Auto-reload on date change | DONE |

### Phase 6 — Route Stop Status Sync
| Item | Status |
|------|--------|
| `en_route` status added to `route_stops` CHECK constraint | DONE (migration) |
| Sync block in `employeeAssignments.ts` (fire-and-forget) | DONE |
| assignment en_route → route_stop en_route | DONE |
| assignment in_progress → route_stop arrived | DONE |
| assignment completed → route_stop completed | DONE |
| assignment skipped/no_show → route_stop skipped | DONE |
| Route → in_progress when first stop starts | DONE |
| Route → completed when all stops terminal (auto) | DONE |
| `route_completed` audit log from employee trigger | DONE |

### Phase 7 — Route Audit Log Completion
| Event | Status |
|-------|--------|
| `route_generated` | DONE (was missing) |
| `route_assigned` | DONE (was missing) |
| `route_discarded` | DONE (was missing) |
| `stop_reordered` | DONE (was missing) |
| All existing events verified | DONE |

### Phase 8 — Employee Route View Polish
| Item | Status |
|------|--------|
| `en_route` stop color (blue) | DONE |
| `arrived` stop color changed to purple | DONE |
| Next stop logic includes `en_route` and `scheduled` | DONE |
| All-done banner: counts skipped + completed | DONE |
| All-done message includes skip count | DONE |
| Removed unused `AlertTriangle`, `useEmployee`, `useToast` | DONE |

---

## Migrations Created

| File | Apply Order | Purpose |
|------|-------------|---------|
| `db/migrations/2026-05-31_route_stops_en_route.sql` | After `2026-05-31_extend_routes.sql` | Add `en_route` to route_stops status CHECK |

---

## APIs Created

| API | Purpose |
|-----|---------|
| `POST /api/admin/routes/day/generate` | Multi-tech day plan generation |
| `GET /api/admin/routes/day` | All routes for a date with enriched employee info |
| `POST /api/admin/routes/day/approve` | Bulk approve all drafts |
| `POST /api/admin/routes/day/publish` | Bulk publish all approvable routes |
| `POST /api/admin/routes/day/rebuild` | Discard all drafts for a date |
| `GET /api/admin/routes/day/unassigned` | Appointments not yet on any route |

---

## Build / Typecheck

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS — zero errors |
| `npm run build:server` | PASS — 418 kB ✓ 1.18s |
| `npm run build:client` | PASS |

---

## Algorithm Changes

**Single-tech generate:** Now uses real `properties.lat/lng` before falling back to mock. Calculates and stores confidence + conflict_notes. Writes `route_generated` audit log.

**Day planner generate:** Same coordinate resolution. Groups appointments by ZIP, assigns to technicians by load balance, respects capacity limit, prevents duplicate routes per technician/date. Returns unassigned appointments when capacity exceeded.

---

## Coordinate Source Strategy

Priority order (current):
1. `properties.lat` / `properties.lng` → `"property_coordinates"` (high quality)
2. ZIP hash mock → `"mock_fallback"` (low quality)

Future additions (not yet wired):
- `parcel_lookup_cache` coordinates from Regrid
- Google Geocoding API via `GOOGLE_MAPS_API_KEY`
- Address-level geocoding with caching

---

## Remaining Gaps

| Gap | Priority | Notes |
|-----|----------|-------|
| Property coordinates backfill | HIGH | Query shows what % have real coords; admin should run geocoding for blank ones |
| Technician availability / blocked dates | MEDIUM | Algorithm assumes all active techs are available every day |
| Customer time-window enforcement | MEDIUM | ETA not compared to customer's preferred window |
| Admin drag-to-reassign stops | MEDIUM | API exists (reorder), UI not built |
| Map view of route proposals | MEDIUM | Mapbox sprint |
| Technician SMS notification on publish | MEDIUM | Admin alert fires; employee SMS not wired |
| Real-time stop status in employee view | LOW | 2-minute poll is acceptable for beta |
| `parcel_lookup_cache` in coordinate resolution | MEDIUM | Tables exist; not yet in resolveCoordinates() |

---

## Routing Readiness Score

| Domain | Before Sprint | After Sprint |
|--------|---------------|--------------|
| Coordinate quality | 1/10 (all mock) | 7/10 (real first, mock fallback) |
| Route confidence scoring | 0/10 | 8/10 |
| Multi-technician dispatch | 0/10 | 8/10 |
| Route stop lifecycle sync | 0/10 | 9/10 |
| Route auto-completion | 0/10 | 9/10 |
| Route audit log | 4/10 (missing 4 events) | 10/10 |
| Employee route view | 6/10 | 8/10 |
| Admin day planner UI | 0/10 | 8/10 |

**Overall routing readiness: 1.4/10 → 8.4/10**

---

## Next Recommended Sprint

**Sprint 6 — Map Integration + Property Coordinate Backfill**

1. Replace `MiniMap.tsx` placeholder with Mapbox GL JS
2. Property pins on assignment detail map
3. All stops as numbered pins on employee route map
4. Admin route planner map view (day plan map with stops per tech)
5. Wire `parcel_lookup_cache` into `resolveCoordinates()` as second priority
6. Bulk geocode properties missing coordinates via Regrid or Google

**Why this sprint:** Routing is now operationally useful with real coordinate priority and multi-tech dispatch. The remaining major UX gap is visual — admins and employees can't see a map of the route. The data is already there (lat/lng on properties, route_stops with ETAs). Mapbox is a pure client-side addition.

---

## GO / CONDITIONAL GO / NO-GO

### Multi-Technician Route Management: **CONDITIONAL GO**

**Conditions:**
1. Run `db/migrations/2026-05-31_route_stops_en_route.sql` in Supabase
2. Populate `properties.lat/lng` for at least the most common service addresses — check with:
   ```sql
   SELECT COUNT(*) total, COUNT(lat) with_coords FROM properties;
   ```
3. Verify day planner with test data before using in production
4. Admin must review all generated routes before publishing — do not enable auto-publish

**The routing system is now production-capable for a small multi-technician operation with manual admin approval. Routes will be geographically reasonable for properties with real coordinates and clearly flagged when using estimated coordinates.**
