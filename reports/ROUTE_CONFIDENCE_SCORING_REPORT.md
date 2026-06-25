# Route Confidence Scoring Report
**Date:** 2026-06-01

---

## Overview

Route confidence indicates how reliable the generated route order and ETAs are. It is calculated at generation time and stored in `routes.confidence`.

## Scoring Function

```typescript
function calculateConfidence(
  totalStops: number,
  mockCount: number,
  conflictNotes: string[]
): "high" | "medium" | "low" {
  if (mockCount === 0 && conflictNotes.length === 0) return "high";
  if (mockCount <= 2 && conflictNotes.length <= 1) return "medium";
  return "low";
}
```

| Confidence | Condition |
|------------|-----------|
| **High** | All stops have real property coordinates; no conflicts |
| **Medium** | 1-2 stops use mock/estimated coordinates; ≤ 1 conflict note |
| **Low** | 3+ stops use mock coordinates; or capacity exceeded; or multiple conflicts |

## Storage

- `routes.confidence` — `text CHECK (confidence IN ('high','medium','low'))`
- `routes.conflict_notes` — `text[]` — human-readable warning strings per problematic stop

Both columns were added in `db/migrations/2026-05-31_extend_routes.sql`.

## Admin Display

### Day Planner UI (route cards)
Each technician card shows:
- **High**: Green `High confidence` badge
- **Medium**: Amber `Medium confidence` badge  
- **Low**: Red `Low confidence` badge
- Amber warning box showing count of coordinate warnings (e.g., "2 coordinate warnings")

### Single-Tech Route Detail
The route detail card should show `confidence` badge next to the route status. This is returned in the API response. The current RoutePlanning.tsx single-tech view does not yet display the confidence badge — it's in the API but not the UI. The Day Planner tab does display it.

## Interpretation

| Badge | Operational Meaning |
|-------|-------------------|
| High | Route order is geographically sound; ETAs are reasonable |
| Medium | Route order is mostly good; 1-2 stops may be slightly out of order |
| Low | Route order may be unreliable; ETAs are rough estimates; admin should review manually |

## What Does NOT Affect Confidence (Yet)

- Appointment time windows (not yet compared to ETAs)
- Technician travel start location (always starts from first appointment)
- Customer availability windows
- Business hours / blackout dates

These can be added to the confidence algorithm in a future sprint without changing the storage or display.
