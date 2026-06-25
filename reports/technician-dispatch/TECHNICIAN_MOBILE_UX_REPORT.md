# Technician Mobile UX Report

Focused changes only, per the brief's own "do not redesign the entire app" — every change below targets a
specific pain point named in `TECHNICIAN_EXPERIENCE_AUDIT.md`, nothing more.

## What changed

- **Sticky next-stop action bar (`Route.tsx`)** — the single biggest pain point from the audit: after
  scrolling down to read a stop's notes, there was no way to act without scrolling back to the top. A bar
  pinned to the bottom of the viewport now always shows the next stop's name, a one-tap "Navigate," and an
  "Open" button straight into its detail page — reachable one-handed without scrolling, on every screen of
  the page.
- **Larger touch targets throughout `AssignmentDetail.tsx`**: the four status buttons (En Route / Arrive /
  Complete / Blocked) went from the default 32px `size="sm"` to `min-h-11` (44px, the standard mobile
  minimum) in a 2-column grid on narrow screens; the blocked-form's No-Show/Skipped/Cancel buttons, the
  message input and Send button, and the Photo/File upload buttons all got the same treatment. The
  checklist's checkboxes — the smallest tap target on the page before this (16px, with only the checkbox
  itself clickable) — are now 20px with the *entire row* as the tap target, not just the box.
- **Photo upload is now the primary action**, File secondary — most job documentation is a quick camera
  shot, not picking an existing file from storage; the visual weight now matches actual usage.
- **Clearer bad-signal messaging**: messaging (which stays online-only by design — see
  `OFFLINE_ACTION_QUEUE_REPORT.md`) now says "No signal — try again once you're back online" instead of a
  generic "Failed to send message" when offline, so a technician immediately understands *why*, not just
  *that* it failed.
- **Clock-in/GPS status**: already clear from last sprint's work (the "Location Tracking: On/Off" indicator
  on the Dashboard) — reviewed, found already meeting this requirement, left unchanged rather than
  redundantly rebuilding it.

## A real visual bug found and fixed while verifying this live

The new sticky action bar's rightmost button ("Open") was being visually covered by `ChatWidget.tsx`'s
floating launcher — a `fixed bottom-4/6 right-4/6` circular button at the same `z-40` stacking level,
pre-existing on every page but never previously in conflict with anything because no other page had
bottom-pinned content sharing that corner. Caught via a real screenshot, not by reading the code (the two
components have no knowledge of each other, so nothing about reading either file in isolation would have
surfaced this). Fixed by reserving right-side clearance (`pr-20`/`sm:pr-24`) on the action bar specifically,
sized to the chat launcher's actual footprint (`h-14 w-14` plus its edge offset). Reverified: the full bar,
including "Open," now renders fully visible alongside the chat bubble.

## Verified live

Created a real route, assignment, and stop for a test technician (rather than relying on an empty-state
screenshot) and confirmed via Playwright screenshots at a 390px mobile viewport:
- The sticky bar renders correctly with the next stop's name, Navigate, and Open — clear of the chat widget
  after the fix above.
- The status action buttons render at the larger size in a 2-column grid.
- The checklist's larger checkboxes and full-row tap targets render correctly, with the 0/6-complete
  counter intact.
- Photo renders as the solid primary button, File as the outline secondary, exactly as intended.

`pnpm typecheck` clean; `pnpm test` 216/216 (no regressions — these were styling/layout changes only, no
logic changes, so no new tests were needed beyond what Phases 3–4 already cover for the underlying data/
queue behavior these buttons trigger).
