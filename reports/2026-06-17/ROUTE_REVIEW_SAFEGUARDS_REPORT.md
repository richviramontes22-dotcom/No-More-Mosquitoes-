# Route Review Safeguards Report
**Date:** 2026-06-16
**Scope:** Harden the publish path identified in `ROUTE_APPROVAL_WORKFLOW_AUDIT.md` so that publishing always requires an explicit, informed admin decision.

---

## Required Workflow (confirmed in place after this sprint)

```
Generate Route → Smart Optimize Preview → Admin Review → Optional Manual Edits → Admin Approve → Publish/Send to Employee
```

| Step | Status |
|---|---|
| Smart Optimize remains preview-first | ✅ Already true — `optimize-preview` never mutates the DB; `reorder-stops` requires a separate "Apply" click. No change needed. |
| Apply optimization requires explicit admin click | ✅ Already true — "Apply New Order" button is distinct from the preview action. No change needed. |
| Publish requires approved-or-draft status | ✅ **Fixed this sprint** — previously any status could be republished. |
| Warning shown if route has warnings | ✅ **Fixed this sprint** — confirmation modal added. |
| Warning shown if route exceeds drive cap | ⚠️ Partial — see Limitations below. |
| Warning shown if route uses mock geo | ✅ Covered via existing `conflict_notes` (mock-coordinate fallbacks are already pushed into `conflict_notes` at generation time). |
| Edits/reorders write audit log | ✅ Already true (`stop_reordered`, `stop_updated`) — metadata unchanged, no regression. |

---

## Changes Made

### 1. Server — `POST /api/admin/routes/:routeId/publish` (`server/routes/adminRoutes.ts`)

**Before:** unconditionally set `status = "published"` regardless of current status or route quality.

**After:**
- Rejects publish with `400` if the route is already `published`, `completed`, or `canceled`.
- Computes `hasWarnings = confidence === "low" || conflict_notes.length > 0`.
- If `hasWarnings` and the request did not pass `{ force: true }`, returns `400` with:
  ```json
  {
    "error": "This route has unresolved warnings — review before publishing.",
    "warnings": { "confidence": "low", "conflict_notes": ["..."] },
    "hint": "Pass { force: true } to publish anyway (will be logged)."
  }
  ```
- On success (clean or forced), `route_published` audit log entries now include `confidence`, `conflict_notes_count`, `published_with_warnings`, and `forced` — previously only `stop_count` and `employee_id`.

This mirrors the existing `force`-override pattern already used elsewhere in the file (e.g., `generate-day-plan`'s availability override), so it's consistent with established conventions rather than a new pattern.

### 2. Server — `POST /api/admin/routes/day/publish` (bulk)

No behavioral change to the existing `validateDayPlanForWorkforce()` gate (still flag-gated by `workforceValidation()` + `routePublishGate()` — left untouched since toggling feature flags is a deployment/business decision, not a code-safety one). **Audit metadata improved**: per-route `route_published` log entries in the bulk path now also carry `confidence`, `conflict_notes_count`, and `forced`, matching the single-route path.

### 3. Client — `client/lib/adminApi.ts`

Added an optional `details` field to `AdminApiError`, carrying the full parsed error JSON body (not just `.message`). This is additive and backward-compatible — every existing caller that only reads `.message` is unaffected — and it's what lets the new confirmation modal show the actual blocker/warning list instead of a generic error string.

### 4. Client — `client/pages/admin/RoutePlanning.tsx`

- Added a **Publish Confirmation Modal** (new `Dialog`), triggered by all three existing publish entry points:
  - Day Planner per-route card "Publish" button
  - Single Technician tab "Publish & Notify Employee" button
  - "Publish All" button
- The modal shows, before any network call:
  - Confidence badge (single-route)
  - Full list of conflict notes (single-route)
  - Aggregate count of routes pending publish + a flag if any have low confidence or conflict notes (bulk)
- On confirm, calls the publish endpoint without `force`. If the server responds with warnings/blockers, the modal re-renders showing the specific messages and swaps the button label to **"Force Publish Anyway"** — a second explicit click is required to override.
- Removed the now-redundant `handlePublishRoute` / `handlePublishAll` direct-call functions in favor of one `doPublish(force)` used by all three triggers, and removed the unused `publishingAll` state (replaced by a single `publishing` flag scoped to the modal).

---

## Limitations (documented, not silently glossed over)

**Drive-cap warning at publish time is partial.** The `workforceValidation.ts` blocker/warning set checks technician availability, schedule template, capacity profile, stop count vs. `max_stops_per_day`, route confidence, and conflict notes — but it does **not** check cumulative drive minutes against `max_drive_minutes_per_day` (this gap was already flagged in the prior sprint's `ROUTING_ENGINE_AUDIT_REPORT.md`, G5). The Smart Optimize preview *does* compute `exceedsDriveCap` and surfaces it in its own modal — so a route that was Smart-Optimized will carry that information forward into the optimizer's preview UI — but a route published without ever running Smart Optimize has no drive-cap signal available at publish time. Closing this fully would require adding a drive-minutes check to `validateRouteForWorkforce()`, which is a `workforceValidation.ts` change beyond this sprint's allowed-fixes list (UI text, confirmation modals, audit metadata) and is recommended as a follow-up, not implemented here.

---

## What Was Deliberately Not Changed

- `flags.workforceValidation()` / `flags.routePublishGate()` defaults — flipping these is a rollout decision, not a code defect.
- The `assign` and `complete` transitions — out of scope, no warning signals apply there.
- Smart Optimize internals (`smartRoutingOptimizer.ts`) — already preview-first and correct; this sprint only added consumption of its existing `exceedsDriveCap`/`isMockGeo` signals into the surrounding workflow where they were already being computed, not new computation.
