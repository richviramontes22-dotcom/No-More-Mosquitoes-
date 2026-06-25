# Technician Capacity Report
**Sprint 1C — No More Mosquitoes**
**Date:** 2026-05-28

---

## Problem

Appointment slot availability was calculated using a hardcoded constant:

```typescript
const MVP_TECHNICIAN_COUNT = 1;
```

This constant appeared in both `server/routes/availability.ts` and `server/routes/schedule.ts`. As the team grows, available slots would not increase — customers would see falsely limited availability even with multiple active technicians.

---

## Solution

Replace the hardcoded constant with a live query of the `employees` table.

### Change in `server/routes/schedule.ts`

```typescript
// Before
const capacity = MVP_TECHNICIAN_COUNT * (windowDef.max_jobs_per_tech ?? 3);

// After
const { data: activeTechs } = await db
  .from("employees")
  .select("id")
  .eq("status", "active");
const activeTechCount = activeTechs && activeTechs.length > 0 ? activeTechs.length : 1;
const capacity = activeTechCount * (windowDef.max_jobs_per_tech ?? 3);
```

The fallback `|| 1` ensures availability never breaks if the employees table is empty.

### Change in `server/routes/availability.ts`

Same pattern — dynamic count replaces `MVP_TECHNICIAN_COUNT = 1`.

---

## Capacity Formula

```
slots_available = active_technician_count × max_jobs_per_tech_per_window
```

`max_jobs_per_tech` defaults to 3 if not set on the window definition. This can be tuned per time window in the `time_windows` table without code changes.

---

## Verification

- `pnpm typecheck` — no errors
- Fallback guards against zero-tech edge case
- No change to appointment slot data model or API contract
