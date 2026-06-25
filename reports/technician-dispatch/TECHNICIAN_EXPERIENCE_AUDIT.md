# Technician Experience Audit

Audited every employee-portal page and flow: Dashboard, Route, Assignments, Assignment Detail, Profile,
clock in/out, the GPS tracking indicator (built last sprint), job notes, media upload, the blocked/unable-
to-service workflow, mobile layout, offline behavior, and current installability.

## What already works well

- **The mobile layout is already responsive**, not an afterthought — `EmployeeLayout.tsx` collapses the
  sidebar into a Sheet-based drawer below `lg:`, every page uses single-column stacks with `sm:`/`lg:`
  breakpoints, and last sprint's GPS work was verified at a 390×844 viewport without layout breakage.
- **Today's Route (`/employee/route`) is genuinely well-designed for field use**: sequence-numbered stop
  cards, a clear "Next Stop" badge, one-tap "Navigate" deep links (`navUrl()` → native Maps/Waze), a status
  color system, and a completion banner. This is close to what a dispatch app should look like — it just
  has no offline resilience (see below).
- **The blocked/unable-to-service flow is sound**: a dedicated reason textarea, two distinct outcomes
  (no-show vs. skipped), and the GPS-snapshot-on-status-change behavior already degrades gracefully if
  geolocation is denied (`capturePosition()` resolves `null` rather than blocking the status update).
- **The checklist already has non-fatal offline degradation as a precedent**: `loadChecklist`/
  `saveChecklist` swallow fetch failures and leave the UI state intact rather than erroring — proof this
  codebase already has the right instinct for one specific feature; Phase 4 generalizes that instinct into
  an actual queue instead of "fire and silently drop."
- **GPS consent, tracking indicator, and clock-in state are correct** (last sprint's Phase 6 work) — nothing
  to redo here, just something to keep working through whatever PWA/offline layer gets added.

## What is painful on mobile

- **Every primary action is a single full-width-ish button row with no sticky "next action" affordance.**
  On Assignment Detail, the four status buttons (En Route / Arrive / Complete / Blocked) sit in a static
  card near the top — on a tall phone, after scrolling to read notes or look at the map, a technician has
  to scroll back up to act. There's no persistent action bar.
- **Touch targets are inconsistent.** Status buttons use the default shadcn `Button` `size="sm"` (32px
  tall) — workable but tighter than the ~44px recommended minimum for gloved/one-handed field use. The
  checklist's native checkboxes (`h-4 w-4`, 16px) are the smallest tap targets on the page.
- **The photo/video upload buttons are small, secondary-styled outline buttons** identical in visual weight
  to "File" — for a technician standing at a property in bright sun, the primary action (take a photo) isn't
  visually distinct from the rarer one (attach an existing file).
- **The messaging composer is a generic text input**, not optimized for one-handed thumb typing or quick
  canned responses ("On my way," "Completed," etc.) — every message is fully typed from scratch.
- **No bad-signal messaging anywhere.** If a fetch fails, the user sees a generic toast ("Status update
  failed") with no indication of *why* (no signal vs. a real server error) and no guidance on what happens
  next.

## What fails with poor connection or no connection

Every data-mutating action in the employee portal is a direct, unqueued network call with no offline
fallback:

- **Status updates** (`updateStatus` in `AssignmentDetail.tsx`) — a bare `fetch` to
  `/api/employee/assignments/:id/status`. Offline: fails immediately, shows a generic toast, the technician
  has to remember to retry once back online. The UI does not revert optimistically, so the buttons just sit
  there in their pre-update state, looking like nothing happened.
- **Treatment notes** (`saveTreatmentNotes`) — same pattern, same failure mode. Typed notes are not lost
  (they stay in the textarea), but there's no queued retry — the technician has to notice the failure toast
  and tap Save again later.
- **Photo/video upload** (`handleMediaUpload`) — the worst case: it's *two* sequential network calls
  (Supabase Storage upload, then a metadata POST). Offline, the Storage upload itself fails immediately;
  there's no local hold of the file, so the technician has to retake the photo or re-attempt later — the
  original file selection is lost once the input's file list is cleared.
- **Messaging** (`handleSendMessage`) — a direct `supabase.from("messages").insert(...)`, same unqueued
  failure mode.
- **Clock in/out** (`ClockWidget.tsx` callbacks in `Dashboard.tsx`) — same pattern; failing to clock in
  offline means GPS tracking (gated on a real open shift) silently never starts either.
- **Every page's initial data load** (`loadRoute`, `loadAssignment`, `useEmployeeAssignments`) has no
  persisted cache — a fresh page load (or a reload after losing the in-memory React state) with no
  connection shows an infinite spinner or an empty/error state. There's currently no way to view today's
  route or a job's address at all without a live connection at the moment of loading.

## What can safely be cached (read-only)

- **Today's route and its stops** (`/api/employee/routes/today`'s `route` + `stops`) — already exactly the
  shape Phase 3 needs; it's a single authenticated GET scoped to the technician's own data.
  `assignment_id`, `address`, `city`, `zip`, `lat`/`lng`, `customer_name`, `customer_phone`, `service_type`,
  notes, and stop sequence/status are all safe to persist locally — none of it is shared across
  technicians, and it's already what's rendered on-screen today.
- **The assignment detail fields** `AssignmentDetail.tsx` already fetches (customer name/phone, address,
  service type, existing notes, `technician_notes`) — same reasoning, scoped to one technician's own
  assignment.
- **Not safe to cache**: messages (could go stale and be replied to without the latest context), job media
  (binary, not metadata, and not needed for read access once already viewed), checklist state (small,
  cheap to refetch, and staleness here has real safety implications — better to show "unknown" than a
  stale checked box), anything from `/admin/*` or `/employee/tickets` /`/employee/satisfaction`
  (customer-service tooling, explicitly out of scope per the brief).

## What actions need offline queueing

In priority order (most field-critical first):

1. **Status transitions** (`en_route`, `arrived`/`in_progress`, `completed`, `skipped`, `no_show`) — these
   are the actions a technician takes constantly throughout the day, often in basements, attics, or rural
   properties with poor signal.
2. **Treatment notes** — typed once per job, often right after finishing, sometimes from a low-signal yard.
3. **Blocked/unable-to-service reason** — submitted alongside a `skipped`/`no_show` status; needs to queue
   as part of the same action, not separately (a status update without its reason, or a reason without its
   status, would each be half-useful).
4. **Media metadata** — per the brief's own scoping, only the *metadata* (caption, media type), not the
   binary file itself; the actual upload still requires a live connection (Supabase Storage has no offline
   queue equivalent worth building here), but if a metadata POST fails after a successful upload, that's
   exactly the kind of small, safe, idempotent action worth queueing rather than losing.

## What should remain online-only

- **Messaging** — a queued message that silently resends after a long delay risks looking like the
  technician ignored a customer or dispatch for hours; better to fail visibly and let them retry once back
  online, matching how every other chat-style UI in this app already behaves.
- **The actual media file upload** — queueing binary blobs in IndexedDB indefinitely risks silently
  consuming a technician's phone storage and creates a real "did this actually upload" trust problem;
  simplest and safest is: upload now if online, otherwise tell the technician to retry when they have
  signal (the brief's own phrasing — "media metadata if file upload cannot complete immediately" — backs
  this: only the metadata is meant to be queryable offline, not the file).
- **Checklist toggles** — already non-fatal today; given the safety stakes of an inaccurate pre-service
  checklist, showing "couldn't save, try again" is safer than silently queueing a checkbox state that might
  not reflect reality by the time it syncs.
- **Onboarding form submission, profile edits, GPS consent grant/revoke** — infrequent, not time-critical
  in the field, and consent state in particular should never be ambiguous about whether it actually landed.
