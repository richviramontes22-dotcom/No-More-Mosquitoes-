# Routing Optimizer Decision Report
**Date:** 2026-06-16  
**Decision Options:** A (sufficient — no change), B (partial — targeted improvements), C (missing — full build)

---

## Decision: B — Partial Optimizer, Targeted Improvements Required

The current optimizer (`optimizeRoute` in `server/lib/routeOptimization.ts`) exists, is correct, and is in production use. It is not absent (not C) and it is not sufficient for the expanded SB County service area (not A). Several structural gaps produce meaningfully wrong ETAs and suboptimal orderings for SoCal's varied terrain.

---

## Evidence for Decision B

### What makes it "not C" (not missing)
- Real nearest-neighbor algorithm is implemented and running
- Haversine distance is a valid proxy for flat urban terrain
- Workforce availability and capacity constraints are wired at the scheduling layer
- Route audit log, confidence tagging, and conflict notes provide production visibility
- The day planner correctly groups by ZIP before optimizing

### What makes it "not A" (not sufficient)

**Gap G2 — Haversine vs. road distance (High severity)**  
SB County mountains and desert make straight-line distances misleading. Big Bear Lake (92315) to San Bernardino City (92401): ~25 miles as-the-crow-flies but 40–45 miles by road (Box Canyon Road / SR-18 descent). Yucca Valley (92284) to Needles (92363): ~90 miles Haversine but 120+ miles by road. Every affected route will show ETAs 20–40 minutes short on mountain/desert legs.

**Gap G3 — Flat 25 mph speed (High severity)**  
SoCal is bimodal: freeways (I-15, I-10, SR-91, SR-60) average 45–65 mph on clear days; surface streets in Fontana/Rialto/Ontario average 20–25 mph; mountain roads (SR-18, SR-138) average 30–35 mph. A flat 25 mph overestimates freeway legs by ~2× and underestimates surface-street legs.

**Gap G1 — No home-base starting point (Medium severity)**  
`technician_capacity_profiles.home_base_lat/lng` is stored and accessible but never passed to `optimizeRoute`. The optimizer always starts with the first pending assignment from the DB query. A tech based in Ontario (91761) assigned to a Hesperia route (92344) will drive 60+ miles north before beginning their first stop — then drive 60 miles back at the end of the day — adding 120 phantom miles not reflected in the route.

**Gap G4 — Hardcoded 30-min service time (Medium severity)**  
A 0.25-acre townhome takes ~20 minutes; a 2.5-acre estate takes 50–60 minutes. The current model gives every stop 30 minutes, compressing large-property schedules and padding small ones. The `properties` table and acreage data from the parcel system are available — service time can be estimated.

**Gap G5 — max_drive_minutes not enforced (Medium severity)**  
The capacity profile stores a daily drive-time ceiling that is never validated. A High Desert route (Victorville → Barstow → Needles) could exceed 6 hours of drive time on a single day — breaking the tech's day — and the system would approve and publish it without warning.

---

## Improvement Scope (Phase 5 Implementation)

The improvements target the **optimizer layer** without touching the day-planner scheduling logic (which remains correct). The changes are:

1. **Home-base-aware start**: Accept optional `depotGeo` in the optimizer. When provided (from `home_base_lat/lng`), use it as the virtual first point — nearest-neighbor picks the stop closest to the depot as stop #1.

2. **Acreage-based service time**: Replace the hardcoded 30-minute service constant with a lookup from the stop's `estimated_duration_minutes` (already stored in `route_stops`, defaulted to 45 in schema). The planner stores acreage-derived estimates; the optimizer should use them.

3. **Drive time cap enforcement**: Add an optional `maxDriveMinutes` parameter. When cumulative estimated drive time reaches the cap, remaining stops are flagged as `exceeds_drive_cap: true` in the response — not silently included.

4. **Speed zone awareness**: Without a paid routing API, use a simple three-tier speed model based on segment distance as a proxy for road type:
   - < 5 miles: 20 mph (surface street / neighborhood)
   - 5–20 miles: 35 mph (arterial / highway)
   - > 20 miles: 50 mph (freeway dominant)  
   This is not perfect but is 2–3× more accurate than flat 25 mph for SoCal routing.

5. **New endpoint**: `POST /api/admin/routes/optimize-preview` — accepts a route ID, re-runs the enhanced optimizer, returns a proposed new stop order with ETAs and a delta showing improvement vs. current order. Does not mutate the database unless admin confirms.

6. **UI**: "Smart Optimize" button on each route card in RoutePlanning.tsx — calls the preview endpoint, shows a before/after comparison, and lets admin apply the reordering.

---

## What is NOT in scope

- Google Maps Distance Matrix API (paid, not configured)
- Real-time traffic
- Multi-depot vehicle routing (VRP) — full 2-opt/3-opt optimization
- Customer-facing route tracking
- SMS notifications
- Phase 3 CRM

---

## Implementation Risk

**Low.** The new `smartRoutingOptimizer.ts` is an additive service — it does not replace `optimizeRoute`, does not touch existing routes in the DB, and is only invoked via the new preview endpoint + UI button. Existing day planner behavior is unchanged until an admin clicks "Apply."
