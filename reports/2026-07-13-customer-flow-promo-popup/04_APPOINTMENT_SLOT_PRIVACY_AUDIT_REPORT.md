# Phase 04 — Appointment Slot Privacy Audit

**Date:** 2026-07-13  
**Sprint:** Customer-Facing Flow Cleanup + Promo Popup System

---

## Findings

### Finding 1 — API exposes capacity internals publicly

**File:** `server/routes/availability.ts`  
**Endpoint:** `GET /api/availability` — unauthenticated, no auth middleware  
**Lines 40-49:** `WindowAvailability` interface includes `capacity`, `booked`, `remaining`  
**Lines 192-201:** All three fields are returned in the response to any caller, including unauthenticated public visitors

```ts
return {
  id, label, start, end,
  available: remaining > 0,
  capacity,         // ← active tech count × max_jobs_per_tech (reveals staffing)
  booked:    bookedCount,   // ← current booking volume
  remaining,        // ← exact spots left
};
```

**Risk:** Any visitor can query `/api/availability?date_from=YYYY-MM-DD&days=30` and determine:
- Exact number of active technicians (capacity / max_jobs_per_tech)
- Exact booking volume per day/window (competitive intelligence)
- Remaining capacity — the specific metric customers should not see

### Finding 2 — Customer UI shows spot count (Reschedule dialog)

**File:** `client/pages/dashboard/Appointments.tsx`  
**Line 229:**
```tsx
{win.available ? `${win.remaining} spot${win.remaining !== 1 ? "s" : ""} left` : "Fully booked"}
```
Customer sees e.g. "3 spots left" in the reschedule dialog.

**Additional:** `WindowOption` interface (lines 47-54) declares `remaining: number`.

### Finding 3 — Customer UI shows spot count (Scheduling/Onboarding flow)

**File:** `client/components/schedule/ScheduleFlow.tsx`  
**Line 1270:**
```tsx
{win.remaining} spot{win.remaining !== 1 ? "s" : ""} left
```
Customer sees e.g. "2 spots left" in the public booking flow (visible to unauthenticated visitors too).

**Additional:** `WindowAvailability` interface (lines 63-72) declares `capacity`, `booked`, `remaining`.

### Finding 4 — Unavailable windows displayed to customer

Both `Appointments.tsx` (line 221) and `ScheduleFlow.tsx` (line 1252) apply greyed-out / disabled styling to unavailable windows and show "Fully booked" text, but the windows remain **visible** in the UI. Per the sprint requirement, unavailable slots should be **hidden**.

`windowsForDate` in `ScheduleFlow.tsx` (line 373-376) returns ALL windows:
```ts
const windowsForDate = useMemo((): WindowAvailability[] => {
  if (!selectedDate) return [];
  return getDayAvailability(selectedDate)?.windows ?? [];
}, [selectedDate, availabilityMap]);
```

`windowsForDate` in `Appointments.tsx` (line 103-105) similarly returns all:
```ts
const windowsForDate = selectedDate
  ? (availabilityMap.get(...)?.windows ?? [])
  : [];
```

---

## Admin/Internal Capacity Visibility

- Admin appointment management in `server/routes/adminAppointments.ts` uses the service-role client and is protected by `requireAdmin` — no changes needed there.
- The availability endpoint is shared between customer-facing UI and any internal tooling that hits it. After the fix, admin panels that need `capacity`/`booked`/`remaining` would need either a separate admin endpoint or the admin client to apply its own logic directly.
- Currently no admin-facing UI reads `capacity`/`booked` from the public availability endpoint — the admin appointment dashboard reads appointment records directly. So removing these fields from the public endpoint has no admin impact.

---

## What Needs Changing

| Change | File | Effect |
|---|---|---|
| Remove `capacity`, `booked`, `remaining` from API response | `availability.ts` lines 192-201 | API only returns `available: boolean` per window |
| Remove `capacity`, `booked`, `remaining` from server `WindowAvailability` interface | `availability.ts` lines 40-49 | Type consistency |
| Remove `remaining` from client `WindowAvailability` interface | `ScheduleFlow.tsx` lines 63-72 | TS compile |
| Remove `remaining` from client `WindowOption` interface | `Appointments.tsx` lines 47-54 | TS compile |
| Replace count text with "Available" | `ScheduleFlow.tsx` line 1270 | No count shown |
| Replace count text with "Available" | `Appointments.tsx` line 229 | No count shown |
| Filter out unavailable windows (hide, not grey) | `ScheduleFlow.tsx` line 373-376 | Unavailable hidden |
| Filter out unavailable windows (hide, not grey) | `Appointments.tsx` line 103-105 | Unavailable hidden |

---

## Double-Booking Prevention Not Affected

Backend capacity enforcement (`capacity > booked` check) lives inside `availability.ts`'s own calculation logic and never reaches the client. Removing fields from the API response does not affect the server-side capacity gate. The `available: boolean` field correctly encodes the result of that check.

---

## Verdict

**High priority — multiple customer-facing surfaces expose internal capacity data.** Fix in Phase 5.
