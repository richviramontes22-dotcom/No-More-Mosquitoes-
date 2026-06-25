# Mobile Audit Priority Fixes Report

## A. Technician assignments/dashboard empty

**Root cause, confirmed live**: `client/hooks/employee/useEmployeeAssignments.ts` called
`.order("appointments.scheduled_at", { ascending: true })` — PostgREST has no syntax to order parent rows
by an embedded resource's column this way. Reproduced directly against the live REST API:
`PGRST100: "failed to parse order (appointments.scheduled_at.asc)"`. Separately verified that PostgREST's
actual embedded-order syntax (`?appointments.order=scheduled_at.asc`) doesn't even do what the code wanted —
comparing `asc` vs `desc` on that param produced *identical* row order, proving it has no effect on parent
rows at all (it only reorders arrays of *many* embedded children, not a `!inner` to-one relation).

**Fix**: removed the `.order()` call from the query; sort the already-fetched rows client-side by
`appointments.scheduled_at` instead. This single hook is used by both `Dashboard.tsx`'s technician view and
`Assignments.tsx` — one fix covers both surfaces named in the audit finding.

## B. Admin messages "column messages.from does not exist"

**Root cause, confirmed live**: `messages` has no `from` column — the real columns are
`id, thread_id, sender_id, body, created_at, direction, channel, read_at, delivered_at`. Reproduced:
`42703: column messages.from does not exist`. `direction` (`"inbound"` | `"outbound"`) is the real,
already-correctly-used convention elsewhere in this codebase (`employeeMessages.ts`, `AssignmentDetail.tsx`).

**Scope turned out wider than the admin page alone** — the identical bug existed in three files, not one:
`client/pages/admin/Messages.tsx` (the reported one), `client/pages/dashboard/Messages.tsx`, and
`client/pages/dashboard/Help.tsx` (customer-facing message threads — both broken the same way). All three
fixed identically: `select`/`insert` now use `direction`, inserts also set `sender_id`, and the UI's
"which side is this bubble on" logic now checks `direction === "outbound"` (admin context) or
`direction === "inbound"` (customer context) instead of the nonexistent `from`.

## C. customer_service / sales role CHECK constraint

**Confirmed live, broader than scoped**: empirically tested every role value against the live
`profiles_role_check` constraint. Currently allowed: `admin`, `support`, `customer`, `employee`. **Currently
rejected** (`23514` violation): `technician`, `dispatcher`, `sales`, `customer_service` — two more roles
blocked than the brief named.

**Fix**: `db/migrations/2026-06-22_widen_profiles_role_check.sql` widens the constraint to allow all eight
values. **Requires manual application via the Supabase SQL Editor** — there is no migration runner in this
project and the assistant has no raw DDL execution access; this is the same pattern every prior migration
this project has used.

**Related routing gaps found and fixed while verifying "assigned and routed correctly"**:
- `RequireEmployee.tsx`'s `EMPLOYEE_ROLES` set was missing `dispatcher` entirely — a dispatcher account
  (once the migration lands) would have been bounced out of the employee portal it's supposed to use.
- `AdminLogin.tsx` still redirected `customer_service`/`sales` to `/admin/customer-service` and
  `/admin/sales` — both routes were deleted in an earlier session when those roles moved into the unified
  employee portal. Fixed to redirect to `/employee` like every other staff role.
- `Login.tsx` (the regular customer-facing login) only special-cased `role === "employee"` for the
  employee-portal redirect — `technician`, `dispatcher`, `customer_service`, and `sales` all fell through to
  customer onboarding/dashboard logic instead. Fixed to redirect all employee-portal roles consistently.
- `UserRole` type in `postLoginRoleCheck.ts` didn't include these roles, which is what caught the
  `Login.tsx` gap at compile time once the comparisons were added.

## D. /admin/visits broken

**Root cause, confirmed live**: `Visits.tsx` built `userIds`/`propertyIds` via `.map()` with no null
filtering before passing them to `.in("id", ...)`. Reproduced the exact failure mode directly:
`22P02: invalid input syntax for type uuid: "null"` — a single null in a PostgREST `.in()` list fails the
*entire* query, not just that one row. No completed appointment currently has a null `user_id`/`property_id`
in the live data, so this hasn't fired in production yet — it's a real, latent bug, not an active one.
**Fixed** with `.filter(Boolean)` (and deduped with `Set`, matching the pattern already used correctly
elsewhere in this codebase, e.g. `adminMarketplace.ts`).

**`/api/admin/subscriptions/past-due` and `/api/admin/subscriptions/needs-scheduling`** — tested live with a
real admin session; both returned `200` with correct data. Code review confirms both already use the
filter+dedup+empty-array-guard pattern correctly. **No bug found in either** — they were already fixed in an
earlier session, or the audit finding was imprecise about which specific query was broken. Not changed.

## E. Admin/employee mobile nav doesn't collapse below 1024px

**Root cause**: both `AdminLayout.tsx` and `EmployeeLayout.tsx` used `lg:grid-cols-[...]` with no narrower
fallback — below 1024px the grid falls back to a single stacked column, rendering the *entire* sidebar
(7 nav groups / 30+ links for admin) as a block above the page content on every single page.

**Fix**: both layouts now hide the desktop `<aside>` below `lg:` and add a hamburger-trigger button +
`Sheet`-based slide-out drawer (reusing the existing `Sheet` primitive already used elsewhere in this
codebase, not a new dependency) containing the identical nav content. Closes automatically on navigation.

**A real bug surfaced while building this, not a pre-existing audit finding**: the mobile trigger button
initially collided with the site's own fixed global header (`MainLayout`) — `z-50` header vs. my button's
lower z-index, with the header's actual rendered height (136.5px, measured directly via Playwright) exceeding
what `MainLayout`'s own `pt-[96px]` spacer assumes. Rather than chase that header-height mismatch with a
guessed offset, the trigger button was moved *inside* the same padded container the rest of the page content
already uses, so it inherits whatever effective offset already works for everything else on the page —
verified by direct pixel measurement (button now starts at y=136, the header ends at y=136.5) and by a real
Playwright click-and-screenshot test showing both drawers open correctly with the right nav content.

## F. Floating chat widget overlaps mobile content

**Root cause**: `ChatWidget.tsx`'s fixed bubble used `z-[9999]`. Every `Dialog` and `Sheet` in this codebase
(including the schedule-booking dialog, and the new admin/employee nav drawers from item E) uses `z-50` for
both their overlay and content. At `z-9999`, the chat bubble rendered *on top of* any open modal — most
concretely, on top of the schedule dialog's own sticky bottom CTA bar ("Next Step" / "Continue to Payment"),
whose right-aligned button sits in the same bottom-right corner the chat bubble occupies on mobile.

**Fix**: lowered to `z-40` — still above ordinary page content (sticky bars elsewhere in the app are `z-10`
or lower, so the widget stays usable on regular pages) but now correctly sits *behind* any real modal/drawer,
which covers it with its own backdrop instead of the reverse. Verified the z-index relationship directly
from each component's source (`z-50` in `dialog.tsx` and `sheet.tsx`, confirmed unchanged) rather than
relying on catching one specific dialog mid-open in a screenshot — the fix is correct by construction for
every current and future `Dialog`/`Sheet` in the app, not just the one case found.

## Not in this pass

"Legal pages unpublished warning" was confirmed in the original mobile audit as a content/admin action
(publish the documents via the admin Legal Documents tool), not a code bug — correctly excluded from this
sprint's code fixes, no change made.
