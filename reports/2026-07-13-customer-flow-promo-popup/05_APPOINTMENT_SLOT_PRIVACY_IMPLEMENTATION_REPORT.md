# Report 05 — Appointment Slot Privacy Implementation

**Sprint:** Customer-Facing Flow Cleanup + Promo Popup System  
**Phase:** 5  
**Date:** 2026-07-13  
**Status:** COMPLETE

---

## Objective

Remove all capacity/count exposure from the customer-facing appointment scheduling flow and hide
unavailable windows entirely, as audited in Report 04.

---

## Changes Made

### `server/routes/availability.ts`

- Removed `capacity`, `booked`, `remaining` from the `WindowAvailability` interface.
- Response map changed: now returns `{ id, label, start, end, available: remaining > 0 }` only.
- Internal `remaining` variable preserved for the `available` boolean calculation — capacity
  enforcement logic is fully intact, just not exposed to callers.

**Before:**
```ts
interface WindowAvailability {
  id: string; label: string; start: string; end: string;
  capacity: number; booked: number; remaining: number; available: boolean;
}
// response included: capacity, booked, remaining
```

**After:**
```ts
interface WindowAvailability {
  id: string; label: string; start: string; end: string; available: boolean;
}
// response: capacity/booked/remaining stripped; available computed server-side
```

### `client/components/schedule/ScheduleFlow.tsx`

- `WindowAvailability` client interface: removed `capacity`, `booked`, `remaining` fields.
- `windowsForDate` memo: changed `.filter(w => !w.available ? disabled-display : show)` to
  `.filter(w => w.available)` — unavailable windows no longer rendered at all.
- Slot button label: changed `"${win.remaining} spot${win.remaining !== 1 ? 's' : ''} left"` →
  `"Available"`.
- Removed `disabled={!win.available}` and greyed-out CSS classes from slot button.
- Saved-progress restore block: removed the now-deleted `capacity: 0, booked: 0, remaining: 0`
  fields from the `setSelectedWindow(...)` call (TypeScript error fix).

### `client/pages/dashboard/Appointments.tsx`

- `WindowOption` interface: removed `remaining` field.
- `windowsForDate`: changed to `.filter((w: WindowOption) => w.available)`.
- Slot display text: changed `${win.remaining} spot... left` → `"Available"`.
- Removed `disabled={!win.available}` and unavailable-slot CSS.

---

## Privacy Posture After Change

| Field | Before | After |
|-------|--------|-------|
| `capacity` | Exposed in API response | Not returned |
| `booked` | Exposed in API response | Not returned |
| `remaining` | Exposed in API response | Not returned |
| `available` | Returned as boolean | Returned as boolean (unchanged) |
| Unavailable windows | Shown greyed/disabled | Hidden entirely |
| Slot count text | "X spots left" | "Available" |

Capacity enforcement is unchanged — the server still rejects bookings when
`remaining <= 0`; only the count is no longer disclosed to unauthenticated callers.

---

## Verification

- `pnpm typecheck` — 0 errors
- `pnpm test` — 223/223 passing
- `pnpm build` — clean
- Manual review: no remaining uses of `remaining`, `capacity`, or `booked` in customer-facing
  slot rendering paths.
