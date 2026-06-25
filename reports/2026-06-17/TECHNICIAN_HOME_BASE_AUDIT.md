# Technician Home Base Data Audit
**Date:** 2026-06-16
**Scope:** Confirm whether depot-aware Smart Optimize routing has the home-base data it needs, end to end — schema, API, and admin UI.

---

## Answers

### Do `home_base_lat`/`home_base_lng` fields exist?
Yes, in `technician_capacity_profiles` (added in a prior sprint alongside `home_base_address`, `vehicle_type`, `equipment_notes`). Confirmed present in:
- `server/lib/technicianCapacity.ts` — `getEffectiveDailyCapacity()` selects and returns both fields.
- `server/routes/adminWorkforce.ts` — both the `POST` (upsert) and `PATCH` capacity endpoints accept and persist them.
- `server/routes/adminRoutes.ts` — both `optimize-preview` and `reorder-stops` read `home_base_lat`/`home_base_lng` from `technician_capacity_profiles` to build `depotGeo` for the Smart Optimizer.

### Are they populated?
Unknown without querying production data directly — that's outside this audit's reach. The structural finding is **the UI never offered a way to populate them**, so unless a migration backfilled them or someone wrote directly to the table, they are most likely `null` for every technician today. This is the actual gap, addressed below.

### Can admins edit them?
**Before this sprint: No.** `client/pages/admin/WorkforceCapacity.tsx` had a `home_base_address` text field only, with a note reading "Used as route starting point (future sprint)" — confirming the team always intended to wire this up, but the lat/lng inputs were never added. The address field alone is not enough; nothing in the codebase geocodes `home_base_address` into coordinates (no Google geocoding call is wired into the capacity-save path), so filling in the address field had zero effect on routing.

**After this sprint: Yes.** Added two number inputs ("Home base latitude" / "Home base longitude") to the existing "Vehicle & Home Base" card in `WorkforceCapacity.tsx`, alongside the address field. A short note tells the admin to look up coordinates via Google Maps (right-click → copy coordinates) rather than relying on automatic geocoding, since no paid geocoding API is wired into this save path and we were instructed not to add one. The address field's helper text was updated to clarify it's reference-only — the coordinates are what Smart Optimize actually uses.

### Does Smart Optimize use them when present?
Yes, already — this was built and validated in the prior sprint:
- `smartOptimizeRoute()` (`server/services/routing/smartRoutingOptimizer.ts`) accepts an optional `depotGeo` and uses it as the virtual starting point for the nearest-neighbor ordering.
- `POST /routes/optimize-preview` and `POST /routes/:routeId/reorder-stops` both resolve `depotGeo` from `technician_capacity_profiles.home_base_lat/lng` before calling the optimizer.
- When `home_base_lat`/`home_base_lng` are `null` (the default, pre-this-sprint state for every technician), `depotGeo` is `undefined` and the optimizer falls back to its prior behavior — starting from the first stop in the list. No crash, no error, just a silent fallback to the old behavior. This means **Smart Optimize has been running in degraded mode for every technician until home base coordinates are entered.**

---

## What Was Added

`client/pages/admin/WorkforceCapacity.tsx`:
- `CapacityProfile` interface: added `home_base_lat: number | null`, `home_base_lng: number | null`.
- Default profile and load-from-API mapping updated to include both fields.
- Two new number inputs in the "Vehicle & Home Base" card, with `step="0.000001"` for reasonable coordinate precision and range validation (`-90..90` / `-180..180`).
- No backend changes needed — `adminWorkforce.ts`'s upsert endpoint already accepted these fields; the gap was purely the missing UI inputs.

---

## Recommendation (not implemented — flagged for follow-up)

To make this fully self-serve without manual Google Maps lookups, a future sprint could add a "Geocode address" button next to the home-base address field that calls the existing `/api/parcel` Google geocoding fallback path (already configured, already paid-for-and-in-use elsewhere in the app) to auto-fill lat/lng from the typed address. This was not built now because it would mean wiring a new server endpoint, and the instruction set for this sprint was UI-only ("add minimal admin input fields... lat/lng only if address geocoding is not available"). Manual entry satisfies the requirement without new server surface area or new paid-API calls.
