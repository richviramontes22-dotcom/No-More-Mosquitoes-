# Admin Technician Capacity UI Report
**Date:** 2026-06-01
**File:** `client/pages/admin/WorkforceCapacity.tsx`
**Route:** `/admin/workforce/capacity`

---

## Layout

Two-column: technician list sidebar (280px) + capacity editor (flex-1).

---

## Effective Today Banner

When a technician is selected, shows a blue info banner:
> "Effective today: max 6 stops/day (source: capacity_profile)"

The `source` field identifies which priority level is active (date_override / schedule_template / capacity_profile / employee_default / global_default).

---

## Daily Limits Card

| Field | Input | Default |
|-------|-------|---------|
| Max stops per day | number (1–30) | 8 |
| Max service minutes per day | number (optional) | No limit |

---

## Qualifications Card

| Field | Input | Notes |
|-------|-------|-------|
| Skill level | select (junior/standard/senior/specialist) | Default: standard |
| Licensed Pesticide Applicator | checkbox | CA DPR compliance |

---

## Vehicle & Home Base Card

| Field | Input |
|-------|-------|
| Vehicle type | text |
| Home base / Depot address | text (note: for future route start) |

---

## Save Behavior

"Save Capacity Profile" calls `POST /api/admin/workforce/capacity/:employeeId` which upserts on `employee_id`. Safe to save repeatedly.

---

## What's NOT in the Beta UI

- Service area preference picker (field exists in DB and API, not yet surfaced in UI)
- Map-based home base picker (requires Mapbox — Sprint 6)
- Detailed service type restrictions (field in DB/API, UI simplified for beta)
