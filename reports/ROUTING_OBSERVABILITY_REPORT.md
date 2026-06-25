# Routing Observability Report
**Date:** 2026-06-02

---

## Route Generation Checkpoints

Added to `server/routes/adminRoutes.ts` in `POST /api/admin/routes/day/generate`:

| Checkpoint | When |
|-----------|------|
| `route.day.generate.start` | Handler entry — includes date, max_stops_per_tech |
| `route.blackout.checked` | After blackout query — includes `blocked: true/false` |
| `route.technicians.filtered` | After availability filtering — includes total, available, excluded counts |
| `route.capacity.applied` | Per-technician capacity resolved (inside tech loop) |
| `route.created` | Each route successfully created — includes routeId, stopCount, confidence |
| `route.generate.failed` | Exception in day generate — includes error message |

## Structured Log Events

| Event | Level | Context |
|-------|-------|---------|
| `route.day_generate.started` | info | requestId, date |
| `route.day_generate.blackout_blocked` | warn | requestId, date, reason |
| `route.day_generate.technicians_filtered` | info | requestId, date, available, excluded |
| `route.day_generate.created` | info | requestId, date, routeCount, unassigned, durationMs |
| `route.day_generate.failed` | error | requestId, date, error |
| `route.generate.failed` | error | single-tech generate failure |

## Duration Tracking

`const genStart = Date.now()` is set at handler entry. `durationMs = Date.now() - genStart` is included in the completion log. This lets you track how long day planning takes as technician and appointment counts grow.

---

## Workforce Validation Checkpoints

Already implemented in prior sprint:

| Checkpoint | When |
|-----------|------|
| `route.publish.validation.start` | Before workforce validation |
| `route.publish.blocked` | Validation returned critical blockers |
| `route.publish.success` | (defined, not yet wired to single-route publish) |

---

## Feature Flag Gates in Routing

| Flag | Effect |
|------|--------|
| `ENABLE_WORKFORCE_VALIDATION` | Gates the workforce validation check before publish |
| `ENABLE_ROUTE_PUBLISH_GATE` | Gates the publish blocking behavior |

Both flags are checked before `validateDayPlanForWorkforce()` is called. If either is false, validation is skipped and publish proceeds without checks.

---

## What Is NOT Logged

- Customer PII (names, addresses, phone numbers)
- Property coordinates beyond presence/absence
- Raw Stripe objects
- Employee personal details beyond IDs and counts
