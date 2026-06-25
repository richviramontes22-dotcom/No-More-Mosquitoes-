# Routing Quality Test Report
**Date:** 2026-06-01

---

## Build / Typecheck

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS — zero errors |
| `npm run build:server` | PASS — 417 kB bundle |
| `npm run build:client` | PASS |

---

## Test Checklist

### Real Coordinate Routing

| Test | Expected | Status |
|------|----------|--------|
| Property with lat/lng generates route | Stops use `coordinate_source: "property_coordinates"` | Code verified |
| Property without lat/lng generates route | Stops use `coordinate_source: "mock_fallback"`; conflict note added | Code verified |
| Route with all real coords | `confidence: "high"` | Code verified |
| Route with 1-2 mock coords | `confidence: "medium"` | Code verified |
| Route with 3+ mock coords | `confidence: "low"` | Code verified |
| Conflict notes stored on route | `routes.conflict_notes` populated | Code verified |

### Multi-Technician Day Planner

| Test | Expected | Status |
|------|----------|--------|
| Generate day plan with 2 active techs | 2 draft routes created | Code verified |
| Generate day plan with 0 active techs | `{ routes: [], message: "No active technicians found" }` | Code verified |
| Generate day plan when all appts already routed | `{ routes: [], message: "All appointments are already on approved routes" }` | Code verified |
| Generate day plan twice | Second call skips techs with existing draft routes | Code verified (maybeSingle check) |
| Appointments exceed capacity | Overflow in `unassigned_appointments` | Code verified |
| Approve all | All drafts advance to `approved` | Code verified |
| Publish all | All approved routes advance to `published` | Code verified |
| Rebuild day | All drafts deleted; `route_discarded` audit logged | Code verified |

### Route Stop Status Sync

| Test | Expected | Status |
|------|----------|--------|
| Employee marks assignment `en_route` | route_stop → `en_route` | Code verified (requires migration applied) |
| Employee marks assignment `in_progress` | route_stop → `arrived` | Code verified |
| Employee marks assignment `completed` | route_stop → `completed` | Code verified |
| Employee marks assignment `skipped` | route_stop → `skipped` | Code verified |
| Employee marks assignment `no_show` | route_stop → `skipped` | Code verified |
| First assignment starts | route → `in_progress` (if was published/assigned) | Code verified |
| All stops terminal | route → `completed` + `route_completed` audit logged | Code verified |
| Assignment not on any route | Sync silently skips | Code verified |
| DB error in sync | Logged; employee status update unaffected | Code verified |

### Admin Day Planner UI

| Test | Expected | Status |
|------|----------|--------|
| Day Planner tab is default | Loads on page open | Code verified |
| Route cards appear per technician | Grid of cards with name, stops, confidence | Code verified |
| High confidence badge (green) | Shows when all coords real | Code verified |
| Medium/Low confidence badge (amber/red) | Shows when mock coords used | Code verified |
| Coordinate warning box on card | Shows "N coordinate warnings" in amber | Code verified |
| Approve All button disabled when no drafts | `disabled` prop checks `dayRoutes.filter(r => r.status === "draft").length === 0` | Code verified |
| Unassigned appointments section | Shows when `dayUnassigned.length > 0` | Code verified |
| Individual Approve/Publish per card | Calls route-specific endpoint + refreshes | Code verified |

### Route Audit Log Completion

| Event | Fires | Status |
|-------|-------|--------|
| `route_generated` | POST /routes/generate and /routes/day/generate | Code verified |
| `route_assigned` | POST /routes/:id/assign | Code verified |
| `route_approved` | POST /routes/:id/approve and /routes/day/approve | Code verified |
| `route_published` | POST /routes/:id/publish and /routes/day/publish | Code verified |
| `route_rebuilt` | POST /routes/:id/rebuild | Code verified |
| `route_discarded` | POST /routes/:id/discard and /routes/day/rebuild | Code verified |
| `route_completed` | POST /routes/:id/complete AND employee auto-complete | Code verified |
| `stop_updated` | PATCH /routes/stops/:id | Code verified |
| `stop_reordered` | POST /routes/:id/reorder | Code verified |

### Employee Route View

| Test | Expected | Status |
|------|----------|--------|
| Stop status colors: en_route → blue | `STOP_STATUS_COLORS["en_route"]` = blue | Code verified |
| Stop status colors: arrived → purple | `STOP_STATUS_COLORS["arrived"]` = purple | Code verified |
| Next stop includes en_route stops | `["pending", "scheduled", "en_route", "arrived"].includes(s.status)` | Code verified |
| All-done banner: skipped stops count | Banner triggers when `completed + skipped === total` | Code verified |
| All-done banner message: includes skip count | "6 done, 1 skipped" | Code verified |
| Removed unused imports | `AlertTriangle`, `useEmployee`, `useToast` removed | Code verified |

### Regression Tests

| Test | Expected | Status |
|------|----------|--------|
| Single-tech generate route | Still works unchanged | Code verified |
| Employee assignment status update | Still works + GPS sync | Code verified |
| Employee route view loads | `/api/employee/routes/today` unchanged | Code verified |
| Admin employee management | Unchanged | N/A |
| Onboarding forms | Unchanged | N/A |
| Customer notifications on completion | Unchanged | N/A |
