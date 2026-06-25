# Employee Workforce UI Report
**Date:** 2026-06-01

---

## Overview

Employees currently have no way to view their work schedule, request time off, or signal unavailability. The only schedule-related view is the Timesheets page (past hours) and Assignments page (today's jobs). Both are reactive — they show what happened, not what is planned.

---

## New Page: `/employee/schedule`

**Nav:** Employee sidebar → "Schedule" (between "Route" and "Timesheets")

### Section 1: This Week at a Glance

A compact 7-day week strip showing:

```
  Mon   Tue   Wed   Thu   Fri   Sat   Sun
  ███   off   ███   ███   ███─  off   off
  8–5         10–4  8–5   8–2
```

Color coding:
- Dark green bar = scheduled working day
- Gray "off" = day off per schedule template
- Yellow strikethrough = approved time off
- Half bar = partial day

Clicking a day opens a detail panel for that date.

### Section 2: Upcoming Assigned Days

Shows the next 14 days with assigned routes/appointments:

```
Today — Monday, June 3
  ● Route published — 7 stops

Tomorrow — Tuesday, June 4
  ● Day off (per schedule)

Wednesday, June 5
  ● No route published yet
```

### Section 3: Time Off Requests

**Request Time Off button** → opens dialog

**Request dialog:**
- Type: PTO / Sick / Personal / Unavailable
- Date range picker
- Partial day toggle (if yes: start/end time)
- Reason text field (optional)
- Submit

**My Requests table:**
| Dates | Type | Status | Admin Note |
|-------|------|--------|------------|
| Jul 4–6 | PTO | ✅ Approved | — |
| Jul 15 | Personal | 🟡 Pending | — |
| Jun 20 | Sick | ✅ Approved | "Feel better!" |

Employee can cancel pending requests (not approved ones).

### Section 4: Sick Day Reporting

**"Report Sick Today" button** — visible only during work hours on scheduled days.

Clicking creates a same-day sick request that auto-approves and notifies admin.

---

## What Employees Cannot Do (By Design)

| Action | Why Not |
|--------|---------|
| Edit their weekly schedule directly | Admin sets the schedule; employee requests changes |
| Approve their own time off | Admin approval required |
| Cancel an approved time-off request | Must contact admin |
| See other employees' schedules | Privacy; not needed for field ops |
| Override their route assignment | Admin controls routing |

---

## Employee Notification Visibility

On the schedule page, employees see:
- "Your time-off request for July 4–6 was approved."
- "Your time-off request for July 20 was rejected: [admin note]"
- "Your schedule has been updated by admin — view changes"
- "You have a route published for Thursday. Check your route."

These match the notification requirements in the dedicated notification report.

---

## Mobile Considerations

The `/employee/schedule` page is primarily accessed on mobile devices (field technicians use phones). Design priorities:
- Large tap targets for the request dialog
- "Report Sick Today" button must be immediately visible without scrolling
- Week strip must work on small screens (horizontal scroll if needed)
- Offline awareness: if app is offline, show last-known schedule with "Last updated: [time]"

---

## Sidebar Navigation Update

Current employee sidebar items:
1. Dashboard
2. Today's Route
3. Assignments
4. Messages
5. Timesheets
6. Profile
7. Onboarding

New item to add:
```
Between Timesheets and Profile:
8. Schedule ← NEW
```
