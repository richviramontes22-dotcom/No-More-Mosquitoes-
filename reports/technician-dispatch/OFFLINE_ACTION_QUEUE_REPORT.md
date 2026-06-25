# Offline Action Queue Report

## What was built

**`client/lib/employee/actionQueue.ts`** — covers exactly the four action types the brief scopes for
queueing: status updates (`en_route`/`arrived`/`completed`/`skipped`/`no_show`), treatment notes, the
blocked/unable-to-service reason (submitted as part of the same status-update call, not separately), and
media metadata (only the metadata — caption/type — never the file itself; see
`TECHNICIAN_EXPERIENCE_AUDIT.md` for why the actual upload stays online-only). Messaging, checklist toggles,
and anything outside `/employee/*` are not queued, per the same audit's reasoning.

A foreground reconnect sync, not the Background Sync API — **`client/hooks/employee/useActionQueue.ts`**
calls `syncQueue()` the moment `useOnlineStatus()` flips to true, plus once on mount (in case the queue was
already populated from a previous session that ended offline). This matches the brief's own explicit
allowance ("a foreground reconnect sync is acceptable" — true background sync needs a service-worker sync
event handler, a meaningfully bigger and less reliable cross-browser surface for the same problem at this
scale).

## Rules from the brief, and how each is met

- **Send immediately when online, queue when offline**: `AssignmentDetail.tsx`'s `updateStatus()` and
  `saveTreatmentNotes()` both check `navigator.onLine` first; if false, they queue immediately without
  attempting the network call. If online but the `fetch` itself throws (a real connectivity failure, not a
  server response), they queue too — this is the case where the technician's connection drops mid-request.
- **Sync when back online**: `useActionQueue`'s online-event listener.
- **Show pending sync count**: `OfflineIndicator` (extended from Phase 2/3) now shows the count globally —
  on every employee page, regardless of which page actually queued the action — plus a more specific banner
  on `AssignmentDetail.tsx` itself.
- **Show sync success/failure**: `AssignmentDetail.tsx` passes a result handler into `useActionQueue` that
  toasts "Synced N updates" on success and a distinct toast per rejected action.
- **Prevent duplicate submissions**: `enqueueAction()` checks whether the most recently queued action for
  the same assignment + type already has the identical payload (e.g., double-tapping "Complete") and skips
  re-queueing it. A genuinely different payload for the same assignment (e.g. `en_route` queued, then later
  `arrived`) is never deduped — that's a real sequence, not a repeat.
- **Preserve action order**: `syncQueue()` processes the array strictly sequentially (`for...of` with
  `await`, never `Promise.all`), so two status updates for the same assignment can never land out of order.
- **Handle conflicts safely**: every queued send distinguishes a network failure (`fetch` threw — stop
  processing, leave everything queued for the next attempt) from a server rejection (`fetch` resolved but
  `!res.ok` — a real conflict, e.g. an invalid status transition; drop just that one action and keep
  processing the rest, so one bad action can never permanently jam the queue).

## A design decision not in the brief's own list, made for safety

The brief's cleanup-style rules ("clear on logout") are written for the *read-only* cache (Phase 3). The
action queue is deliberately **not** cleared on logout — see the comment in `actionQueue.ts`. A queued
action is unsynced *work*, not a disposable copy of server data; discarding it on logout would silently
lose a real status update or note. Instead, every read and sync path is scoped to one `employeeId`, so if a
second technician signs in on the same device, the first technician's still-pending actions are simply left
alone (untouched, unsynced) rather than either being lost or — worse — sent to the server under the second
technician's session. They sync correctly whenever that first technician signs back in on that device.
Verified directly: seeding two employees' queues and syncing as one only ever touches that one employee's
entries.

## A real bug this sprint's own tests caught — not found by hand, found because the test suite is strict

The first version of `sendAction()`/`syncQueue()` distinguished "network failure" from "server rejection" by
comparing the error *string* (`error === "Network error"`) — which only ever matched the function's own
fallback string, never a real `fetch()` rejection's actual message (`"Failed to fetch"`,
`"net::ERR_INTERNET_DISCONNECTED"`, etc.). In practice this meant every network failure was being
misclassified as a server rejection and **dropped instead of retried** — exactly backwards from the
intended behavior. A unit test ("stops at the first network failure and leaves the rest queued") failed
immediately and pinpointed it. Fixed by replacing the string comparison with a proper discriminated union
(`{ kind: "success" } | { kind: "network"; error } | { kind: "rejected"; error }`), which also turned out to
be necessary for TypeScript to narrow the result correctly in `syncQueue()` (a boolean `ok` discriminant
didn't narrow cleanly inside the loop; the string-literal `kind` discriminant does).

## Verified

- **`pnpm test`**: 8 new tests in `actionQueue.spec.ts` — order preservation, exact-duplicate suppression
  (while preserving genuinely different sequential statuses), per-employee scoping of both the queue and
  `syncQueue()` itself, and the network-vs-rejection distinction (including the bug above, which the tests
  caught before any manual testing did). 216/216 project-wide, `pnpm typecheck` clean.
- **Live, via Playwright**: seeded a real queued action directly in `localStorage` for the active
  technician, reloaded, and confirmed the queue drains automatically on mount without any user action —
  a deliberately-invalid assignment id 404s, is correctly classified as a rejection (not a network failure),
  and is dropped from the queue rather than retried forever, exactly matching the "handle conflicts safely"
  requirement.
