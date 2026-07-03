# 07 — Employee / Technician App Audit Report

**Date:** 2026-07-03

---

## Auth

| Flow | Status | Notes |
|---|---|---|
| `/employee/login` | ✅ Separate employee login form | |
| Logout | ✅ Available in EmployeeLayout header | |
| Role redirect | ✅ RequireEmployee blocks customer/admin | |
| Customer blocked from /employee/* | ✅ Redirected to /employee/login | |
| Admin accessing /employee/* | ✅ Admin can access employee routes (intentional — admin can oversee) |

---

## Core Technician Workflow

| Step | Route / Endpoint | Status | Notes |
|---|---|---|---|
| Dashboard | `/employee` | ✅ | Role-aware: tech vs customer_service panel |
| Clock in | shift start endpoint | ✅ | POST /api/employee/shifts/start |
| Clock out | shift end endpoint | ✅ | POST /api/employee/shifts/end |
| GPS consent grant | `/employee/profile` | ✅ **Fixed** (prior sprint) | Now server-audited |
| GPS consent withdrawal | `/employee/profile` | ✅ | Server-audited |
| GPS periodic ping | shift + location-ping endpoint | ✅ | Requires shift active + consent |
| Route page | `/employee/route` | ✅ | Google Maps integration, GPS overlay |
| Assignment list | `/employee/assignments` | ✅ | Today's assignments with status |
| Assignment detail | `/employee/assignments/:id` | ✅ | Full workflow hub |
| En route | status → en_route | ✅ | Sets en_route_at |
| **Arrive** | status → in_progress | ✅ **Fixed** (prior sprint) | Sets arrived_at AND started_at |
| Complete | status → completed | ✅ | Sets completed_at |
| Blocked/skipped/no-show | status transitions | ✅ | Additional statuses supported |
| Notes | assignment notes field | ✅ | Free-text notes on assignment |
| Checklist | job_checklists | ✅ | Per-item checkbox in AssignmentDetail |
| Media upload | job_media → storage | ✅ **Fixed** (prior sprint) | Now stores path not public URL |
| Clock out | shift end | ✅ | GPS stops after shift end |

---

## Arrived_at Fix (Verified)

The "Arrive" button calls `POST /api/employee/assignments/:id/status` with `{ status: "in_progress" }`.

Prior behavior: only set `started_at`. `arrived_at` remained null.

Post-fix behavior (verified in code):
```typescript
// employeeAssignments.ts:230-231
if (status === "in_progress" && !current.arrived_at)   update.arrived_at   = now;
if (status === "in_progress" && !current.started_at)   update.started_at   = now;
```

Both set on first `in_progress` transition. Admin timeline at `/admin/visits` now shows "Arrived" timestamp for all new jobs.

---

## PWA / Offline

| Feature | Status | Notes |
|---|---|---|
| Service worker | ✅ Implemented | `/employee-sw.js` scoped to `/employee` |
| PWA manifest | ✅ Dynamic | `/employee-manifest.webmanifest` |
| Installability | ✅ Supported | iOS meta tags + manifest for PWA install |
| Offline route cache | ✅ localStorage 24h TTL | Caches: role, employee record, route, assignments, assignment detail |
| OfflineIndicator banner | ✅ Shown when offline or syncing | Sticky top banner |
| Offline action queue | ✅ useActionQueue hook | Pending actions sync on reconnect |
| Reconnect sync | ✅ Implemented | Auto-sync when network restored |
| User-scoped cache | ✅ ownerId namespace | Prevents cross-employee data bleed on shared devices |
| Logout cache clear | ✅ clearEmployeeCache() on unmount | |
| Same-device second technician risk | ✅ Mitigated | Cache is userId-scoped; login clears previous user's cache |

---

## Mobile Layout

| Check | Status | Notes |
|---|---|---|
| iOS safe-area bottom bar | ✅ | env(safe-area-inset-bottom) in EmployeeLayout |
| Android viewport | ✅ | Standard meta viewport tag |
| Sticky action bar | ✅ | AssignmentDetail has sticky bottom CTA |
| Tap targets | ✅ | Buttons are minimum 44px tall |
| Photo upload UX | ✅ | File input + camera capture on mobile |

---

## Security: Employee Data Isolation

| Check | Status |
|---|---|
| Employee sees only own assignments | ✅ RLS: employee → user_id scope |
| Employee sees only own shifts | ✅ RLS: employee-scoped |
| Employee sees only own location pings | ✅ RLS: employee-scoped |
| Employee cannot access /admin/* | ✅ RequireAdmin redirects |
| Employee cannot access /dashboard/* | ✅ RequireCustomer redirects |
| GPS timestamps server-controlled | ✅ DB DEFAULT now() — verified prior sprint |

---

## Issues Found

### Issue 1: GPS legal disclosure note (OPEN — attorney action required)
**Finding:** Profile.tsx contains inline note "review required by attorney before production use" on the GPS consent toggle disclosure text.
**Status:** Not a code bug. Attorney review is a compliance action item. Do NOT remove this note until attorney review is complete.

### Issue 2: Media upload: old entries (pre-bucket-private sprint) still use public URLs
**Finding:** Any `job_media.url` entries created before 2026-07-02 contain `https://` public CDN URLs (pre-private bucket). The Visits.tsx signed URL generation handles this gracefully (falls back to direct URL for http-prefixed entries).
**Status:** Handled. Old entries still work; new entries use private storage path + signed URL.

### Issue 3: No assigned employee filter on route (MINOR)
**Finding:** `/employee/route` shows all assignments for the day across the team if employee is an admin. For normal technician accounts this is fine.
**Status:** Low risk. Normal technician accounts only see own assignments via RLS.

---

## Summary

**All core technician workflows implemented and verified.** The two critical fixes from prior sprint (arrived_at, GPS consent audit) are confirmed working. PWA offline capability is well-implemented with user-scoped cache. One pending attorney action (GPS disclosure text) and one data migration consideration (old job_media URLs).
