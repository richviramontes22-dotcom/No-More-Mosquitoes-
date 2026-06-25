# Route Generation Optimization Report

## Result: 150 appointments, ~82s → ~8.1s. Target (under 10s) met.

## Files changed

`server/services/routing/dayPlanGenerator.ts` — rewrote the per-technician route-creation loop (section 7)
to batch every database operation that was previously issued once per appointment or once per technician.
No other file changed; the function's public signature, return shape, and the rest of the pipeline (blackout
check, technician availability/capacity, appointment discovery, ZIP grouping/round-robin) are untouched.

## What was batched

| Operation | Before | After |
|---|---|---|
| Existing-assignment lookup | One query per appointment | One `WHERE appointment_id IN (...)` query for all candidate appointments |
| Assignment insert | One insert per new appointment | One multi-row insert for every new assignment across every technician |
| Existing draft/approved route lookup | One query per technician | One `WHERE employee_id IN (...)` query for all technicians with load |
| Route insert | One insert per technician | One multi-row insert for every technician that ends up with at least one assignment |
| Route stops insert | Already one bulk insert per technician | Merged into one bulk insert across *all* technicians' stops |
| Route audit log | One insert per technician (fire-and-forget) | One bulk insert across all routes (still fire-and-forget) |

The technician availability/capacity check (already `Promise.all`-parallel, not sequential) was left
unchanged — it wasn't the bottleneck (see `ROUTE_GENERATION_PERFORMANCE_AUDIT.md`).

## Before / after timing, measured live

| Scenario | Before (this sprint's earlier measurement) | After |
|---|---|---|
| 25 appointments | ~11.5s | **~7.1s** |
| 50 appointments | ~20.6s | **~5.7s** |
| 150 appointments | ~82s (worst case) / ~60s (best prior case) | **~8.1s** |

All three now finish well inside Netlify's synchronous function timeout window (10-26s depending on plan),
removing the production timeout risk identified in Phase 1.

## Behavior preserved

Verified live, not just by code review — re-ran all three scales against real data (real technicians, real
properties, real active service-area ZIPs):

- **Unassigned appointment reasons**: capacity-overflow notes (`"N appointment(s) over capacity"`) are
  still generated from the same in-memory slice logic, computed *before* any batched query runs, exactly
  matching the original per-technician order of operations.
- **Capacity handling**: `techMaxStops` slicing (`withinCap`/`overflow`) is byte-for-byte the same
  computation, just hoisted out of the per-technician await loop into an up-front in-memory pass.
- **Technician availability**: completely untouched — same `isTechnicianAvailable` /
  `getEffectiveDailyCapacity` calls, same parallel structure.
- **Service-area grouping**: the ZIP-grouping and round-robin load-balancing logic (`byZip`, `zipGroups`,
  `techLoads`) is untouched — batching only changed what happens *after* the per-technician assignment list
  is already decided.
- **Route metrics**: `optimizeRoute`, `calculateConfidence`, distance/duration totals — identical function
  calls, identical inputs, just computed for every technician in a single in-memory pass before the (now
  single) route insert, instead of recomputed-then-immediately-inserted one technician at a time.
- **Audit logging**: every route still gets exactly one `route_audit_log` row with the same `action`,
  `metadata` shape — just written via one bulk insert instead of N individual fire-and-forget inserts.
- **Live results matched exactly**: 0 unassigned appointments across all three re-tested scales (the
  appointments used were all valid, in-capacity, in-area test data, so 0 unassigned is the *correct*
  expected outcome — not evidence by itself, but consistent with nothing having silently broken).

## One documented, intentional behavior difference (rare-path only)

The original code handled an assignment-insert or route-insert failure *per row* — if one specific
appointment's insert failed, only that appointment was marked unassigned; others in the same loop continued
normally. A single multi-row `INSERT` is atomic: if any row in the batch would violate a constraint, the
*entire* batch fails together. To preserve a safe fallback without reintroducing per-row round trips, a
failed batch now marks every appointment in that batch as unassigned, rather than isolating just the one bad
row. This only matters if a batch ever contains a row that would fail to insert — in practice this should be
rare to nonexistent now, since the up-front existing-assignment/existing-route lookups already exclude the
known case that used to cause this (duplicate-pair conflicts) before any insert is attempted.

## Remaining limits

- The technician availability/capacity check block is parallel but each individual technician's chain
  (`isTechnicianAvailable` → `getEffectiveDailyCapacity`) still makes up to ~6 sequential internal queries.
  This block's wall-clock time is bounded by the *slowest single technician's* chain, not multiplied by
  technician count — not a bottleneck today, but worth knowing if a future technician's availability
  resolution path grows deeper.
- This is still synchronous, in-request work. A true "thousands of appointments" scenario (well beyond
  anything tested or realistic for this business today) would eventually need a background-job architecture
  rather than further query batching — not needed at any scale tested in this sprint.
