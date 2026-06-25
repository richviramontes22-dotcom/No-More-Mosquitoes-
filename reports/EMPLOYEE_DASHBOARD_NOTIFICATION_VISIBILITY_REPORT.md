# Employee Dashboard Notification Visibility Report
**Date:** 2026-05-30
**Phase:** 9 — Employee Dashboard Visibility

## Summary
Added a "Recent Updates" status timeline to `AssignmentDetail.tsx`. No new API endpoint needed — reads from existing assignment data.

## File Modified
`client/pages/employee/AssignmentDetail.tsx`

## Changes

### "Recent Updates" Section
Added above the Pre-service Checklist section. Shows:
- **Completed** — with timestamp (green dot)
- **In Progress** — with timestamp (blue dot)
- **En Route** — with timestamp (amber dot)
- **Arrived** — with timestamp (purple dot)
- Only shows statuses that have been reached (timestamps not null)
- If no timestamps yet, shows current assignment status
- Special display for cancelled/no_show/skipped (red dot with label)

### Notes Display
If assignment has notes (from appointment), displayed in a muted box below the timeline.

## Current Employee Dashboard Coverage

| Information | Available |
|-------------|-----------|
| Assigned date/time | Yes — via appointment |
| Customer address | Yes |
| Customer phone | Yes |
| Service notes | Yes (now shown in timeline section) |
| Status changes with timestamps | Yes (en_route_at, arrived_at, started_at, completed_at) |
| Cancelled/skipped/no_show status | Yes |
| Messages from admin | Yes (existing Messages section) |
| Job media | Yes (existing Photo/Video section) |
| Nav/map | Yes |

## Filtered/Labelled Status Display
- `no_show` → "No Show" (red)
- `skipped` → "Skipped" (red)
- These are visible in the status timeline so employees understand why an assignment might appear

## No New API Needed
All data comes from the `assignment` state already fetched in `loadAssignment()`. The component reads: `en_route_at`, `arrived_at`, `started_at`, `completed_at`, `status`, and `notes` (from appointment).
