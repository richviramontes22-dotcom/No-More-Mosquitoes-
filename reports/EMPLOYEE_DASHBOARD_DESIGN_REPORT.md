# Phase 6 — Employee Dashboard Design Report
**Date:** 2026-05-31
**Project:** No More Mosquitoes — Employee Operations Sprint

---

## Current Dashboard Assessment

The employee dashboard is **functionally sound but incomplete**. The core assignment lifecycle works. The gaps are: GPS tracking not persisted, checklists not saved, MiniMap is a placeholder, the shift/message server routes use in-memory storage inconsistent with Supabase direct writes, and there is no onboarding status or route view.

---

## Dashboard Sections — Current vs Required

### Section 1: Today's Assignments (EXISTS — complete)
**Current:** Clock widget + stop count + assignment list on `/employee/assignments`
**Status:** Working. Shows status badges, customer name, address, scheduled time.
**Gap:** No route order / sequence number. Assignments shown in DB order, not optimized order.
**Required change:** When routing is built, show assignments in `route_stops.seq` order.

---

### Section 2: Upcoming Assignments (PARTIAL)
**Current:** Only shows today by default. Date param accepted but no UI to switch dates.
**Gap:** No "upcoming" tab or next 7 days view.
**Required:** Add week view tab to `/employee/assignments` showing next 7 days grouped by date.

---

### Section 3: Route / Map View (MISSING — MiniMap is placeholder)
**Current:** `MiniMap.tsx` shows diagonal stripe background with coordinate text.
**Gap:** No real map. No routing. No turn-by-turn. No route sequence.
**Required:**
- Integrate a real map library (recommend Mapbox GL JS — free tier generous; or Google Maps JS API)
- Show all today's stops as pins on a map
- Highlight next stop
- Show employee's current location (with GPS consent)
- "Navigate to Next Stop" button opens deep link

**Implementation path:**
1. Add Mapbox GL JS (or use simple Google Maps embed)
2. Plot property lat/lng pins from assignments
3. Current employee location from browser geolocation (consent-gated)
4. Route sequence numbers on pins
5. Full-screen option

---

### Section 4: Assignment Detail — Customer & Property Info (EXISTS — complete)
**Current:** Address, city/zip, customer phone (tel: link), service type, notes.
**Status:** Working.
**Gap:** No customer email shown; no property-specific notes field (only appointment notes).
**Recommended:** Add a "Property Notes" section if properties table has a notes/access_instructions column.

---

### Section 5: Service Notes / Access Instructions (PARTIAL)
**Current:** Appointment `notes` field displayed in detail.
**Gap:** No dedicated "access instructions" separate from service notes. No pinned gate codes or entry notes.
**Recommended:** Add `access_instructions` column to `properties` table. Display prominently with lock icon.

---

### Section 6: Status Buttons (EXISTS — complete)
**Current:** En Route → Arrive → Complete / No Show / Skip
**Status:** Working with full timestamp persistence and notification triggers.
**Gap:** No "Accept" step (assignment goes directly to en_route). Employee has no way to formally accept or decline an assignment before starting.
**Recommended:** Add "Accept" / "Decline" buttons for assigned (scheduled) status before en_route.

---

### Section 7: Media Upload (EXISTS — complete)
**Current:** Camera capture + file upload to Supabase Storage, stored in `job_media` table.
**Status:** Working.
**Gap:** No image preview of uploaded photos in assignment detail. No before/after labeling.
**Recommended:** Add `photo_type` column: 'before' | 'after' | 'issue' | 'general'. Show uploaded thumbnails inline.

---

### Section 8: Pre-Service Checklist (EXISTS UI — NOT PERSISTED)
**Current:** 6 hardcoded items with client-side checkbox state.
**Gap:** Checkboxes reset on page navigation. Not saved. `job_checklists` table in DB but never used.
**Required:**
- `POST /api/employee/assignments/:id/checklist` — save checklist completion
- DB write to `job_checklists` table (already exists in schema)
- Load saved state on re-open

---

### Section 9: GPS / Location Permission Status (MISSING)
**Current:** GPS captured on clock-in via `navigator.geolocation`. Not stored. No UI status.
**Required:**
- Permission request with clear consent explanation on first use
- Status indicator: "Location tracking: Active / Denied / Not Required"
- If denied: show fallback message ("Manual status updates only")
- If active: show current coordinates (or "Location active" without showing raw coords)
- GPS consent form acknowledgment (linked to onboarding system)

---

### Section 10: Notifications / Updates (MISSING from employee dashboard)
**Current:** Employees receive no in-app notifications on the dashboard.
**Gap:** Admin alerts and assignment changes are not surfaced in employee UI.
**Required:**
- Badge/bell icon in employee header showing unread updates
- Assignment status changes visible in activity feed
- Route updates (when routing built) — "Your route has been updated"
- New assignment notification

---

### Section 11: Onboarding Completion Status (MISSING)
**Current:** No employee onboarding system exists.
**Required:** Once onboarding is built:
- Dashboard banner: "You have 3 documents to complete before your first assignment"
- Link to `/employee/onboarding`
- Block assignment access if critical onboarding forms incomplete (configurable per form)

---

## Clock In / Out — Fix Required

**Problem:** Dashboard.tsx writes directly to Supabase `shifts` table. `employeeShifts.ts` server route writes to in-memory `db`. These are different data sources — shifts don't appear consistently.

**Fix:** Dashboard.tsx should call the server API routes (`POST /api/employee/shifts/clock-in`), which should write to Supabase instead of in-memory. Remove the in-memory pattern from `employeeShifts.ts`.

---

## Recommended Layout

```
/employee (Dashboard home)
├── Test account banner (if is_test)
├── Onboarding progress banner (if forms pending)
├── Clock In/Out widget
├── Today at a glance: N stops | N completed | Next: 9:00 AM
├── Route map (when built — today's stops as pins)
└── Link to Today's Assignments

/employee/assignments
├── Tabs: Today | This Week | All
└── List: sorted by route order (seq) or scheduled_at

/employee/assignments/:id
├── Customer name, phone, address
├── Access instructions (prominent)
├── MiniMap → real map (when built)
├── Navigate button (deep link)
├── Status bar: [Accepted] [En Route] [Arrived] [Complete]
├── Pre-service checklist (persisted)
├── Job notes / service type
├── Media upload (before/after/issue)
├── Message customer thread
└── Status timeline (timestamps)

/employee/onboarding (when built)
├── Progress bar
└── Form list with completion status

/employee/timesheets
├── Week navigation
├── Clock in/out history
└── CSV export

/employee/profile
├── Phone, vehicle, default nav
└── GPS consent status
```

---

## Immediate Fixes Required (Before Beta)

| Fix | Priority | Effort |
|-----|----------|--------|
| Fix shift persistence (use API route, not direct Supabase) | Critical | Small |
| Fix messages route (use Supabase, not in-memory) | Critical | Small |
| Persist checklist to `job_checklists` table | High | Medium |
| Add GPS consent gate before first location capture | High | Medium |
| Add upcoming assignments tab (next 7 days) | Medium | Small |
| Add photo before/after labeling | Medium | Small |
| Add assignment accept/decline flow | Medium | Medium |
| Real map integration (replace MiniMap) | High | Large |
| Route sequence display | Medium | Depends on routing sprint |
| Onboarding status banner | High | Depends on onboarding sprint |
