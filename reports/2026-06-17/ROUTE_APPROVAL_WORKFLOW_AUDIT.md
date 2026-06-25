# Route Approval Workflow Audit
**Date:** 2026-06-16
**Scope:** Full audit of the route lifecycle (draft → approved → assigned → published → in_progress → completed → canceled), the admin review surface, and the safeguards around publishing.

---

## Files Audited

| File | Purpose |
|------|---------|
| `client/pages/admin/RoutePlanning.tsx` | Admin UI — Day Planner + Single Technician tabs |
| `server/routes/adminRoutes.ts` | Route CRUD, lifecycle transitions, day-plan generation |
| `db/migrations/2026-05-31_extend_routes.sql` | `routes` / `route_stops` / `route_audit_log` schema |
| `server/lib/workforceValidation.ts` | Pre-publish workforce validation |

---

## Lifecycle States

`draft → approved → assigned → published → in_progress → completed → canceled`

| Transition | Endpoint | Who triggers it |
|---|---|---|
| (none) → draft | `POST /routes/generate` (single-tech) or `POST /routes/day/generate` (day planner) | Admin click |
| draft → approved | `POST /routes/:routeId/approve` or `POST /routes/day/approve` | Admin click |
| approved → assigned | `POST /routes/:routeId/assign` | Admin click (rarely used — most flows go straight to publish) |
| draft/approved → published | `POST /routes/:routeId/publish` or `POST /routes/day/publish` | Admin click |
| published → in_progress | Set by employee app when first stop is started | Employee action |
| in_progress → completed | `POST /routes/:routeId/complete` | Admin or auto on last stop |
| any (pre-publish) → canceled/discarded | `POST /routes/:routeId/discard` or `POST /routes/day/rebuild` | Admin click |

---

## Answers to Audit Questions

### Can routes be generated automatically?
Yes — but only by explicit admin click, never on a schedule or webhook. `POST /routes/day/generate` runs the ZIP-grouping + nearest-neighbor day planner; `POST /routes/generate` runs the single-technician generator. Both require `requireAdmin`-equivalent auth (`getAdminUserId`) and create routes in `draft` status only — nothing is auto-published.

### Can admins review before publish?
Yes. Every route sits in `draft` (or `approved`) before publish, visible in both the Day Planner card grid and the Single Technician detail panel, showing stop count, distance, confidence badge, and conflict-note warnings.

### Can admins reorder stops manually?
Yes, two ways:
1. **Smart Optimize** (`POST /routes/optimize-preview` → review → `POST /routes/:routeId/reorder-stops`) — preview-first, requires a second explicit "Apply" click.
2. **Manual drag/patch** via `POST /routes/:routeId/reorder` (sequence-only) and `PATCH /routes/stops/:stopId` (per-stop edits) — both write to `route_audit_log`.

### Can admins Smart Optimize before approving?
Yes. The Smart Optimize button is enabled for `draft`-status routes in both tabs, before the Approve step. The preview never touches the database until "Apply New Order" is clicked.

### Can approved routes still be edited?
Partially. `PATCH /routes/stops/:stopId` and `POST /routes/:routeId/reorder` have no status guard, so notes/sequence can still be changed after approval. `POST /routes/:routeId/rebuild` is explicitly blocked for `published`/`in_progress` routes but allowed for `approved` (clears stops, requires regenerating). This is intentional flexibility — approval is a checkpoint, not a freeze.

### When are employees notified?
Only at publish. `notifyAdmin()` fires an internal admin-facing alert (not the employee) on publish; the employee-facing route appears via `GET /employee/routes/today`, which only returns routes with `status = "published"` or later. There is no push/SMS notification to the employee — they see the new route the next time they open the app. (SMS notifications are explicitly out of scope per this sprint's constraints.)

### Is there any path that publishes without admin approval?
**Before this sprint:** Yes — `POST /routes/:routeId/publish` had no status guard at all. It would transition *any* route (including a freshly generated `draft` that had never been reviewed) straight to `published` with no warning check, no confirmation, and no audit detail beyond `route_published`. The bulk `POST /routes/day/publish` already had a `validateDayPlanForWorkforce()` blocker check, but it's gated behind `flags.workforceValidation()` and `flags.routePublishGate()` — if either flag is off, the same no-guard behavior applies.

**After this sprint (see ROUTE_REVIEW_SAFEGUARDS_REPORT.md):** the per-route endpoint now rejects already-published/completed/canceled routes, and blocks publish (returning warnings) when the route has low confidence or unresolved conflict notes, unless `force: true` is explicitly passed. The UI now requires an explicit confirmation step before either path is called.

### What safeguards were missing?
1. No status check on `POST /routes/:routeId/publish` — could publish a route in any state.
2. No warning surfaced before single-route publish (confidence/conflict_notes were displayed on the card but not gated at the action).
3. No confirmation modal anywhere in the UI before publish — clicking "Publish" or "Publish All" fired the request immediately.
4. Day-level workforce validation blockers existed but were swallowed into a generic `err.message` toast on the client — the actual blocker list was never shown to the admin.
5. Audit log entries for `route_published` carried minimal metadata (`bulk`, `date` only) — no record of confidence, conflict-note count, or whether the publish was forced.

These four gaps are addressed in Phase 2 (see `ROUTE_REVIEW_SAFEGUARDS_REPORT.md`).
