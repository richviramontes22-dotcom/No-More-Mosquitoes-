# Workforce Safety Validation Report
**Date:** 2026-06-01
**File:** `server/lib/workforceValidation.ts`

---

## Functions

### `validateRouteForWorkforce(routeId)`

Checks a single route against workforce constraints.

**Checks performed:**
| Check | Severity | Code |
|-------|----------|------|
| Technician unavailable on route date | CRITICAL | `technician_unavailable` |
| No schedule template configured | WARNING | `missing_schedule_template` |
| No capacity profile configured | WARNING | `missing_capacity_profile` |
| Stop count exceeds technician capacity | CRITICAL | `capacity_exceeded` |
| Route confidence = "low" | WARNING | `low_confidence` |
| Route has coordinate warnings | INFO | `coordinate_warnings` |

Returns: `{ valid, severity, warnings[], blockers[] }`

### `validateDayPlanForWorkforce(date)`

Runs `validateRouteForWorkforce()` on every draft/approved route for the date. Also counts unassigned appointments.

Returns:
```typescript
{
  date: string,
  overall_valid: boolean,
  overall_severity: "ok" | "warning" | "critical",
  routes: Array<{ route_id, employee_id, result: ValidationResult }>,
  unassigned_count: number,
}
```

---

## Severity Definitions

| Severity | Behavior |
|----------|----------|
| **CRITICAL** (blocker) | Prevents day publish unless `force: true` in request body |
| **WARNING** | Allows publish but logs to `route_audit_log` |
| **INFO** | Informational; no publish impact |

---

## Publish Gate Integration

`POST /api/admin/routes/day/publish` calls `validateDayPlanForWorkforce()` before proceeding:

```
Validation → critical blocker?
  YES + force=false → return 400 with validation result
  YES + force=true  → proceed + log route_audit_log: day_published_force_override
  NO + warnings → proceed + log route_audit_log: day_published_with_warnings
  NO → proceed normally
```

---

## What Validation Does NOT Check

- Individual stop addresses (geocoding quality is checked by confidence scoring, not validation)
- Customer availability or time windows
- Traffic or weather conditions
- Historical technician performance
- Appointment priority levels

These are future sprint additions.

---

## Admin Visibility

`GET /api/admin/workforce/validation?date=YYYY-MM-DD` exposes the full validation result to the admin. The Day Planner UI will display this before the publish button is clicked (route planner warning UI — Phase 10 of the sprint).
