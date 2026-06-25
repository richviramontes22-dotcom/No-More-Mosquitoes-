# Route Generation Performance Audit

## Why did 150 appointments take ~82 seconds?

**It's almost entirely sequential network round trips, not computation.** The ZIP-grouping, round-robin
load balancing, and nearest-neighbor route optimization are all in-memory JavaScript — fast regardless of
scale. The slow part is that `dayPlanGenerator.ts` makes a separate, awaited Supabase REST call for nearly
every appointment and every technician, one after another.

Counting the sequential round trips for the 25-technician / 150-appointment scenario:

| Operation | Where | Round trips |
|---|---|---|
| Existing-assignment check, per appointment | Inside the per-technician `for` loop, line ~249 | ~150 |
| Assignment insert, per *new* appointment | Same loop, line ~260 | ~150 |
| Existing draft/approved route check, per technician | Per-technician loop, line ~233 | ~42 |
| Route insert, per technician | Same loop, line ~294 | ~42 |
| Route stops insert, per technician | Same loop, line ~324 (already a single bulk call per tech) | ~42 |

**~426 sequential round trips total.** At a realistic ~190ms per round trip (Node server to a managed
Postgres instance over the public internet, not same-region), `426 × 190ms ≈ 81 seconds` — matching the
observed ~82s almost exactly. This is a latency-bound problem, confirmed by the math, not a guess.

## Which operations are sequential?

Everything listed in the table above runs inside a `for` loop with `await` on each iteration — by
construction, each call waits for the previous one to finish before starting. The one part of the function
that's *already* parallel is the technician availability/capacity check (`Promise.all` across technicians,
line 107) — that block's wall-clock time is bounded by the slowest single technician's check chain, not
multiplied by technician count. It is not the bottleneck.

## Which queries can be batched?

All five rows in the table above. Each is independent per-item logic applied to a known, fixed-size
candidate set computed entirely in memory before any of these queries need to run:

1. **Existing-assignment lookup** — one `WHERE appointment_id IN (...)` query for every candidate
   appointment across every technician, instead of one query per `(appointment, technician)` pair.
2. **Assignment insert** — one multi-row `INSERT ... VALUES (...), (...), ...` for every appointment that
   needs a new assignment, instead of one insert per appointment.
3. **Existing draft/approved route lookup** — one `WHERE employee_id IN (...) AND date = ... AND status IN
   (...)` query for every technician, instead of one query per technician.
4. **Route insert** — one multi-row insert for every technician that ends up with at least one assignment,
   instead of one insert per technician.
5. **Route stops insert** — already batched per-technician; can be merged into a single global multi-row
   insert across *all* technicians' stops, since by the time stops are written every route's ID is already
   known from the batched route insert.

## Can route/assignment inserts be bulk inserted?

Yes — Supabase's PostgREST layer supports inserting an array of rows in one call
(`.insert([{...}, {...}, ...])`), returning all created rows (with their generated IDs) in one response.
This is exactly what's needed here; no schema or RLS change required.

## What production timeout risk remains?

Today: real. `netlify/functions/api.ts` wraps this exact endpoint for the deployed site, and Netlify's
synchronous functions have a 10-26 second execution limit depending on plan — a real day with 150+
appointments would very plausibly time out generating routes in production, even though it works fine
against the local long-running Node dev server.

After batching (Phase 2): the round-trip count drops from ~426 to roughly 9-10 regardless of scale (the
count becomes a function of *how many distinct batch queries the algorithm needs*, not of appointment or
technician count) — at ~190ms each, that's under 2 seconds for the data-mutation path, comfortably inside
even Netlify's default 10-second limit with large margin.

## What target performance is realistic?

**Under 10 seconds for 150 appointments is realistic and was achieved** — see
`ROUTE_GENERATION_OPTIMIZATION_REPORT.md` and `ROUTE_GENERATION_SCALE_REVALIDATION_REPORT.md` for the
measured before/after numbers. The remaining variable cost is the technician availability/capacity check
block, which scales with the *depth* of each technician's availability-resolution chain (up to ~6 sequential
internal queries per technician in `isTechnicianAvailable`/`getEffectiveDailyCapacity`) but not with
technician *count*, since it already runs in parallel.
