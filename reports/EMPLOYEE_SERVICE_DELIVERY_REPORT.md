# Employee Service Delivery Report
**Sprint 2A + 2B + 2C — No More Mosquitoes**
**Date:** 2026-05-28

---

## Overview

Three gaps in the employee-facing service delivery workflow were closed:

1. **2A** — Employees had no way to upload job photos or videos
2. **2B** — Employees completing an assignment didn't cascade that status to the linked appointment
3. **2C** — Property coordinates (lat/lng) were hardcoded as `null` in the assignment detail view

---

## Sprint 2A — Job Media Upload

### Problem
The `AssignmentDetail` page had no media capture capability. Technicians couldn't document completed work.

### Solution

**Database migration: `db/migrations/2026-05-28_job_media_storage.sql`**
- Creates Supabase Storage bucket `job-media` (public, 50 MB file limit, image/video MIME types)
- RLS policy: employees can upload to paths matching their user ID; any authenticated user can read

**`client/pages/employee/AssignmentDetail.tsx` changes**
- Added `JobMedia` interface
- State: `media: JobMedia[]`, `isUploading: boolean`, `fileInputRef`
- `loadMedia()` — fetches from `job_media` table on mount
- `handleMediaUpload(file)` — uploads to Supabase Storage `job-media/{assignmentId}/{timestamp}-{filename}`, then POSTs record to server, then calls `loadMedia()` to refresh
- UI: Photo and File upload buttons, thumbnail gallery below assignment details
- Imports: `Camera`, `Video`, `X` from `lucide-react`

---

## Sprint 2B — Appointment Completion Cascade

### Problem
When an employee marked an assignment `completed`, the linked appointment remained in its original status. Supabase RLS prevents employees from writing to `appointments` rows owned by other users.

### Solution

All employee status updates are routed through the server API (`POST /api/employee/assignments/:id/status`), which uses `supabaseAdmin` (service role, bypasses RLS) to update both tables.

**`server/routes/employeeAssignments.ts` changes**
- `select` query now includes `appointment_id`
- After writing assignment status update, if `status === "completed"` and `appointment_id` is present:
  ```typescript
  await db.from("appointments")
    .update({ status: "completed" })
    .eq("id", updated.appointment_id)
    .not("status", "in", '("completed","canceled","cancelled","canceled_by_admin","canceled_by_customer")');
  ```
  The `.not()` guard prevents overwriting a status that was already terminal.

**`client/pages/employee/AssignmentDetail.tsx` changes**
- `updateStatus()` now calls `fetch("/api/employee/assignments/:id/status", { method: "POST", headers: { Authorization: "Bearer <token>" } })` instead of calling Supabase directly

---

## Sprint 2C — Property GPS Coordinates

### Problem
`AssignmentDetail.tsx` set `lat: null, lng: null` via hardcoded values, preventing any map-based or coordinate-dependent features from working.

### Solution

**Database migration: `db/migrations/2026-05-28_property_coordinates.sql`**
- Adds `lat NUMERIC(10,7)` and `lng NUMERIC(10,7)` to `properties` table
- Includes index on `(lat, lng)` for geo queries
- Includes comment-documented backfill query (run manually after Regrid data is available)

**`client/pages/employee/AssignmentDetail.tsx` changes**
- Properties query now selects `lat, lng`
- `lat` and `lng` populated from `propRes.data.lat / propRes.data.lng` (null if not yet geocoded)

---

## Verification

- `pnpm typecheck` — no errors across all three sprint files
- `pnpm build` — clean
- Assignment completion cascade uses `supabaseAdmin` — RLS not a factor on server
- Storage bucket MIME type whitelist prevents non-media uploads
