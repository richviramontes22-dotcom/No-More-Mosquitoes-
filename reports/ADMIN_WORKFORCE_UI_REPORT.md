# Admin Workforce UI Report
**Date:** 2026-06-01

---

## Proposed Admin Pages

### Primary Hub: `/admin/workforce`

**Purpose:** Landing page for all workforce management. Provides a summary overview and links to sub-sections.

**Layout:**
```
Workforce Management
────────────────────────────────────────────────────────
Quick stats row:
  [5 Active Techs]  [1 Pending PTO]  [2 Days Until Next Blackout]

Sub-section cards:
  [Technician Schedules →]    [Time Off Requests →]
  [Capacity Settings →]       [Blackout Dates →]
```

---

### `/admin/workforce/schedules`

**Purpose:** Set and manage each technician's weekly recurring work schedule.

**Layout:**
- Left sidebar: list of active technicians (avatar + name + role badge)
- Right panel: weekly schedule grid for selected technician

**Weekly Grid (7 columns):**
```
         Mon    Tue    Wed    Thu    Fri    Sat    Sun
Working  [✓]    [ ]    [✓]    [✓]    [✓]    [ ]    [ ]
Start    8:00   —      10:00  8:00   8:00   —      —
End      17:00  —      16:00  17:00  14:00  —      —
Max Stops  8    —       6      8      5     —      —
```

**Actions:**
- Toggle `is_working` per day
- Edit start/end time (when is_working = true)
- Edit max stops override (when is_working = true)
- Set effective_from date (defaults to next Monday)
- Save schedule button

**Date Override Panel (below grid):**
"One-time exceptions for [selected tech]"
- Table of upcoming date overrides with add/delete
- Fields: date, available (yes/no), start, end, reason

---

### `/admin/workforce/time-off`

**Purpose:** Review and act on employee time-off requests.

**Tabs:**
- **Pending** (default) — shows badge count
- **Approved**
- **Rejected**

**Pending tab — request card:**
```
┌──────────────────────────────────────────────────┐
│  🧑 Luis Martinez        PTO                     │
│  July 4 – July 6, 2026 (3 days)                  │
│  "Family vacation"                               │
│                                                  │
│  ⚠ 2 assignments during this period               │
│    July 5: 123 Oak St, Irvine                    │
│    July 6: 456 Maple Ave, Irvine                 │
│                                                  │
│  [Reject]                      [Approve]         │
└──────────────────────────────────────────────────┘
```

**Approve dialog:**
- Optional admin note
- Checkbox: "I understand this will block Luis from routes on these dates"
- Confirm

**Reject dialog:**
- Required admin note (employee will see this)
- Confirm

**Sick Day Panel (always visible at top when applicable):**
If any technician has reported sick today:
```
🔴 Carlos Rivera called out sick today
   4 appointments may need reassignment [View Appointments]
```

---

### `/admin/workforce/capacity`

**Purpose:** Configure per-technician workload limits and service qualifications.

**Layout:** Cards grid (one per active technician)

**Each capacity card:**
```
┌────────────────────────────────────────┐
│ 🧑 Luis Martinez  [Technician]         │
│                                        │
│ Max stops/day    [8]  ──────────       │
│ Skill level      [Standard ▾]          │
│ Licensed applicator  [ ]               │
│ Service types    [All ▾]               │
│ Preferred areas  [Irvine, Orange ▾]    │
│ Home base        [123 Depot St...]     │
│                                        │
│                          [Save]        │
└────────────────────────────────────────┘
```

---

### `/admin/settings/business-hours` (Existing — extend)

**Current:** Toggle operational days + edit max_jobs_per_tech per window
**Add:** Service-area-specific hour overrides

**New tab: "By Service Area"**
- Select service area from dropdown
- Shows its hours or falls back to global
- Can override per day/window for that area

---

### `/admin/workforce/availability-calendar` (Phase 2)

**Purpose:** Calendar view showing technician availability at a glance.

**Layout:** Week/Month calendar with one row per technician.

```
         Mon 6/3   Tue 6/4   Wed 6/5   Thu 6/6   Fri 6/7
Luis:    ██████    ░░░░░░    ██████    ██████    ████──
Carlos:  ██████    ██████    PTO       PTO       PTO
Maria:   ██████    ██████    ██████    ──────    ██████
```
Legend: ██ available, ░░ day off, PTO time off approved, ── partial day

---

## Existing Admin Pages to Update

### `/admin/employees` (Employees.tsx)
Currently: invite, edit role/phone/status, test account management
**Add:** Link to their schedule and capacity settings

### `/admin/routes` (RoutePlanning.tsx)
Currently: generate routes, approve/publish
**Add:** Warning banner when techs have pending PTO on the selected date

---

## Page Priority

| Page | Priority | Sprint |
|------|----------|--------|
| `/admin/workforce/time-off` | HIGH | Sprint B |
| `/admin/workforce/schedules` | HIGH | Sprint A |
| `/admin/workforce/capacity` | MEDIUM | Sprint A |
| `/admin/workforce` (hub) | MEDIUM | Sprint A |
| `/admin/workforce/availability-calendar` | LOW | Sprint D |
| Business hours area overrides | LOW | Sprint C |
