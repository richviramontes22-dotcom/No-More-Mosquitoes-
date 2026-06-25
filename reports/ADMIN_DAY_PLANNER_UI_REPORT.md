# Admin Day Planner UI Report
**Date:** 2026-06-01
**File:** `client/pages/admin/RoutePlanning.tsx`

---

## Tab Structure

The Route Planning page now has two tabs:

| Tab | Label | Default |
|-----|-------|---------|
| Day Planner | `Users` icon + "Day Planner" | YES (default active) |
| Single Technician | "Single Technician" | No |

A shared date picker sits between the tab switcher and tab content, so the date is preserved when switching tabs.

---

## Day Planner Tab

### Top Action Row

| Button | Action | Disabled When |
|--------|--------|--------------|
| Generate Day Plan | `POST /routes/day/generate` | While generating |
| Approve All | `POST /routes/day/approve` | No drafts exist for date |
| Publish All | `POST /routes/day/publish` | No approvable routes exist |
| Discard Drafts | `POST /routes/day/rebuild` with confirm | Always available |

The page auto-loads day routes when the date changes.

### Route Cards Grid

`sm:grid-cols-2 lg:grid-cols-3` — one card per technician with route for the date.

Each card shows:
- **Employee name + email**
- **Status badge** (color-coded: draft/approved/published/in_progress/completed)
- **Stop count + miles**
- **Confidence badge**: High (green), Medium (amber), Low (red)
- **Completion counter**: "✓ 3/6" if some stops completed
- **Coordinate warning**: amber box showing count of coordinate warnings (e.g., "2 coordinate warnings")
- **Individual action buttons**:
  - Draft → "Approve" button
  - Draft or Approved → "Publish" button  
  - Published → "✓ Published [time]" indicator (no button)

### Unassigned Appointments Section

Amber card at the bottom listing appointments not placed on any route:
- Each row: address + city
- Explanation text: "These appointments were not placed due to capacity limits or missing technicians."

Shown when `dayUnassigned.length > 0`.

---

## Auto-Refresh Behavior

- Day routes load on mount and whenever `selectedDate` changes (while Day tab is active)
- After each action (generate, approve, publish, individual card action), `loadDay()` is called to refresh
- No polling — admin manually refreshes or actions trigger refresh

---

## Single Technician Tab

The existing single-technician route planner is preserved intact behind the "Single Technician" tab. All existing functionality works unchanged:
- Employee dropdown
- Generate Optimized Route
- Route detail with stops table
- Approve / Publish / Rebuild / Discard buttons

The single-tech tab uses `selectedDate` from the shared date picker.

---

## State Management

| State Variable | Purpose |
|---------------|---------|
| `activeTab` | "day" or "single" |
| `dayRoutes` | Array of route objects for the selected date |
| `dayUnassigned` | Array of unassigned appointments |
| `generatingDay` | Loading state for Generate Day Plan |
| `loadingDay` | Loading state for initial day load |
| `approvingAll` | Loading state for Approve All |
| `publishingAll` | Loading state for Publish All |
