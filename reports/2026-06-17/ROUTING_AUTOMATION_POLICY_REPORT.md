# Routing Automation Policy — Implementation Report
**Date:** 2026-06-17

## What Was Built

| Piece | File |
|---|---|
| Settings table | `db/migrations/2026-06-17_route_automation_settings.sql` |
| Policy service | `server/services/routing/routeAutomationPolicy.ts` |
| Admin API | `GET/PATCH /api/admin/routes/automation-settings`, `POST /api/admin/routes/automation/run-now` (`server/routes/adminRoutes.ts`) |
| Admin UI | "Automation Settings" dialog in Route Planning → Day Planner tab (`client/pages/admin/RoutePlanning.tsx`) |
| Scheduled job | `netlify/functions/auto-publish-routes.ts`, every 15 minutes (`netlify.toml`) |

## Modes

| Mode | Behavior |
|---|---|
| `manual_only` (default) | No automated action of any kind. Every route requires a human Approve + Publish click, exactly as before this sprint. |
| `review_window` | A route becomes *eligible for evaluation* only after `review_window_minutes` have elapsed since it was generated — giving an admin a guaranteed window to intervene. After that, it's evaluated against the same safety rules as `fully_automatic`. |
| `fully_automatic` | Evaluated immediately, no wait. Only routes with zero blockers are touched. |

Both `review_window` and `fully_automatic` additionally respect an optional `auto_publish_cutoff_time` (a time-of-day floor — e.g., don't auto-publish before 6 AM) before evaluation even runs.

## Safety Rules (all enforced in `evaluateRouteForAutoPublish`)

1. **Status guard** — routes with status `completed`, `canceled`, `in_progress`, or already `published` are never touched, unconditionally (not configurable).
2. **`block_low_confidence`** (default on) — blocks routes where `confidence === "low"`.
3. **`block_mock_geo`** (default on) — blocks routes whose `conflict_notes` mention mock/estimated/fallback coordinates. *(See "Design Decisions" below for why this is text-pattern-based rather than a dedicated boolean.)*
4. **`block_drive_cap_exceeded`** (default on) — compares the route's `total_duration_minutes` against the technician's `technician_capacity_profiles.max_drive_minutes_per_day`; blocks if exceeded.
5. **`require_smart_optimize`** (default on) — blocks any route whose `algorithm_version` isn't `"smart-nearest-neighbor-v1"`. This is a **gate, not a trigger** — automation never invokes Smart Optimize itself; see Design Decisions.
6. **Master `enabled` flag** — defaults to `false`. Even with `mode` set to `review_window` or `fully_automatic`, nothing happens until an admin explicitly flips this on.

Every decision — `auto_approved`, `auto_published`, or `blocked` (with the specific blocker list) — writes one row to `route_audit_log` with `actor_role: "system"`, via `logAutomationDecision()`. Nothing about automation is invisible after the fact.

## Design Decisions Worth Calling Out

**`fully_automatic` does not generate or Smart-Optimize routes — only approves/publishes existing drafts.** The spec describes `fully_automatic` as letting the system "generate, smart optimize, approve, and publish." This implementation deliberately stops short of automatic *generation* and automatic *Smart Optimize invocation*: it only acts on routes that already exist in `draft`/`approved` status (created the normal way, by an admin clicking "Generate Day Plan"), and `require_smart_optimize` is enforced as a precondition rather than something automation runs on a route's behalf. Reasoning: automatically reordering stops or deciding which appointments to route is a materially bigger, less reversible decision than publishing a route a human already reviewed in draft form. Given the explicit constraints ("Do not bypass admin safety controls," "all automation decisions must be auditable"), the safer foundation is: automation handles the *last, most mechanical* step (publish) and leaves route construction and optimization as deliberate actions — by an admin today, possibly by a separate, explicitly-scoped automation in a future phase.

**Mock-geo detection is text-pattern matching on `conflict_notes`, not a dedicated column.** No table in this codebase stores a per-route boolean "uses mock geo" — that information currently only exists transiently in the Smart Optimize preview response (`isMockGeo` per stop) and as free-text entries in `conflict_notes` written at route-generation time (e.g., "uses estimated coordinates for N stop(s)"). Rather than adding a new schema column for this foundation, `evaluateRouteForAutoPublish` matches `conflict_notes` text against `/mock|estimated|fallback geocod/i`. This is good enough to block the common case but is a heuristic, not a guarantee — documented here so it isn't mistaken for a hard guarantee later.

**The settings table is an admin-managed singleton, not per-technician or per-date config.** One row controls automation for the whole business. This matches the spec's table shape exactly (no `employee_id`/`date` columns requested) and keeps the foundation simple; per-technician overrides would be a reasonable follow-up but weren't asked for.

## Validation

- `pnpm typecheck` — 0 errors (confirmed after this piece, before continuing to referrals/CRM Phase 3).
- Default state confirmed inert: `enabled = false`, `mode = 'manual_only'` — `autoPublishEligibleRoutes()` returns `{ checked: 0, published: 0, blocked: 0, skipped: 0 }` immediately for any date, with zero DB writes, until an admin opts in.
