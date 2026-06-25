# Routing API Cost Note
**Date:** 2026-06-16

## Current cost: $0

Route optimization (`server/lib/routeOptimization.ts` and `server/services/routing/smartRoutingOptimizer.ts`) is built entirely on:
- **Haversine distance** — a closed-form great-circle distance formula computed in plain JavaScript, no network call, no API key.
- **A fixed/tiered speed model** — flat 25 mph (original optimizer) or a 3-tier 20/35/50 mph model based on segment length (Smart Optimizer) — also pure math, no external dependency.

Neither approach calls Google, Mapbox, HERE, or any other paid routing/distance service. Generating, optimizing, and re-optimizing routes costs nothing beyond normal server compute, no matter how many times it's run per day.

## What a paid API would add

**Google Routes API / Distance Matrix API** would replace the straight-line + speed-model estimate with real road-network driving distance and time, including current traffic. This is the natural next upgrade once routing accuracy becomes a bigger lever than it is today.

### How it's billed

Google bills Distance Matrix / Routes API by **elements**, where:

```
elements = origins × destinations
```

For route optimization, the common pattern is requesting a full distance matrix among all of a technician's stops for the day (so the optimizer can compare every pair), which means **elements grow quadratically with stop count**:

| Stops per route | Matrix elements (stops × stops) |
|---|---|
| 5 | 25 |
| 8 (current default max) | 64 |
| 12 | 144 |
| 20 | 400 |

Multiply by the number of technicians and routes generated per day (including re-generations and Smart Optimize re-runs, which would each cost another matrix call) to get daily element volume. Pricing is per-1,000-elements and tiered by monthly volume — see Google's current Routes API pricing page for exact rates, since these change over time and this note intentionally avoids quoting a number that could go stale.

### Why we're not implementing it now

1. **No paid routing API is currently configured** in this project's environment variables — adding one means new billing setup, a new API key, and a new cost-monitoring surface, none of which exists today.
2. **Route volume is still small.** At current technician/stop counts, the Haversine + speed-model approach produces ETAs that are directionally correct and good enough for day-to-day planning; the dollar cost of being more precise doesn't yet outweigh the dollar cost of paying per-element for traffic-aware routing.
3. **The instructions for this sprint are explicit:** do not implement Google Routes API or any paid routing API yet.

## Recommendation

Delay the paid API until route volume justifies it — a reasonable trigger would be when:
- Daily technician count or average stops-per-route grows enough that mountain/desert-terrain ETA error (already documented in the prior sprint's `ROUTING_ENGINE_AUDIT_REPORT.md`) starts causing real schedule conflicts, or
- An admin specifically asks for traffic-aware ETAs because the estimate-vs-actual gap is causing customer complaints.

When that trigger arrives, the recommended integration point is narrow: call the Distance Matrix/Routes API only for the *already-grouped* stops within one technician's day (not a global matrix across all technicians/days), and cache results for the lifetime of that route's draft status to avoid re-billing on every Smart Optimize preview click.
