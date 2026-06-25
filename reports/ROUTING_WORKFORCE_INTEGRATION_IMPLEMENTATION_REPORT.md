# Routing Workforce Integration Implementation Report
**Date:** 2026-06-01

---

## Changes to `server/routes/adminRoutes.ts`

### `POST /api/admin/routes/day/generate` — Day Planner

**Step 0 (NEW): Company blackout check**
Before any technician or appointment lookups:
```typescript
const { data: companyBlackout } = await db.from("blackout_dates")
  .select("id, reason").eq("date", date).eq("scope", "all").maybeSingle();
if (companyBlackout) return res.status(400).json({ error: "Company blackout..." });
```
Returns HTTP 400 if any company-wide blackout exists for the date. Admin must remove the blackout first.

**Step 1–2 (CHANGED): Availability filter with per-tech capacity**
```typescript
// Check every active technician in parallel
await Promise.all(allTechnicians.map(async (tech) => {
  const avail = await isTechnicianAvailable(tech.id, date);
  if (!avail.available) {
    unavailableTechIds.add(tech.id);
    dayConflictNotes.push(`Technician ${tech.id.slice(0, 8)}: excluded (${avail.reason})`);
  } else {
    const cap = await getEffectiveDailyCapacity(tech.id, date);
    techCapacities[tech.id] = cap.max_stops;
  }
}));
const technicians = allTechnicians.filter(t => !unavailableTechIds.has(t.id));
```

**Step 2 (CHANGED): Zero-available-techs handling**
When all technicians are excluded, fires `workforce.no_technicians_available` admin alert and returns a clear error response.

**Step 6 (CHANGED): Per-technician capacity enforcement**
```typescript
const techMaxStops = techCapacities[tech.id] ?? max_stops_per_tech;
const withinCap = techAppts.slice(0, techMaxStops);
const overflow = techAppts.slice(techMaxStops);
```
Each tech gets their own capacity limit from the workforce system instead of the global default.

**Response (CHANGED): Added workforce context**
```json
{
  "workforce_notes": ["Tech abc12345: excluded (not_scheduled)", ...],
  "excluded_technicians": 1,
  "message": "Created 2 draft route(s). 0 unassigned. 1 technician(s) excluded due to availability."
}
```

---

### `POST /api/admin/routes/generate` — Single-Tech

**Availability check (NEW):**
```typescript
const avail = await isTechnicianAvailable(employee_id, date);
if (!avail.available && !force) {
  return res.status(400).json({ error: "Technician not available", reason: avail.reason, hint: "Pass force:true to override" });
}
if (!avail.available && force) {
  logRouteAudit("forced-generate", adminId, "admin", "route_forced_override", {...});
}
```

**Force override:** Admin can pass `{ force: true }` in the request body to bypass availability for emergency use. Logged to `route_audit_log` with action `route_forced_override`.

**Capacity enforcement (NEW):**
```typescript
const cap = await getEffectiveDailyCapacity(employee_id, date);
const optimizedStops = optimizeRoute(assignments.slice(0, cap.max_stops));
```

---

### `POST /api/admin/routes/day/publish` — Day Publish Validation Gate

**Workforce validation (NEW, pre-publish):**
```typescript
if (!force) {
  const validation = await validateDayPlanForWorkforce(date);
  if (!validation.overall_valid) {
    return res.status(400).json({ error: "Workforce validation failed", validation, hint: "Pass force:true to override" });
  }
  // Warnings: logged to route_audit_log, don't block
}
```

Critical blockers prevent publish. Warnings allow publish but are audit-logged. Force override bypasses all checks and is always audit-logged.

---

## What Was NOT Changed

- `POST /api/admin/routes/:id/approve` — no validation (draft → approved is low-risk)
- `POST /api/admin/routes/:id/publish` — single-route publish has no validation gate (only day bulk publish does)
- Employee route view — unchanged
- Assignment status sync — unchanged
