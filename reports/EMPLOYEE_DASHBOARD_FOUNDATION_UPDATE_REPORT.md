# Employee Dashboard Foundation Update Report
**Date:** 2026-05-31

## Changes Made

### Dashboard.tsx

**Clock In/Out — API routes now used:**
- Removed direct Supabase writes from Dashboard.tsx
- Now calls `POST /api/employee/shifts/clock-in` with Bearer JWT
- Now calls `POST /api/employee/shifts/clock-out` with Bearer JWT
- Consistent with Timesheets.tsx Supabase reads (same data source)

**TEST ACCOUNT banner:**
- Rendered when `employee.is_test === true`
- Amber styling with warning icon
- Text: "Test Account — This is a test account. Real customer data may be masked."
- Shows before all other content (cannot be missed)

**GPS consent reminder (when not enabled):**
- Blue banner when `!employee.gps_consent_at`
- Text: "GPS Tracking Not Enabled — Enable location tracking in your profile to improve route accuracy."
- "Go to Profile" link
- Non-blocking — does not prevent access to assignments

**GPS active indicator (when enabled):**
- Small green banner when `employee.gps_consent_at` is set
- Text: "GPS tracking active — location captured during active assignments only."
- Reassures employee that tracking is limited to work time

**Next stop calculation:**
- Fixed to skip no_show and skipped assignments
- Now shows next non-terminal assignment (not just first incomplete)

### Profile.tsx

**GPS Tracking section (new card):**
- Shows current GPS consent status (enabled/disabled)
- Shows enabled date when active
- Disclosure text (marked as requiring attorney review)
- Enable/Disable toggle button

**Emergency Contact section (new card):**
- Fields: Full Name, Phone, Relationship
- Saved with main profile save action
- Optional — no validation errors if empty

**Employee details card:**
- Added `worker_type` display alongside role

**TEST banner:**
- Same amber banner as Dashboard when is_test

### AssignmentDetail.tsx

**Checklist:**
- Now persisted via API
- Shows "N/6 complete" counter
- Checked items shown with strikethrough
- Auto-saves on every toggle

**GPS on status update:**
- Tries to capture geolocation before each status API call
- GPS failure does not block status update
- Passes coordinates in request body for server storage

### useEmployee.ts

New fields in Employee interface and select query:
- `worker_type`, `is_test`
- `gps_consent_at`
- `emergency_contact_name`, `emergency_contact_phone`, `emergency_contact_relation`

## What Was NOT Changed

- Route list / assignment list display (unchanged)
- Navigation deep links (unchanged)
- Messaging (unchanged — client-side Supabase direct writes still used)
- Media upload (unchanged)
- Status timeline display (unchanged)
- Overall dashboard layout / SectionHeading (unchanged)
