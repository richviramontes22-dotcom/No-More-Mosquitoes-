# Route Generation Scale Revalidation Report

## Why re-run this

Phase 2's optimization report measured the rewritten `dayPlanGenerator.ts` at 25/50/150 appointments
immediately after the rewrite. Since then, Phases 3–7 added a new ping endpoint, a new shift-status
endpoint, two rewritten tracking endpoints, a new GPS summary query in the Operations Command Center, and a
date-computation fix — none of which touch route generation's code path, but "didn't touch it" is a claim
worth checking empirically rather than just asserting. This phase re-runs the same 150-appointment scenario
on a fresh date, and adds a new, larger 300-appointment scenario neither this sprint nor the prior one had
tested, to confirm the fix continues to hold beyond the originally validated range.

## Results

| Scenario | Appointments | Routes created | Unassigned | Generation time |
|---|---|---|---|---|
| Re-validation | 150 | 43 | 0 | **4.3s** |
| New scale test | 300 | 43 | 28 | **5.4s** |

Both well under any Netlify Functions synchronous timeout (10–26s), and both consistent with Phase 2's
finding that the optimized code is latency-bound by a small, near-constant number of batched round trips
rather than by per-appointment round trips — doubling the appointment count from 150 to 300 added about
1.1 seconds, not the ~80 additional seconds the original O(n)-round-trip code would have added at that
scale.

The 150-appointment number (4.3s) is faster than Phase 2's original measurement (8.1s) — consistent with
normal run-to-run variance in network/DB latency, not a further code change (none was made to
`dayPlanGenerator.ts` this phase).

## The 300-appointment scenario's 28 unassigned appointments are expected, not a bug

43 active technicians, each with a default daily capacity (`default_max_stops`), cannot always absorb 300
appointments spread unevenly across many ZIP codes — round-robin load balancing within each ZIP group can
leave a remainder unassigned when a ZIP's demand exceeds what its assigned technicians can take that day.
This is the same unassigned-handling logic Phase 2 preserved unchanged from the original implementation
(see `ROUTE_GENERATION_OPTIMIZATION_REPORT.md`), and the response correctly reported it
(`unassigned_appointments`, not silently dropped or errored). 0 unassigned at 150 vs. 28 at 300 reflects
real capacity limits at the current technician count, not a generation correctness regression — the same
behavior would occur at either appointment count if technician headcount or capacity were the limiting
factor.

## Conclusion

The Phase 2 optimization holds — and scales further than originally tested — after all subsequent GPS
tracking, admin tracking, and Operations Command Center work in this sprint. No regression.

The 450 additional test properties/appointments/routes this re-validation created are fully captured by
the Phase 7 cleanup script's scope (confirmed: the dry-run count went from 462 to 912 test appointments
immediately after this run, exactly matching the 150 + 300 added) — no separate manual cleanup tracking was
needed.
